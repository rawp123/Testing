# JPML Dashboard

This repository contains the JPML multidistrict litigation dashboard and its supporting data pipeline.

## Project layout

- `jpml-server.js`: local Express server for the site and dashboard assets
- `jpml-dashboard.html`: primary internal dashboard entry point
- `src/js/`: shared client-side behavior and dashboard logic
- `src/css/`: dashboard-specific stylesheets
- `src/partials/`: reusable HTML fragments such as the shared site header
- `data/`: parsed JPML snapshots and supporting lookup data
- `scripts/`: ingestion and parsing utilities for refreshing the dataset
