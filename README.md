# JPML Dashboard

This repository contains the JPML multidistrict litigation dashboard and its supporting data pipeline.

## Project layout

- `jpml-server.js`: local Express server for the site and dashboard assets
- `jpml-dashboard.html`: primary internal dashboard entry point
- `src/config/site-pages.json`: central page registry for navigation and online/offline status
- `src/js/`: shared client-side behavior and dashboard logic
- `src/css/`: dashboard-specific stylesheets
- `src/partials/`: reusable HTML fragments such as the shared site header
- `data/`: parsed JPML snapshots and supporting lookup data
- `scripts/`: ingestion and parsing utilities for refreshing the dataset

See `docs/site-structure-and-offline-pages.md` for the current page/data layout, where raw podcast transcripts belong, and how to take a page offline without hand-editing navigation in multiple places.
