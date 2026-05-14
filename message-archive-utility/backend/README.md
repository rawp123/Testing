# Backend

FastAPI backend for the local-first message archive utility.

This scaffold uses SQLite and fake sample data only. Real phone backup extraction is not implemented yet.

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

The sample importer is limited to the fake fixture at `tests/fixtures/sample_messages.csv`.
The iPhone backup endpoint is a dry-run locator only. It reads `Manifest.db` metadata and does not copy or parse `sms.db`.
The iPhone copy endpoint copies only the resolved backup file into ignored `data/imports/iphone/` and still does not parse messages.
The schema validation endpoint checks copied SQLite table names only. It does not read message contents.
The metadata inspection endpoint reports safe row counts and the `message.date` range only. It does not select message body, attributed body, payload, or attachment contents, and it does not import messages.
