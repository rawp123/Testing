# Backend

FastAPI backend for the local-first message archive utility.

This backend uses SQLite for a local-first message archive. It supports fake sample data and a partial real iPhone local-backup import flow.

## Run

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

## Endpoints

- `GET /health`
- `POST /import/dummy-csv`
- `GET /conversations`
- `GET /conversations/{conversation_id}/messages`
- `GET /search?q=hello`
- `GET /export/messages.csv`
- `POST /import/iphone-backup/dry-run`
- `POST /import/iphone-backup/copy-sms-db`
- `POST /import/iphone-backup/validate-sms-db`
- `POST /import/iphone-backup/inspect-sms-db`
- `POST /import/iphone-backup/import-messages`

The sample importer is limited to the fake fixture at `tests/fixtures/sample_messages.csv`.
The iPhone dry-run endpoint reads `Manifest.db` metadata and locates the backup file for `Library/SMS/sms.db`.
The iPhone copy endpoint copies only the resolved backup file into ignored `data/imports/iphone/`.
The schema validation endpoint checks copied SQLite table names only. It does not read message contents.
The metadata inspection endpoint reports safe row counts and the `message.date` range only. It does not select message body, attributed body, payload, or attachment contents, and it does not import messages.
The message import endpoint maps handles, chats, chat-message joins, and message text into the normalized archive database. It reads `message.text` first and falls back to readable `attributedBody`/`payload_data` content when `message.text` is empty. It does not extract attachment files or attachment payload data, and it returns counts only.
