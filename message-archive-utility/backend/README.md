# Backend

FastAPI backend for the local-first message archive utility.

This backend uses SQLite for a local-first message archive. It supports a fake sample-data endpoint for development and smoke tests, plus a partial real iPhone local-backup import flow.

## Layout

- `server/`: FastAPI server package, route handlers, importers, export services, search helpers, and database schema.
- `tests/`: backend unit and integration tests.
- `desktop_server.py`: packaged backend entry point used by the Electron desktop app.

## Run

From the `message-archive-utility` product folder, you can start the backend and frontend together:

```bash
npm run dev
```

To run only the backend:

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn server.main:app --reload
```

## Endpoints

- `GET /health`
- `POST /import/dummy-csv` for development and smoke tests
- `GET /conversations`
- `GET /conversations/{conversation_id}/messages`
- `GET /search?q=hello`
- `GET /export/messages.csv`
- `POST /import/iphone-backup/dry-run`
- `POST /import/iphone-backup/copy-sms-db`
- `POST /import/iphone-backup/validate-sms-db`
- `POST /import/iphone-backup/inspect-sms-db`
- `POST /import/iphone-backup/import-messages`

The sample importer is limited to the fake fixture at `tests/fixtures/sample_messages.csv`. The user-facing Tutorial Workspace does not call this endpoint; it uses static frontend sample data so tutorial records do not enter the real archive database.
The iPhone dry-run endpoint reads `Manifest.db` metadata and locates the backup file for `Library/SMS/sms.db`.
The iPhone copy endpoint copies only the resolved backup file into ignored `data/imports/iphone/`.
The schema validation endpoint checks copied SQLite table names only. It does not read message contents.
The metadata inspection endpoint reports safe row counts and the `message.date` range only. It does not select message body, attributed body, payload, or attachment contents, and it does not import messages.
The message import endpoint maps handles, chats, chat-message joins, message text, attachment metadata, and linked attachment files into the normalized archive database. It reads `message.text` first and falls back to readable `attributedBody`/`payload_data` content when `message.text` is empty. When `backup_folder_path` is supplied during import, it resolves linked attachment files through `Manifest.db` and copies them into ignored private storage. It does not read attachment payload data from `sms.db`, and it returns counts only.
