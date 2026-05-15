from pathlib import Path
import os
import sqlite3

from fastapi import FastAPI, HTTPException, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse
from pydantic import BaseModel

from app.importers.dummy_csv import import_sample_csv
from app.importers.iphone_backup import (
    SmsDbNotFoundError,
    UnsafeBackupPathError,
    copy_sms_db_from_backup,
    import_copied_sms_db_messages,
    inspect_copied_sms_db_metadata,
    locate_sms_db_dry_run,
    validate_copied_sms_db,
)
from app.services.export_csv import export_messages_csv
from app.services.search import search_messages


BACKEND_DIR = Path(__file__).resolve().parents[1]
PROJECT_DIR = BACKEND_DIR.parent
SCHEMA_PATH = BACKEND_DIR / "app" / "db" / "schema.sql"
SAMPLE_CSV_PATH = BACKEND_DIR / "tests" / "fixtures" / "sample_messages.csv"
DEFAULT_DB_PATH = PROJECT_DIR / "data" / "message_archive.sqlite3"

app = FastAPI(title="Message Archive Utility", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class IPhoneBackupDryRunRequest(BaseModel):
    backup_folder_path: str


class IPhoneSmsDbValidationRequest(BaseModel):
    copied_sms_db_path: str


def get_db_path() -> Path:
    configured_path = Path(os.getenv("MESSAGE_ARCHIVE_DB_PATH", DEFAULT_DB_PATH))
    if not configured_path.is_absolute():
        configured_path = PROJECT_DIR / configured_path
    return configured_path


def get_connection() -> sqlite3.Connection:
    db_path = get_db_path()
    db_path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def initialize_database() -> None:
    with get_connection() as conn:
        conn.executescript(SCHEMA_PATH.read_text())


@app.on_event("startup")
def startup() -> None:
    initialize_database()


@app.api_route("/", methods=["GET", "HEAD"])
def root() -> RedirectResponse:
    return RedirectResponse("http://localhost:5173", status_code=307)


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "storage": "local"}


@app.get("/archive/stats")
def archive_stats() -> dict:
    with get_connection() as conn:
        return build_archive_stats(conn)


@app.post("/import/dummy-csv")
def import_dummy_csv() -> dict:
    with get_connection() as conn:
        imported = import_sample_csv(conn, SAMPLE_CSV_PATH)
    return {"imported_messages": imported, "source": "fake_sample_csv"}


@app.post("/dev/import-sample")
def import_sample() -> dict:
    return import_dummy_csv()


@app.post("/import/iphone-backup/dry-run")
def iphone_backup_dry_run(request: IPhoneBackupDryRunRequest) -> dict:
    try:
        return locate_sms_db_dry_run(request.backup_folder_path)
    except FileNotFoundError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    except NotADirectoryError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    except PermissionError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    except sqlite3.DatabaseError as error:
        raise HTTPException(status_code=400, detail="Manifest.db could not be read.") from error


@app.post("/import/iphone-backup/copy-sms-db")
def iphone_backup_copy_sms_db(request: IPhoneBackupDryRunRequest) -> dict:
    try:
        return copy_sms_db_from_backup(request.backup_folder_path, PROJECT_DIR)
    except SmsDbNotFoundError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    except FileNotFoundError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    except NotADirectoryError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    except UnsafeBackupPathError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    except FileExistsError as error:
        raise HTTPException(status_code=409, detail=str(error)) from error
    except sqlite3.DatabaseError as error:
        raise HTTPException(status_code=400, detail="Manifest.db could not be read.") from error


@app.post("/import/iphone-backup/validate-sms-db")
def iphone_backup_validate_sms_db(request: IPhoneSmsDbValidationRequest) -> dict:
    try:
        return validate_copied_sms_db(request.copied_sms_db_path, PROJECT_DIR)
    except FileNotFoundError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    except UnsafeBackupPathError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    except sqlite3.DatabaseError as error:
        raise HTTPException(status_code=400, detail="Copied sms.db could not be read.") from error


@app.post("/import/iphone-backup/inspect-sms-db")
def iphone_backup_inspect_sms_db(request: IPhoneSmsDbValidationRequest) -> dict:
    try:
        return inspect_copied_sms_db_metadata(request.copied_sms_db_path, PROJECT_DIR)
    except FileNotFoundError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    except UnsafeBackupPathError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    except sqlite3.DatabaseError as error:
        raise HTTPException(status_code=400, detail="Copied sms.db could not be read.") from error


@app.post("/import/iphone-backup/import-messages")
def iphone_backup_import_messages(request: IPhoneSmsDbValidationRequest) -> dict:
    try:
        with get_connection() as conn:
            return import_copied_sms_db_messages(
                request.copied_sms_db_path,
                PROJECT_DIR,
                conn,
            )
    except FileNotFoundError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    except UnsafeBackupPathError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    except sqlite3.DatabaseError as error:
        raise HTTPException(status_code=400, detail="Copied sms.db could not be read.") from error


@app.get("/conversations")
def list_conversations() -> dict:
    with get_connection() as conn:
        rows = conn.execute(
            """
            SELECT
              conversations.id,
              conversations.title,
              conversations.updated_at,
              MAX(messages.sent_at) AS last_message_at,
              COUNT(DISTINCT messages.id) AS message_count,
              GROUP_CONCAT(DISTINCT contacts.display_name) AS participants
            FROM conversations
            LEFT JOIN messages ON messages.conversation_id = conversations.id
            LEFT JOIN conversation_participants
              ON conversation_participants.conversation_id = conversations.id
            LEFT JOIN contacts ON contacts.id = conversation_participants.contact_id
            GROUP BY conversations.id
            ORDER BY COALESCE(last_message_at, conversations.updated_at) DESC
            """
        ).fetchall()

    return {
        "conversations": [
            {
                "id": row["id"],
                "title": row["title"] or "Untitled conversation",
                "last_message_at": row["last_message_at"],
                "message_count": row["message_count"],
                "participants": split_participants(row["participants"]),
                "tags": [],
            }
            for row in rows
        ]
    }


@app.get("/conversations/{conversation_id}/messages")
def list_conversation_messages(conversation_id: int) -> dict:
    with get_connection() as conn:
        conversation = conn.execute(
            """
            SELECT
              conversations.id,
              conversations.title,
              GROUP_CONCAT(DISTINCT contacts.display_name) AS participants
            FROM conversations
            LEFT JOIN conversation_participants
              ON conversation_participants.conversation_id = conversations.id
            LEFT JOIN contacts ON contacts.id = conversation_participants.contact_id
            WHERE conversations.id = ?
            GROUP BY conversations.id
            """,
            (conversation_id,),
        ).fetchone()
        if conversation is None:
            raise HTTPException(status_code=404, detail="Conversation not found")

        messages = conn.execute(
            """
            SELECT
              messages.id,
              messages.sent_at,
              messages.direction,
              messages.body,
              messages.service,
              contacts.display_name AS sender_name,
              contacts.handle AS sender_handle
            FROM messages
            LEFT JOIN contacts ON contacts.id = messages.sender_contact_id
            WHERE messages.conversation_id = ?
            ORDER BY messages.sent_at ASC
            """,
            (conversation_id,),
        ).fetchall()

    return {
        "conversation": {
            "id": conversation["id"],
            "title": conversation["title"] or "Untitled conversation",
            "participants": split_participants(conversation["participants"]),
            "tags": [],
        },
        "messages": [dict(message) for message in messages],
    }


@app.get("/search")
def search(q: str = "", limit: int = 50) -> dict:
    with get_connection() as conn:
        results = search_messages(conn, q=q, limit=limit)
    return {"query": q, "results": results}


@app.get("/export/messages.csv")
def export_csv() -> Response:
    with get_connection() as conn:
        csv_text = export_messages_csv(conn)
    return Response(
        content=csv_text,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=messages.csv"},
    )


def split_participants(value: str | None) -> list[str]:
    if not value:
        return []
    return [name for name in value.split(",") if name]


def build_archive_stats(conn: sqlite3.Connection) -> dict:
    message_stats = conn.execute(
        """
        SELECT
          COUNT(*) AS total_messages,
          SUM(CASE WHEN body = '' THEN 1 ELSE 0 END) AS blank_messages,
          MIN(NULLIF(sent_at, 'unavailable')) AS earliest_message_at,
          MAX(NULLIF(sent_at, 'unavailable')) AS latest_message_at
        FROM messages
        """
    ).fetchone()
    conversation_count = conn.execute("SELECT COUNT(*) FROM conversations").fetchone()[0]
    contact_count = conn.execute("SELECT COUNT(*) FROM contacts").fetchone()[0]
    attachment_count = conn.execute("SELECT COUNT(*) FROM attachments").fetchone()[0]
    attachment_link_count = conn.execute("SELECT COUNT(*) FROM message_attachments").fetchone()[0]

    total_messages = int(message_stats["total_messages"] or 0)
    blank_messages = int(message_stats["blank_messages"] or 0)
    blank_percent = round((blank_messages / total_messages) * 100, 2) if total_messages else 0

    return {
        "messages": {
            "total": total_messages,
            "blank": blank_messages,
            "blank_percent": blank_percent,
            "earliest_sent_at": message_stats["earliest_message_at"],
            "latest_sent_at": message_stats["latest_message_at"],
        },
        "conversations": {
            "total": int(conversation_count or 0),
        },
        "contacts": {
            "total": int(contact_count or 0),
        },
        "attachments": {
            "total": int(attachment_count or 0),
            "linked_messages": int(attachment_link_count or 0),
        },
    }
