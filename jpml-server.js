const express = require('express');
const path = require('path');

const rootDir = __dirname;
const port = Number.parseInt(process.env.PORT || '3000', 10);
const isProduction = process.env.NODE_ENV === 'production';
const dashboardRoute = '/jpml-dashboard.html';

const staticMounts = [
  { route: '/', directory: 'src' },
  { route: '/data', directory: 'data' },
  { route: '/', directory: '.' }
];

const allowedExactPaths = new Set([
  dashboardRoute,
  '/style.css',
  '/src/css/litigation-analytics.css',
  '/src/css/jpml-dashboard.css',
  '/src/js/header.js',
  '/src/js/jpml-dashboard.js',
  '/src/partials/header.html',
  '/data/courtlistener.json',
  '/data/districts.json',
  '/data/mdl/index.json',
  '/data/pdfs/index.json'
]);

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

function isAllowedDashboardPath(pathname) {
  if (allowedExactPaths.has(pathname)) {
    return true;
  }

  if (pathname.startsWith('/data/mdl/') && pathname.endsWith('.json')) {
    return true;
  }

  if (pathname.startsWith('/data/pdfs/') && pathname.endsWith('.pdf')) {
    return true;
  }

  return false;
}

function restrictToDashboard(server) {
  server.use((request, response, next) => {
    if (!['GET', 'HEAD'].includes(request.method)) {
      response.status(404).send('Not found');
      return;
    }

    if (request.path === '/' || request.path === '/jpml-dashboard' || request.path === '/jpml-dashboard/') {
      response.redirect(302, dashboardRoute);
      return;
    }

    if (isAllowedDashboardPath(request.path)) {
      next();
      return;
    }

    response.status(404).send('Not found');
  });
}

function startServer() {
  const server = express();

  server.disable('x-powered-by');
  server.use(express.json());

  restrictToDashboard(server);
  registerStaticMounts(server);

  server.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
    if (!isProduction) {
      console.log('Development mode: static asset caching disabled');
    }
  });
}

startServer();
