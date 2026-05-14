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

The sample importer is limited to the fake fixture at `tests/fixtures/sample_messages.csv`.
