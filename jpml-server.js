const express = require('express');
const path = require('path');
const {
  checkForUpdates,
  getCurrentStatus,
  importListing
} = require('./src/server/jpml-updater-service');

const server = express();
const rootDir = __dirname;
const port = Number(process.env.PORT) || 3000;

server.use(express.json());

server.get('/api/jpml/updater/status', async (req, res) => {
  try {
    const refresh = req.query.refresh === '1' || req.query.refresh === 'true';
    const payload = refresh ? await checkForUpdates() : await getCurrentStatus();
    res.json(payload);
  } catch (error) {
    console.error('[JPML updater] Status route failed:', error);
    res.status(500).json({
      error: error.message || 'Unable to load JPML updater status.'
    });
  }
});

server.post('/api/jpml/updater/check', async (_req, res) => {
  try {
    const payload = await checkForUpdates();
    res.json(payload);
  } catch (error) {
    console.error('[JPML updater] Check route failed:', error);
    res.status(500).json({
      error: error.message || 'Unable to check for a new JPML listing.'
    });
  }
});

server.post('/api/jpml/updater/import', async (req, res) => {
  try {
    const payload = await importListing({
      sourceUrl: req.body?.url
    });
    res.json(payload);
  } catch (error) {
    console.error('[JPML updater] Import route failed:', error);
    res.status(500).json({
      error: error.message || 'Unable to import JPML listing.',
      state: error.updaterState || null
    });
  }
});

const staticMounts = [
  { route: '/', directory: 'src' },
  { route: '/data', directory: 'data' },
  { route: '/', directory: '.' }
];

staticMounts.forEach(({ route, directory }) => {
  server.use(route, express.static(path.join(rootDir, directory)));
});

server.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
