# Message Archive Utility

A local-first utility for importing, searching, and exporting iPhone message archives.

This project is designed so private message data stays on your computer. Real phone backups, message databases, attachments, exports, and imported data should never be committed to GitHub.

## Privacy First

- Use only fake sample data inside this repository.
- Keep phone backups and exported message files outside the repo.
- Store local working data in ignored folders such as `data/`, `imports/`, `exports/`, `backups/`, `attachments/`, or `private/`.
- Do not commit `sms.db`, SQLite databases, attachments, iPhone backup files, Android exports, or any real message data.

The repository should be safe to make public even if you keep it private while developing.

## Product Layout

- `website/`: standalone product website and support pages.
- `frontend/`: React/Vite browser UI for the archive app.
- `backend/`: FastAPI backend, importers, exports, database schema, and tests.
- `desktop/`: Electron shell and packaging metadata.
- `scripts/`: product-local development, build, launch, and smoke-test scripts.
- `docs/`: architecture, privacy/security, import, QA, and Mac release notes.
- `fixtures/`: optional QA fixture guidance. Private message archives belong in ignored subfolders.

Message Archive Utility is standalone inside `message-archive-utility/`. It does not import app or website files from Home Basis Tracker, Car Care Log, or the root workspace.

Run the product website locally:

```bash
npm run dev:website
```

## Import Paths

Implemented:

1. Fake sample CSV import for development and smoke tests
2. iPhone local backup import

Planned:

1. iMazing CSV import
2. Android XML import

The current implementation includes a fake-data CSV importer and a real iPhone local-backup importer. The iPhone importer can run as a one-click detected-backup import, or as a step-by-step troubleshooting flow. It locates and copies `sms.db` from a local backup, validates and inspects the copied database, and imports contacts, conversations, participants, message text, attachment metadata, and linked attachment files into the local archive database. Message text is read from `message.text` first, with a fallback for readable `attributedBody`/`payload_data` content when `message.text` is empty.

Linked attachment files are copied only when the backup folder is supplied during import. In browser development, copied files stay in ignored private storage under `data/attachments/iphone/`. In desktop development, copied files stay under the desktop app data folder described below.

## One-Command Development

From the `message-archive-utility` folder:

```bash
npm run dev
```

This starts the FastAPI backend and Vite frontend together. Press `Ctrl+C` once to stop both.

The command assumes the backend virtual environment and frontend dependencies are already installed. For first-time setup, use the backend and frontend setup steps below.

Optional ports:

```bash
BACKEND_PORT=8001 FRONTEND_PORT=5174 npm run dev
```

The backend checks the local macOS MobileSync backup folder through the
token-protected import API. To point the app at a specific backup folder:

```bash
MESSAGE_ARCHIVE_IPHONE_BACKUP_PATHS="$HOME/Library/Application Support/MobileSync/Backup/<backup-folder-id>" npm run dev
```

## Desktop Development

The desktop wrapper opens the React UI in an Electron window and starts a local
FastAPI backend with private desktop storage.

From the `message-archive-utility` folder:

```bash
npm run dev:desktop
```

The desktop dev command starts or reuses the Vite frontend on `127.0.0.1:5173`.
Electron starts the FastAPI backend on `127.0.0.1:8765`, waits for `/health`, and
then loads the UI. If a desktop-mode backend is already running on port `8765`,
Electron reuses it. If another process owns that port, Electron shows an error.

When Electron starts the backend itself, private app data is stored outside the
repository under the macOS application support folder:

```text
~/Library/Application Support/Message Archive Utility/
```

The desktop database path is:

```text
~/Library/Application Support/Message Archive Utility/message-archive.sqlite3
```

Copied iPhone `sms.db` files are stored under `imports/iphone/` inside that same
folder, and copied attachments are stored under `attachments/iphone/`. Existing
repo-local data is not moved or deleted automatically. If Electron reuses a
backend that was already running, that backend keeps whatever data paths it was
started with.

The browser-based dev flow still works with `npm run dev`.

The desktop backend expects its Python virtual environment at the app-local path:

```text
message-archive-utility/.venv
```

From the `message-archive-utility` folder, set it up with:

```bash
python3 -m venv .venv
.venv/bin/python -m pip install -r backend/requirements.txt
```

To build the frontend for static Electron loading:

```bash
npm run build:desktop
```

That command bakes the desktop backend URL into the frontend build so the
packaged/static UI can call the local backend directly from Electron.

To open the built desktop app without the Vite dev server:

```bash
npm run start:desktop
```

To install a clickable desktop shortcut on macOS or Linux:

```bash
npm run install:shortcut
```

On macOS this creates `Message Archive Utility.app` on the Desktop. On Linux it
creates `message-archive-utility.desktop` on the Desktop. Both launch the static
Electron app and let Electron start the local FastAPI backend with private
desktop storage. The launcher also handles the reduced PATH macOS uses for apps
opened from Finder, so Node installed through Homebrew or a login shell can still
be found.

### Desktop Troubleshooting

The desktop app should be tested on the target Mac whenever possible, because
that is the environment that has the local iPhone MobileSync backups and the
normal macOS GUI runtime.

In Linux dev containers or other headless environments, Electron may fail to
launch if native GUI libraries are missing. For example, an error such as
`libatk-1.0.so.0: cannot open shared object file` means the container is missing
a system library that Electron needs to create a window. That is an environment
dependency issue, not evidence that the message import, export, or frontend build
logic is broken.

The desktop frontend build can succeed even when Electron cannot launch inside
the container. The next validation step is to run the same build/start commands
on the Mac host:

```bash
npm run build:desktop
npm run start:desktop
```

## Backend Setup

```bash
cd message-archive-utility
python3 -m venv .venv
source .venv/bin/activate
pip install -r backend/requirements.txt
cd backend
uvicorn server.main:app --reload
```

The backend uses FastAPI and SQLite. By default it creates a local database path from `MESSAGE_ARCHIVE_DB_PATH`; keep that path outside Git if you use real data.

The fake CSV fixture is available through `POST /import/dummy-csv`. The iPhone backup flow is documented in `docs/iphone-backup-import.md`.

## Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

The frontend is a small React app for browsing the local archive, loading fake sample data, and running the iPhone backup import flow against the local backend.

## Release Validation

Useful validation commands from `message-archive-utility/`:

```bash
npm test
npm run check:syntax
npm run pack:mac
npm run check:mac-package
npm run smoke:packaged
git diff --check
```

Release builds use the signed DMG script:

```bash
source ~/.message-archive-signing-env
npm run pack:mac:dmg:signed
```

The signing environment file must stay outside Git and must not be printed. The
script builds the backend executable, builds the desktop frontend, packages the
Mac app, signs and notarizes the app, signs and notarizes the DMG, staples the
DMG, and validates the stapled ticket.

After installing or copying the app from the DMG, run the local installed-app
smoke test with fake sample data only:

```bash
MESSAGE_ARCHIVE_APP="/Applications/Message Archive Utility.app" npm run smoke:installed
```

To smoke-test the current mounted DMG artifact with fake sample data:

```bash
npm run smoke:dmg
```

For unsigned local package verification before distribution:

```bash
npm run pack:mac
npm run check:mac-package
```

The package check verifies the bundled backend executable, frontend bundle,
local-only network permissions, defensive privacy descriptions, and expected app
identifier.

See `docs/HUMAN_REVIEW_CHECKLIST.md`, `docs/MAC_RELEASE_CHECKLIST.md`, and
`docs/REAL_DATA_QA.md` for the full release and real-data QA checklists.

For a temporary test install, point `MESSAGE_ARCHIVE_APP` at the copied app under
`/tmp`. The smoke test verifies bundled-backend launch, `/health`, fake import,
search, PDF export, Excel export, CSV export, and close/reopen persistence.

Optional Gatekeeper checks:

```bash
spctl --assess --type open --context context:primary-signature -vvv "release/mac/Message Archive Utility-0.1.0-arm64.dmg"
spctl --assess --type execute -vvv "/Applications/Message Archive Utility.app"
```

## Private Data Warning

Phone backups and exported message data are highly private. Keep them outside this repository, outside synced public folders, and out of commits. The `.gitignore` is intentionally strict to reduce accidental exposure.
