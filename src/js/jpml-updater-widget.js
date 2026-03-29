(function initJpmlUpdaterWidget() {
  const elements = {
    pill: document.getElementById('jpml-updater-pill'),
    statusText: document.getElementById('jpml-updater-status-text'),
    currentReportDate: document.getElementById('jpml-current-report-date'),
    currentFileName: document.getElementById('jpml-current-file-name'),
    lastChecked: document.getElementById('jpml-last-checked'),
    lastImport: document.getElementById('jpml-last-import'),
    candidate: document.getElementById('jpml-updater-candidate'),
    remoteReportDate: document.getElementById('jpml-remote-report-date'),
    remoteFileName: document.getElementById('jpml-remote-file-name'),
    remoteSourceUrl: document.getElementById('jpml-remote-source-url'),
    checkButton: document.getElementById('jpml-updater-check'),
    importButton: document.getElementById('jpml-updater-import'),
    retryButton: document.getElementById('jpml-updater-retry'),
    feedback: document.getElementById('jpml-updater-feedback')
  };

  if (!elements.pill) return;

  let latestState = null;

  function formatReportDate(isoDate) {
    if (!isoDate) return 'Not imported yet';
    const date = new Date(`${isoDate}T00:00:00`);
    return Number.isNaN(date.getTime())
      ? isoDate
      : date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  }

  function formatTimestamp(value, emptyText) {
    if (!value) return emptyText;
    const date = new Date(value);
    return Number.isNaN(date.getTime())
      ? value
      : date.toLocaleString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
          hour: 'numeric',
          minute: '2-digit'
        });
  }

  function setBusy(isBusy) {
    [
      elements.checkButton,
      elements.importButton,
      elements.retryButton
    ].forEach((button) => {
      if (button) button.disabled = isBusy;
    });
  }

  function showFeedback(message, state = 'info') {
    if (!elements.feedback) return;
    if (!message) {
      elements.feedback.hidden = true;
      elements.feedback.textContent = '';
      elements.feedback.dataset.state = '';
      return;
    }

    elements.feedback.hidden = false;
    elements.feedback.textContent = message;
    elements.feedback.dataset.state = state;
  }

  function statusConfig(state) {
    switch (state) {
      case 'up-to-date':
        return { label: 'Up to date', pillState: 'success' };
      case 'update-available':
        return { label: 'Update available', pillState: 'warning' };
      case 'unknown':
        return { label: 'Could not verify', pillState: 'muted' };
      case 'error':
        return { label: 'Import failed', pillState: 'error' };
      default:
        return { label: 'Checking…', pillState: 'loading' };
    }
  }

  function render(state) {
    latestState = state;

    const config = statusConfig(state.updaterStatus);
    elements.pill.textContent = config.label;
    elements.pill.dataset.state = config.pillState;
    elements.statusText.textContent = state.updaterMessage || 'JPML updater ready.';

    elements.currentReportDate.textContent = formatReportDate(state.current?.reportDate);
    elements.currentFileName.textContent = state.current?.fileName || 'No source file recorded';
    elements.lastChecked.textContent = formatTimestamp(state.metadata?.lastCheckedAt, 'Not checked yet');

    const importSummary = state.metadata?.lastImportStatus === 'success'
      ? formatTimestamp(state.metadata?.lastImportAt, 'No imports yet')
      : state.metadata?.lastImportStatus === 'failed'
        ? `Failed ${formatTimestamp(state.metadata?.lastImportAt, '')}`.trim()
        : 'No imports yet';
    elements.lastImport.textContent = importSummary;

    const remote = state.remote;
    const showRemote = Boolean(remote?.sourceUrl);
    elements.candidate.hidden = !showRemote;

    if (showRemote) {
      elements.remoteReportDate.textContent = remote.reportDate
        ? `${formatReportDate(remote.reportDate)} (${remote.dateSource === 'pdf' ? 'from PDF' : 'from filename'})`
        : 'Date not confirmed';
      elements.remoteFileName.textContent = remote.fileName || 'Unknown file';
      elements.remoteSourceUrl.href = remote.sourceUrl;
      elements.remoteSourceUrl.textContent = remote.sourceUrl;
    }

    elements.importButton.hidden = state.updaterStatus !== 'update-available' || !remote?.sourceUrl;
    elements.retryButton.hidden = state.updaterStatus !== 'unknown' && state.updaterStatus !== 'error';

    if (state.metadata?.lastImportStatus === 'failed' && state.metadata?.lastImportError) {
      showFeedback(state.metadata.lastImportError, 'error');
    } else {
      showFeedback('');
    }
  }

  async function requestJson(url, options) {
    const response = await fetch(url, options);
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const apiMissing =
        response.status === 404 &&
        typeof url === 'string' &&
        url.startsWith('/api/jpml/updater');
      const error = new Error(
        apiMissing
          ? 'The JPML updater API is not available on this preview server. Open the site through jpml-server.js or npm start.'
          : (payload.error || `Request failed with status ${response.status}`)
      );
      error.payload = payload;
      throw error;
    }
    return payload;
  }

  async function loadStatus({ refresh = true, interactive = false } = {}) {
    setBusy(true);
    showFeedback('');
    elements.pill.textContent = 'Checking…';
    elements.pill.dataset.state = 'loading';

    try {
      const payload = interactive
        ? await requestJson('/api/jpml/updater/check', { method: 'POST' })
        : await requestJson(
            refresh
              ? '/api/jpml/updater/status?refresh=1'
              : '/api/jpml/updater/status'
          );
      render(payload);
    } catch (error) {
      console.error('[JPML updater] Failed to load status:', error);
      render({
        updaterStatus: 'unknown',
        updaterMessage: 'Could not verify JPML listing status.',
        current: latestState?.current || null,
        metadata: latestState?.metadata || null,
        remote: null
      });
      showFeedback(error.message, 'error');
    } finally {
      setBusy(false);
    }
  }

  async function triggerImport(url) {
    setBusy(true);
    showFeedback('');
    elements.pill.textContent = 'Importing…';
    elements.pill.dataset.state = 'loading';

    try {
      const payload = await requestJson('/api/jpml/updater/import', {
        method: 'POST',
        headers: {
          'content-type': 'application/json'
        },
        body: JSON.stringify(url ? { url } : {})
      });
      render(payload);
      showFeedback(payload.updaterMessage || 'JPML listing imported successfully.', 'success');
    } catch (error) {
      console.error('[JPML updater] Import failed:', error);
      if (error.payload?.state) {
        render(error.payload.state);
      } else {
        render({
          updaterStatus: 'error',
          updaterMessage: 'Import failed.',
          current: latestState?.current || null,
          metadata: latestState?.metadata || null,
          remote: latestState?.remote || null
        });
      }
      showFeedback(error.message, 'error');
    } finally {
      setBusy(false);
    }
  }

  elements.checkButton?.addEventListener('click', (event) => {
    event.preventDefault();
    loadStatus({ refresh: true, interactive: true });
  });
  elements.retryButton?.addEventListener('click', (event) => {
    event.preventDefault();
    loadStatus({ refresh: true, interactive: true });
  });
  elements.importButton?.addEventListener('click', (event) => {
    event.preventDefault();
    triggerImport(latestState?.remote?.sourceUrl || null);
  });

  loadStatus({ refresh: true });
})();
