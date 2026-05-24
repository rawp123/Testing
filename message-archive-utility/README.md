# Message Archive Utility

A local-first utility for importing, organizing, searching, tagging, and exporting your own text message archives.

This project is designed so private message data stays on your computer. Real phone backups, message databases, attachments, exports, and imported data should never be committed to GitHub.

## Privacy First

- Use only fake sample data inside this repository.
- Keep phone backups and exported message files outside the repo.
- Store local working data in ignored folders such as `data/`, `imports/`, `exports/`, `backups/`, `attachments/`, or `private/`.
- Do not commit `sms.db`, SQLite databases, attachments, iPhone backup files, Android exports, or any real message data.

The repository should be safe to make public even if you keep it private while developing.

## Import Paths

1. iPhone local backup import
2. iMazing CSV import
3. Android XML import

The current implementation includes a fake-data CSV importer and a real iPhone local-backup importer. The iPhone importer can run as a one-click detected-backup import, or as a step-by-step troubleshooting flow. It locates and copies `sms.db` from a local backup, validates and inspects the copied database, and imports contacts, conversations, participants, message text, attachment metadata, and linked attachment files into the local archive database. Message text is read from `message.text` first, with a fallback for readable `attributedBody`/`payload_data` content when `message.text` is empty.

Linked attachment files are copied only when the backup folder is supplied during import. In browser development, copied files stay in ignored private storage under `data/attachments/iphone/`. In desktop development, copied files stay under the desktop app data folder described below.

## One-Command Development

From the repository root:

```bash
npm run dev:message-archive
```

This starts the FastAPI backend and Vite frontend together. Press `Ctrl+C` once to stop both.

The command assumes the backend virtual environment and frontend dependencies are already installed. For first-time setup, use the backend and frontend setup steps below.

Optional ports:

```bash
BACKEND_PORT=8001 FRONTEND_PORT=5174 npm run dev:message-archive
```

The dev command auto-detects the first iPhone backup under the local macOS
MobileSync backup folder when one is available. To point the app at a specific
backup folder:

```bash
MESSAGE_ARCHIVE_IPHONE_BACKUP_PATHS="$HOME/Library/Application Support/MobileSync/Backup/<backup-folder-id>" npm run dev:message-archive
```

## Desktop Development

The desktop wrapper opens the React UI in an Electron window and starts a local
FastAPI backend with private desktop storage.

From the repository root:

```bash
npm run dev:message-archive:desktop
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

The browser-based dev flow still works with `npm run dev:message-archive`.

To build the frontend for static Electron loading:

```bash
npm run build:message-archive:desktop
```

That command bakes the desktop backend URL into the frontend build so the
packaged/static UI can call the local backend directly from Electron.

To open the built desktop app without the Vite dev server:

```bash
npm run start:message-archive:desktop
```

To install a clickable desktop shortcut on macOS or Linux:

```bash
npm run install:message-archive:shortcut
```

On macOS this creates `Message Archive Utility.app` on the Desktop. On Linux it
creates `message-archive-utility.desktop` on the Desktop. Both launch the static
Electron app and let Electron start the local FastAPI backend with private
desktop storage. The launcher also handles the reduced PATH macOS uses for apps
opened from Finder, so Node installed through Homebrew or a login shell can still
be found.

## Backend Setup

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
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

## Private Data Warning

Phone backups and exported message data are highly private. Keep them outside this repository, outside synced public folders, and out of commits. The `.gitignore` is intentionally strict to reduce accidental exposure.
