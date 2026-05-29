# Message Archive Utility

This repository contains the Message Archive Utility website, desktop app workspace, and legacy supporting experiments.

## Project layout

- `server.js`: local Express server for the static site
- `src/config/site-pages.json`: central page registry for navigation and online/offline status
- `src/js/`: shared client-side behavior
- `src/css/`: page-specific stylesheets
- `src/partials/`: reusable HTML fragments such as the shared site header
- `message-archive-utility/`: desktop app, backend, packaging, and release scripts
- `scripts/`: supporting utility scripts

See `docs/site-structure-and-offline-pages.md` for the current page/data layout, where raw podcast transcripts belong, and how to take a page offline without hand-editing navigation in multiple places.
