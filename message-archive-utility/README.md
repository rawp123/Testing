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

The current implementation includes a fake-data CSV importer and a partial real iPhone local-backup importer. The iPhone importer can locate and copy `sms.db` from a local backup, validate and inspect the copied database, and import contacts, conversations, participants, message text, attachment metadata, and linked attachment files into the local archive database. Message text is read from `message.text` first, with a fallback for readable `attributedBody`/`payload_data` content when `message.text` is empty.

Linked attachment files are copied only when the backup folder is supplied during import. Copied files stay in ignored private storage under `data/attachments/iphone/`.

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
