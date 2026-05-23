from pathlib import Path
import os
import sqlite3

from fastapi import FastAPI, HTTPException, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, RedirectResponse
from pydantic import BaseModel

from app.importers.dummy_csv import import_sample_csv
from app.importers.iphone_backup import (
    EXPECTED_SMS_FILE_ID,
    SmsDbNotFoundError,
    UnsafeBackupPathError,
    copy_sms_db_from_backup,
    find_sms_db_by_schema_scan,
    import_copied_sms_db_messages,
    inspect_copied_sms_db_metadata,
    locate_sms_db_dry_run,
    validate_copied_sms_db,
)
from app.services.export_csv import export_messages_csv
from app.services.contact_display import (
    UNKNOWN_CONTACT_LABEL,
    clean_participant_names,
    format_contact_display_name,
)
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


class IPhoneMessageImportRequest(IPhoneSmsDbValidationRequest):
    backup_folder_path: str | None = None


def find_iphone_backup_candidates() -> list[dict]:
    search_roots = [
        {
            "path": get_data_dir(),
            "source": "App data",
        },
        {
            "path": Path.home() / "Library" / "Application Support" / "MobileSync" / "Backup",
            "source": "MobileSync",
        },
    ]
    candidates = []
    seen_paths = set()

    for search_root in search_roots:
        root_path = search_root["path"].expanduser()
        if not root_path.is_dir():
            continue
        for manifest_path in sorted(root_path.glob("*/Manifest.db")):
            backup_folder = manifest_path.parent.resolve()
            if backup_folder in seen_paths:
                continue
            seen_paths.add(backup_folder)
            candidates.append(build_backup_candidate(backup_folder, search_root["source"]))

    return candidates


def find_copied_sms_db_candidates() -> list[dict]:
    iphone_import_dir = get_iphone_import_dir()
    iphone_import_dir.mkdir(parents=True, exist_ok=True)
    candidates = []
    for sms_db_path in sorted(iphone_import_dir.glob("*.db")):
        if not sms_db_path.is_file():
            continue
        candidates.append(build_copied_sms_db_candidate(sms_db_path.resolve()))
    return candidates


def build_copied_sms_db_candidate(sms_db_path: Path) -> dict:
    size_bytes = sms_db_path.stat().st_size
    valid = False
    detail = "Ready to validate."
    present_tables = []
    missing_tables = []

    if size_bytes == 0:
        detail = "This file is empty."
    else:
        try:
            validation = validate_copied_sms_db(str(sms_db_path), PROJECT_DIR, data_dir=get_data_dir())
            valid = validation["valid"]
            present_tables = validation["present_tables"]
            missing_tables = validation["missing_tables"]
            detail = (
                "Looks like an iPhone sms.db."
                if valid
                else "This SQLite file is missing expected iPhone message tables."
            )
        except sqlite3.DatabaseError:
            detail = "This file could not be read as a SQLite database."
        except (FileNotFoundError, UnsafeBackupPathError, OSError) as error:
            detail = str(error)

    return {
        "path": str(sms_db_path),
        "name": sms_db_path.name,
        "size_bytes": size_bytes,
        "valid": valid,
        "present_tables": present_tables,
        "missing_tables": missing_tables,
        "detail": detail,
    }


def build_backup_candidate(backup_folder: Path, source: str) -> dict:
    manifest_path = backup_folder / "Manifest.db"
    readable = False
    sms_db_copyable = expected_sms_db_file_is_present(backup_folder, allow_schema_scan=False)
    detail = "Manifest.db was found."
    try:
        with sqlite3.connect(f"file:{manifest_path}?mode=ro", uri=True) as conn:
            conn.execute("SELECT name FROM sqlite_master LIMIT 1").fetchone()
        readable = True
    except sqlite3.DatabaseError:
        detail = describe_unreadable_backup(backup_folder, allow_schema_scan=False)
    except OSError:
        detail = "Manifest.db was found but could not be opened."

    return {
        "path": str(backup_folder),
        "name": backup_folder.name,
        "source": source,
        "manifest_readable": readable,
        "sms_db_copyable": sms_db_copyable,
        "detail": detail,
    }


def expected_sms_db_file_is_present(backup_folder: Path, *, allow_schema_scan: bool = True) -> bool:
    expected_sms_path = backup_folder / EXPECTED_SMS_FILE_ID[:2] / EXPECTED_SMS_FILE_ID
    if expected_sms_path.is_file() and expected_sms_path.stat().st_size > 0:
        return True
    if not allow_schema_scan:
        return False
    return find_sms_db_by_schema_scan(backup_folder) is not None


def describe_unreadable_backup(backup_folder: Path, *, allow_schema_scan: bool = True) -> str:
    manifest_path = backup_folder / "Manifest.db"
    if expected_sms_db_file_is_present(backup_folder, allow_schema_scan=allow_schema_scan):
        return (
            "Manifest.db could not be read, but sms.db is available to copy directly. "
            "Attachment files may import as metadata only."
        )

    sms_file_status = "The expected sms.db backup file is missing or empty."

    try:
        header = manifest_path.read_bytes()[:100]
    except OSError:
        return f"Manifest.db could not be opened. {sms_file_status}"

    if header.startswith(b"SQLite format 3\x00") and len(header) >= 32:
        page_size = int.from_bytes(header[16:18], "big")
        if page_size == 1:
            page_size = 65536
        page_count = int.from_bytes(header[28:32], "big")
        expected_size = page_size * page_count
        actual_size = manifest_path.stat().st_size
        if expected_size > actual_size:
            return (
                "Manifest.db appears incomplete or truncated "
                f"({actual_size:,} bytes on disk, SQLite header expects {expected_size:,}). "
                f"{sms_file_status} Copy the complete backup folder again; the hashed "
                "payload files and metadata must be fully present before sms.db can be located."
            )

    return f"Manifest.db could not be read as a SQLite database. {sms_file_status}"


def get_db_path() -> Path:
    configured_path = Path(os.getenv("MESSAGE_ARCHIVE_DB_PATH", get_data_dir() / DEFAULT_DB_PATH.name))
    if not configured_path.is_absolute():
        configured_path = PROJECT_DIR / configured_path
    return configured_path


def get_data_dir() -> Path:
    configured_path = Path(os.getenv("MESSAGE_ARCHIVE_DATA_DIR", PROJECT_DIR / "data"))
    if not configured_path.is_absolute():
        configured_path = PROJECT_DIR / configured_path
    return configured_path.resolve()


def get_iphone_import_dir() -> Path:
    return get_data_dir() / "imports" / "iphone"


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
        migrate_database(conn)


def migrate_database(conn: sqlite3.Connection) -> None:
    attachment_columns = {
        row["name"]
        for row in conn.execute('PRAGMA table_info("attachments")').fetchall()
    }
    if "source_ref" not in attachment_columns:
        conn.execute("ALTER TABLE attachments ADD COLUMN source_ref TEXT")
        conn.execute(
            """
            UPDATE attachments
            SET source_ref = local_path
            WHERE source_ref IS NULL
              AND local_path LIKE 'iphone-attachment:%'
            """
        )
    conn.execute(
        """
        CREATE UNIQUE INDEX IF NOT EXISTS idx_attachments_source_ref
          ON attachments(source_ref)
          WHERE source_ref IS NOT NULL
        """
    )


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
        backup_folder = Path(request.backup_folder_path).expanduser()
        detail = describe_unreadable_backup(backup_folder)
        raise HTTPException(status_code=400, detail=detail) from error


@app.get("/import/iphone-backup/candidates")
def iphone_backup_candidates() -> dict:
    candidates = find_iphone_backup_candidates()
    usable_candidates = [
        candidate
        for candidate in candidates
        if candidate["manifest_readable"] or candidate["sms_db_copyable"]
    ]
    return {
        "candidates": candidates,
        "default_path": usable_candidates[0]["path"] if usable_candidates else "",
    }


@app.get("/import/iphone-backup/copied-sms-db-candidates")
def iphone_copied_sms_db_candidates() -> dict:
    candidates = find_copied_sms_db_candidates()
    valid_candidates = [
        candidate for candidate in candidates if candidate["valid"]
    ]
    return {
        "candidates": candidates,
        "import_dir": str(get_iphone_import_dir()),
        "default_path": valid_candidates[0]["path"] if valid_candidates else "",
    }


@app.post("/import/iphone-backup/copy-sms-db")
def iphone_backup_copy_sms_db(request: IPhoneBackupDryRunRequest) -> dict:
    try:
        return copy_sms_db_from_backup(request.backup_folder_path, PROJECT_DIR, data_dir=get_data_dir())
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
        return validate_copied_sms_db(request.copied_sms_db_path, PROJECT_DIR, data_dir=get_data_dir())
    except FileNotFoundError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    except UnsafeBackupPathError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    except sqlite3.DatabaseError as error:
        raise HTTPException(status_code=400, detail="Copied sms.db could not be read.") from error


@app.post("/import/iphone-backup/inspect-sms-db")
def iphone_backup_inspect_sms_db(request: IPhoneSmsDbValidationRequest) -> dict:
    try:
        return inspect_copied_sms_db_metadata(request.copied_sms_db_path, PROJECT_DIR, data_dir=get_data_dir())
    except FileNotFoundError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    except UnsafeBackupPathError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    except sqlite3.DatabaseError as error:
        raise HTTPException(status_code=400, detail="Copied sms.db could not be read.") from error


@app.post("/import/iphone-backup/import-messages")
def iphone_backup_import_messages(request: IPhoneMessageImportRequest) -> dict:
    try:
        with get_connection() as conn:
            return import_copied_sms_db_messages(
                request.copied_sms_db_path,
                PROJECT_DIR,
                conn,
                backup_folder_path=request.backup_folder_path,
                data_dir=get_data_dir(),
            )
    except FileNotFoundError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    except NotADirectoryError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
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
            HAVING COUNT(DISTINCT messages.id) > 0
            ORDER BY last_message_at DESC
            """
        ).fetchall()

    return {
        "conversations": [
            {
                "source_title": row["title"],
                "id": row["id"],
                "title": build_conversation_display_title(
                    row["title"],
                    clean_participant_names(split_participants(row["participants"])),
                ),
                "last_message_at": row["last_message_at"],
                "message_count": row["message_count"],
                "participants": clean_participant_names(split_participants(row["participants"])),
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
        attachment_rows = conn.execute(
            """
            SELECT
              message_attachments.message_id,
              attachments.id,
              attachments.original_filename,
              attachments.mime_type,
              attachments.local_path,
              attachments.byte_size
            FROM message_attachments
            JOIN attachments ON attachments.id = message_attachments.attachment_id
            JOIN messages ON messages.id = message_attachments.message_id
            WHERE messages.conversation_id = ?
            ORDER BY message_attachments.message_id, attachments.id
            """,
            (conversation_id,),
        ).fetchall()

    attachments_by_message_id: dict[int, list[dict]] = {}
    for attachment in attachment_rows:
        attachments_by_message_id.setdefault(attachment["message_id"], []).append(
            {
                "id": attachment["id"],
                "original_filename": attachment["original_filename"],
                "mime_type": attachment["mime_type"],
                "byte_size": attachment["byte_size"],
                "available": bool(attachment["local_path"]),
                "url": f"/attachments/{attachment['id']}" if attachment["local_path"] else None,
                "is_image": is_image_mime_type(attachment["mime_type"]),
            }
        )

    return {
        "conversation": {
            "id": conversation["id"],
            "source_title": conversation["title"],
            "title": build_conversation_display_title(
                conversation["title"],
                clean_participant_names(split_participants(conversation["participants"])),
            ),
            "participants": clean_participant_names(split_participants(conversation["participants"])),
        },
        "messages": [
            {
                **format_message_row(message),
                "attachments": attachments_by_message_id.get(message["id"], []),
            }
            for message in messages
        ],
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


@app.get("/attachments/{attachment_id}")
def get_attachment_file(attachment_id: int, download: bool = False) -> FileResponse:
    with get_connection() as conn:
        row = conn.execute(
            """
            SELECT original_filename, mime_type, local_path
            FROM attachments
            WHERE id = ?
            """,
            (attachment_id,),
        ).fetchone()

    if row is None or not row["local_path"]:
        raise HTTPException(status_code=404, detail="Attachment file is not available.")

    file_path = resolve_private_attachment_path(row["local_path"])
    content_disposition_type = "attachment" if download else "inline"
    return FileResponse(
        file_path,
        media_type=row["mime_type"] or "application/octet-stream",
        filename=row["original_filename"] or file_path.name,
        content_disposition_type=content_disposition_type,
    )


def split_participants(value: str | None) -> list[str]:
    if not value:
        return []
    return [name.strip() for name in value.split(",") if name.strip()]


def is_image_mime_type(value: str | None) -> bool:
    return bool(value and value.lower().startswith("image/"))


def resolve_private_attachment_path(local_path: str) -> Path:
    attachment_root = (get_data_dir() / "attachments").resolve()
    path = Path(local_path)
    if path.is_absolute():
        resolved_path = path.resolve(strict=False)
    else:
        resolved_path = (PROJECT_DIR / path).resolve(strict=False)
    if not resolved_path.is_relative_to(attachment_root):
        raise HTTPException(status_code=400, detail="Attachment path is outside private storage.")
    if not resolved_path.is_file():
        raise HTTPException(status_code=404, detail="Attachment file is not available.")
    return resolved_path


def format_message_row(message: sqlite3.Row) -> dict:
    formatted_message = dict(message)
    formatted_message["sender_name"] = format_contact_display_name(
        formatted_message["sender_name"] or formatted_message["sender_handle"]
    )
    return formatted_message


def build_conversation_display_title(
    source_title: str | None,
    participants: list[str],
) -> str:
    if source_title and not is_generated_conversation_title(source_title):
        return source_title

    participant_title = format_participant_title(participants)
    if participant_title:
        return participant_title

    return source_title or "Untitled conversation"


def is_generated_conversation_title(value: str) -> bool:
    normalized = value.strip().lower()
    if not normalized:
        return True
    return (
        normalized.startswith("chat")
        or normalized.startswith("iphone chat ")
        or normalized == "iphone messages without chat"
    )


def format_participant_title(participants: list[str]) -> str:
    meaningful_participants = [
        participant
        for participant in participants
        if participant and participant not in {"Me", UNKNOWN_CONTACT_LABEL}
    ]
    if not meaningful_participants:
        meaningful_participants = [participant for participant in participants if participant and participant != "Me"]

    if len(meaningful_participants) <= 3:
        return ", ".join(meaningful_participants)

    visible_participants = ", ".join(meaningful_participants[:3])
    return f"{visible_participants} +{len(meaningful_participants) - 3} more"


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
