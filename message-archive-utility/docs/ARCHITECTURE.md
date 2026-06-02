# Architecture

Message Archive Utility is a local-first app for importing, searching, and exporting personal message archives. It is standalone inside `message-archive-utility/` and does not import app or website files from Home Basis Tracker, Car Care Log, or the root workspace.

## Product Layers

- `website/`: standalone product website and support pages.
- `frontend/`: React/Vite archive UI.
- `backend/`: FastAPI backend, SQLite archive database, importers, search, export, and backend tests.
- `desktop/`: Electron shell, local backend launcher, preload bridge, and packaging metadata.
- `scripts/`: local development, build, package, signing, and smoke-test scripts.
- `docs/`: data schema, privacy/security, import notes, and release checklists.

## Runtime Model

The desktop app starts a local backend on `127.0.0.1` and loads the frontend in Electron. The frontend talks only to the local backend. The desktop shell injects a per-process API token so protected backend endpoints cannot be called by unrelated local pages without the token.

In development, the backend can run from the app-local Python virtual environment. In packaged builds, the desktop app uses the bundled backend executable under the app resources directory.

The Tutorial Workspace is intentionally separate from this archive runtime. It uses static frontend sample messages and browser state only. Loading or resetting tutorial data does not call the import API and does not write records to SQLite.

## Data Model

The backend stores archive data in SQLite. The schema and import/export contract are documented in `docs/data-schema.md`.

Important record surfaces:

- contacts
- conversations
- participants
- messages
- attachment metadata
- copied attachment files

Real phone backups, message databases, attachments, and exports are private data and must stay out of Git.

## Import Paths

Implemented:

- Fake sample data import for development and smoke tests.
- iPhone local-backup import.
- Static frontend tutorial sample data for user practice.

Planned:

- iMazing CSV import.
- Android XML import.

Import documentation:

- `docs/iphone-backup-import.md`
- `docs/android-export-import.md`

## Export Paths

The backend supports local export of archived messages to CSV, PDF, and XLSX. The Tutorial Workspace includes browser-generated practice exports that teach the flow without touching the real archive. The installed-app smoke test verifies empty first launch state, fake-data import into temporary smoke storage, search, PDF export, Excel export, CSV export, and close/reopen persistence.

## Network Posture

The app does not use a cloud service for archive data. Runtime network access is limited to local loopback communication between the Electron frontend and the local backend. Packaged app checks verify local-only network exceptions and reject broad arbitrary network loads.

## Release Surface

Mac packaging builds the backend executable, builds the frontend, packages the Electron app, signs/notarizes the app and DMG, staples the ticket, and validates Gatekeeper assessment. Root scripts expose the standard validation vocabulary:

- `npm test`
- `npm run check:syntax`
- `npm run check:mac-package`
- `npm run smoke:packaged`
- `npm run smoke:dmg`
- `npm run pack:mac:dmg:signed`
