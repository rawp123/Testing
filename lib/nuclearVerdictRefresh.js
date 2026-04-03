const path = require('path');
const { spawn } = require('child_process');

const DEFAULT_CRON_EXPRESSION = '0 4 * * *';

function isValidCronExpression(expression) {
  return typeof expression === 'string' && expression.trim().split(/\s+/).length === 5;
}

function parseCronField(field, min, max) {
  if (field === '*') {
    return null;
  }

  const value = Number(field);
  if (!Number.isInteger(value) || value < min || value > max) {
    return null;
  }

  return value;
}

function getNextRunFromCron(expression, now = new Date()) {
  const [minuteField, hourField, dayField, monthField, weekdayField] = expression.trim().split(/\s+/);
  const minute = parseCronField(minuteField, 0, 59);
  const hour = parseCronField(hourField, 0, 23);

  if (minute === null && minuteField !== '*') {
    return null;
  }

  if (hour === null && hourField !== '*') {
    return null;
  }

  if (dayField !== '*' || monthField !== '*' || weekdayField !== '*') {
    return null;
  }

  const next = new Date(now);
  next.setSeconds(0, 0);

  if (hour !== null) {
    next.setHours(hour);
  }

  if (minute !== null) {
    next.setMinutes(minute);
  } else {
    next.setMinutes(next.getMinutes() + 1);
  }

  if (next <= now) {
    next.setDate(next.getDate() + 1);
    if (hour !== null) {
      next.setHours(hour);
    }
    if (minute !== null) {
      next.setMinutes(minute);
    }
  }

  return next;
}

function createNuclearVerdictRefreshService(options = {}) {
  const repoRoot = options.repoRoot || process.cwd();
  const scriptPath = path.join(repoRoot, 'scripts', 'runScrapers.ts');
  const refreshToken = options.refreshToken || process.env.NUCLEAR_VERDICTS_REFRESH_TOKEN || '';
  const cronExpression = options.cronExpression || process.env.NUCLEAR_VERDICTS_CRON || DEFAULT_CRON_EXPRESSION;

  const state = {
    cronExpression,
    isRunning: false,
    lastRunStartedAt: null,
    lastRunCompletedAt: null,
    lastRunStatus: 'idle',
    lastRunError: '',
    lastTrigger: '',
    nextScheduledRunAt: null
  };

  let scheduledTimeout = null;

  function scheduleNextRun() {
    if (scheduledTimeout) {
      clearTimeout(scheduledTimeout);
      scheduledTimeout = null;
    }

    if (!isValidCronExpression(state.cronExpression)) {
      state.nextScheduledRunAt = null;
      console.warn(`[nuclear-verdicts] Invalid cron expression "${state.cronExpression}". Scheduler disabled.`);
      return;
    }

    const nextRun = getNextRunFromCron(state.cronExpression, new Date());
    if (!nextRun) {
      state.nextScheduledRunAt = null;
      console.warn(`[nuclear-verdicts] Unsupported cron expression "${state.cronExpression}". Scheduler disabled.`);
      return;
    }

    state.nextScheduledRunAt = nextRun.toISOString();
    const delay = Math.max(nextRun.getTime() - Date.now(), 1000);

    scheduledTimeout = setTimeout(async () => {
      try {
        await runRefresh('cron');
      } finally {
        scheduleNextRun();
      }
    }, delay);
  }

  function runRefresh(trigger = 'manual') {
    if (state.isRunning) {
      return Promise.resolve({
        started: false,
        alreadyRunning: true,
        status: getStatus()
      });
    }

    state.isRunning = true;
    state.lastRunStartedAt = new Date().toISOString();
    state.lastRunStatus = 'running';
    state.lastRunError = '';
    state.lastTrigger = trigger;

    return new Promise((resolve, reject) => {
      const child = spawn(
        process.execPath,
        [require.resolve('tsx/dist/cli.cjs'), scriptPath],
        {
          cwd: repoRoot,
          env: process.env,
          stdio: 'inherit'
        }
      );

      child.on('error', (error) => {
        state.isRunning = false;
        state.lastRunCompletedAt = new Date().toISOString();
        state.lastRunStatus = 'failed';
        state.lastRunError = error.message;
        reject(error);
      });

      child.on('exit', (code) => {
        state.isRunning = false;
        state.lastRunCompletedAt = new Date().toISOString();

        if (code === 0) {
          state.lastRunStatus = 'success';
          resolve({
            started: true,
            alreadyRunning: false,
            status: getStatus()
          });
          return;
        }

        state.lastRunStatus = 'failed';
        state.lastRunError = `Refresh process exited with code ${code}`;
        reject(new Error(state.lastRunError));
      });
    });
  }

  function getStatus() {
    return {
      isRunning: state.isRunning,
      cronExpression: state.cronExpression,
      lastRunStartedAt: state.lastRunStartedAt,
      lastRunCompletedAt: state.lastRunCompletedAt,
      lastRunStatus: state.lastRunStatus,
      lastRunError: state.lastRunError,
      lastTrigger: state.lastTrigger,
      nextScheduledRunAt: state.nextScheduledRunAt
    };
  }

  function isAuthorized(request) {
    if (!refreshToken) {
      return true;
    }

    const providedToken = request.get('x-refresh-token') || request.query.token || '';
    return providedToken === refreshToken;
  }

  function registerRoutes(server) {
    server.post('/api/nuclear-verdicts/refresh', async (request, response) => {
      if (!isAuthorized(request)) {
        response.status(403).json({ error: 'Refresh not authorized.' });
        return;
      }

      try {
        const result = await runRefresh('manual');
        response.status(result.alreadyRunning ? 202 : 200).json(result.status);
      } catch (error) {
        response.status(500).json({
          error: 'Refresh failed.',
          details: error instanceof Error ? error.message : String(error),
          status: getStatus()
        });
      }
    });

    server.get('/api/nuclear-verdicts/refresh', (request, response) => {
      if (!isAuthorized(request)) {
        response.status(403).json({ error: 'Refresh not authorized.' });
        return;
      }

      response.json(getStatus());
    });
  }

  function startScheduler() {
    scheduleNextRun();
  }

  return {
    getStatus,
    registerRoutes,
    runRefresh,
    startScheduler
  };
}

module.exports = {
  createNuclearVerdictRefreshService,
  DEFAULT_CRON_EXPRESSION
};
