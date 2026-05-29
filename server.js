const express = require('express');
const fs = require('fs');
const path = require('path');

const rootDir = __dirname;
const port = Number.parseInt(process.env.PORT || '3000', 10);
const isProduction = process.env.NODE_ENV === 'production';
const pageRegistryPath = path.join(rootDir, 'src', 'config', 'site-pages.json');

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

function loadPageRegistry() {
  try {
    return JSON.parse(fs.readFileSync(pageRegistryPath, 'utf8'));
  } catch (error) {
    console.warn(`Could not load page registry at ${pageRegistryPath}: ${error.message}`);
    return {
      pages: []
    };
  }
}

function normalizePathname(pathname) {
  if (!pathname || pathname === '/') {
    return '/';
  }

  const indexNormalizedPathname = pathname.replace(/\/index\.html$/, '/');
  if (indexNormalizedPathname.endsWith('/') || path.extname(indexNormalizedPathname)) {
    return indexNormalizedPathname;
  }

  return `${indexNormalizedPathname}/`;
}

function matchesOfflinePage(pathname, page) {
  const normalizedPathname = normalizePathname(pathname);
  const paths = page.paths || [];
  const pathPrefixes = page.pathPrefixes || [];

  if (paths.some((pagePath) => normalizePathname(pagePath) === normalizedPathname || pagePath === pathname)) {
    return true;
  }

  return pathPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(prefix));
}

function registerPageAvailability(server) {
  const registry = loadPageRegistry();
  const offlinePages = (registry.pages || []).filter((page) => page.status === 'offline');

  if (!offlinePages.length) {
    return;
  }

  server.use((request, response, next) => {
    if (!['GET', 'HEAD'].includes(request.method)) {
      next();
      return;
    }

    const offlinePage = offlinePages.find((page) => matchesOfflinePage(request.path, page));
    if (!offlinePage) {
      next();
      return;
    }

    response.status(404).send(`${offlinePage.label || 'This page'} is offline.`);
  });
}

function startServer() {
  const server = express();

  server.disable('x-powered-by');
  server.use(express.json());

  registerPageAvailability(server);

  registerStaticMounts(server);

  server.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
    if (!isProduction) {
      console.log('Development mode: static asset caching disabled');
    }
  });
}

startServer();
