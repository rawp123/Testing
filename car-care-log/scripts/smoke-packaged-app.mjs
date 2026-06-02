import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

function argValue(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : '';
}

const skipMissing = process.argv.includes('--skip-missing');
const appPath = path.resolve(argValue('--app') || 'release/mac-arm64/Car Care Log.app');
const executablePath =
  process.platform === 'darwin'
    ? path.join(appPath, 'Contents', 'MacOS', 'Car Care Log')
    : appPath;

if (!fs.existsSync(executablePath)) {
  const message = `Packaged app executable was not found at ${executablePath}. Run npm run package:mac first.`;
  if (skipMissing) {
    console.warn(`Skipping packaged smoke test: ${message}`);
    process.exit(0);
  }
  throw new Error(message);
}

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'car-care-log-packaged-smoke-'));
const smokeFile = path.join(tempRoot, 'smoke-result.json');
const userDataDir = path.join(tempRoot, 'user-data');

try {
  const result = spawnSync(executablePath, [], {
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: '',
      CAR_CARE_LOG_SMOKE_TEST: '1',
      CAR_CARE_LOG_SMOKE_FILE: smokeFile,
      CAR_CARE_LOG_SMOKE_USER_DATA: userDataDir
    },
    stdio: 'pipe',
    timeout: 30000,
    encoding: 'utf8'
  });

  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`Packaged app smoke test exited with ${result.status}.\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`);
  }
  if (!fs.existsSync(smokeFile)) {
    throw new Error(`Packaged app did not write smoke result to ${smokeFile}.\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`);
  }

  const smoke = JSON.parse(fs.readFileSync(smokeFile, 'utf8'));
  const requiredTrueFields = ['hasDatabase', 'hasStorage', 'databaseReady', 'attachmentsReady', 'intakeReady'];
  for (const field of requiredTrueFields) {
    if (smoke[field] !== true) {
      throw new Error(`Packaged smoke result did not report ${field}: ${JSON.stringify(smoke, null, 2)}`);
    }
  }
  if (smoke.status !== 'ready') {
    throw new Error(`Packaged smoke result was not ready: ${JSON.stringify(smoke, null, 2)}`);
  }

  console.log(`Packaged app smoke test passed using temporary user data at ${userDataDir}.`);
} finally {
  fs.rmSync(tempRoot, { recursive: true, force: true });
}
