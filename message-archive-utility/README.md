# Message Archive Utility

A local-first utility for importing, organizing, searching, tagging, and exporting your own text message archives.

This project is designed so private message data stays on your computer. Real phone backups, message databases, attachments, exports, and imported data should never be committed to GitHub.

## Privacy First

- Use only fake sample data inside this repository.
- Keep phone backups and exported message files outside the repo.
- Store local working data in ignored folders such as `data/`, `imports/`, `exports/`, `backups/`, `attachments/`, or `private/`.
- Do not commit `sms.db`, SQLite databases, attachments, iPhone backup files, Android exports, or any real message data.

The repository should be safe to make public even if you keep it private while developing.

## Planned Import Paths

1. iPhone local backup import
2. iMazing CSV import
3. Android XML import

The first scaffold includes only a fake-data CSV importer. Real iPhone extraction is intentionally not implemented yet.

## Backend Setup

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

The backend uses FastAPI and SQLite. By default it creates a local database path from `MESSAGE_ARCHIVE_DB_PATH`; keep that path outside Git if you use real data later.

The runnable scaffold imports only the fake CSV fixture through `POST /import/dummy-csv`.

## Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

The frontend is a small React app with fake sample conversations for the first version.

## Private Data Warning

Phone backups and exported message data are highly private. Keep them outside this repository, outside synced public folders, and out of commits. The `.gitignore` is intentionally strict to reduce accidental exposure.
