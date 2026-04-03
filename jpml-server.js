const express = require('express');
const path = require('path');
const { createNuclearVerdictRefreshService } = require('./lib/nuclearVerdictRefresh');

const rootDir = __dirname;
const port = Number.parseInt(process.env.PORT || '3000', 10);
const isProduction = process.env.NODE_ENV === 'production';

const staticMounts = [
  { route: '/', directory: 'src' },
  { route: '/data', directory: 'data' },
  { route: '/', directory: '.' }
];

function createStaticOptions() {
  if (isProduction) {
    return undefined;
  }

  return {
    etag: false,
    lastModified: false,
    maxAge: 0,
    setHeaders(response) {
      response.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
      response.setHeader('Pragma', 'no-cache');
      response.setHeader('Expires', '0');
    }
  };
}

function registerStaticMounts(server) {
  const staticOptions = createStaticOptions();

  staticMounts.forEach(({ route, directory }) => {
    server.use(route, express.static(path.join(rootDir, directory), staticOptions));
  });
}

function startServer() {
  const server = express();
  const nuclearVerdictRefresh = createNuclearVerdictRefreshService({ repoRoot: rootDir });

  server.disable('x-powered-by');
  server.use(express.json());

  registerStaticMounts(server);
  nuclearVerdictRefresh.registerRoutes(server);

  server.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
    if (!isProduction) {
      console.log('Development mode: static asset caching disabled');
    }
    nuclearVerdictRefresh.startScheduler();
  });
}

startServer();
