# Product Workspace

This repository contains several independent product workspaces plus older static experiments and utilities.

## Independent Products

- `message-archive-utility/`: Message Archive Utility website, React frontend, FastAPI backend, Electron desktop shell, packaging, and release scripts.
- `home-ledger/`: Home Basis Tracker website, browser frontend, local data services, Electron desktop shell, packaging, and validation scripts.
- `car-care-log/`: Car Care Log website, Electron/React frontend, local desktop backend, shared product contracts, packaging, and tests.

Each product should be developed from inside its own folder. The root package is only for the remaining root-level static site and utility scripts; it no longer owns product app commands.

## Root Static Site

- `server.js`: local Express server for root-level static pages and legacy experiments.
- `src/config/site-pages.json`: page registry for root navigation and online/offline status.
- `src/js/`, `src/css/`, `src/partials/`: root static-site assets.
- `scripts/`: root-only utility scripts such as scrapers and podcast-data tooling.

Run the root static site:

```bash
npm run start:dev
```

For product development commands, open the relevant product README.
