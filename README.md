# Product Workspace

This repository contains the public portfolio, Message Archive Utility, and older static experiments and utilities.

## Current Product Workspace

- `message-archive-utility/`: Message Archive Utility website, React frontend, FastAPI backend, Electron desktop shell, packaging, and release scripts.

## Extracted Products

- [Home Ledger](https://github.com/rawp123/home-ledger) is maintained in its own private repository and deployed at [home-ledger-web.onrender.com](https://home-ledger-web.onrender.com/).
- [Car Care Log](https://github.com/rawp123/car-care-log) is maintained in its own private repository with its own cross-platform CI and release workflow.

The small `home-ledger/` and `car-care-log/` paths retained here are compatibility pages for old public URLs; they are not application source trees. The root package owns only the root static site and utility scripts.

## Root Static Site

- `server.js`: local Express server for root-level static pages and legacy experiments.
- `src/config/site-pages.json`: page registry for root navigation and online/offline status.
- `src/js/`, `src/css/`, `src/partials/`: root static-site assets.
- `scripts/`: root-only utility scripts such as scrapers and podcast-data tooling.

Run the root static site:

```bash
npm run start:dev
```

For Message Archive Utility development commands, open its README. Develop extracted products from their standalone repositories.
