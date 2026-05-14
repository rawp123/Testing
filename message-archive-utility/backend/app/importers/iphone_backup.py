from datetime import datetime, timezone
from pathlib import Path
import shutil
import sqlite3


SMS_DOMAIN = "HomeDomain"
SMS_RELATIVE_PATH = "Library/SMS/sms.db"
EXPECTED_SMS_TABLES = {
    "message",
    "handle",
    "chat",
    "chat_message_join",
    "attachment",
    "message_attachment_join",
}
SMS_METADATA_TABLES = sorted(EXPECTED_SMS_TABLES)
APPLE_EPOCH_OFFSET_SECONDS = 978307200
SELF_CONTACT_HANDLE = "iphone:self"


class SmsDbNotFoundError(FileNotFoundError):
    """Raised when the backup manifest does not contain the SMS database entry."""


class UnsafeBackupPathError(PermissionError):
    """Raised when a source or destination path leaves its expected boundary."""


def locate_sms_db_dry_run(backup_folder_path: str) -> dict:
    backup_folder = Path(backup_folder_path).expanduser().resolve(strict=True)
    if not backup_folder.is_dir():
        raise NotADirectoryError("Backup path must be a folder.")

    manifest_path = backup_folder / "Manifest.db"
    if not manifest_path.exists():
        raise FileNotFoundError("Manifest.db was not found in the backup folder.")

    resolved_manifest = manifest_path.resolve(strict=True)
    if not resolved_manifest.is_relative_to(backup_folder):
        raise PermissionError("Manifest.db must be inside the provided backup folder.")

    row = query_sms_manifest_row(resolved_manifest)
    if row is None:
        return {
            "sms_db_found": False,
            "domain": SMS_DOMAIN,
            "relativePath": SMS_RELATIVE_PATH,
            "fileID": None,
            "expected_backup_file_path": None,
        }

    file_id = row["fileID"]
    return {
        "sms_db_found": True,
        "domain": row["domain"],
        "relativePath": row["relativePath"],
        "fileID": file_id,
        "expected_backup_file_path": str(backup_folder / file_id[:2] / file_id),
    }


def copy_sms_db_from_backup(
    backup_folder_path: str,
    project_dir: Path,
    timestamp: str | None = None,
) -> dict:
    locator_result = locate_sms_db_dry_run(backup_folder_path)
    if not locator_result["sms_db_found"]:
        raise SmsDbNotFoundError("sms.db was not found in the backup manifest.")

    backup_folder = Path(backup_folder_path).expanduser().resolve(strict=True)
    source_path = Path(locator_result["expected_backup_file_path"]).resolve(strict=True)
    if not source_path.is_relative_to(backup_folder):
        raise UnsafeBackupPathError("Resolved sms.db path must stay inside the backup folder.")
    if not source_path.is_file():
        raise FileNotFoundError("Resolved sms.db file was not found in the backup.")

    destination_root = (project_dir / "data" / "imports" / "iphone").resolve()
    destination_root.mkdir(parents=True, exist_ok=True)

    safe_timestamp = timestamp or datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    destination_path = (destination_root / f"sms_import_{safe_timestamp}.db").resolve()
    if not destination_path.is_relative_to(destination_root):
        raise UnsafeBackupPathError("Destination path must stay inside data/imports/iphone.")
    if destination_path.exists():
        raise FileExistsError("Destination import file already exists.")

    shutil.copy2(source_path, destination_path)

    return {
        "copied": True,
        "parsed": False,
        "domain": locator_result["domain"],
        "relativePath": locator_result["relativePath"],
        "fileID": locator_result["fileID"],
        "source_path": str(source_path),
        "destination_path": str(destination_path),
    }


def validate_copied_sms_db(copied_sms_db_path: str, project_dir: Path) -> dict:
    sms_db_path = resolve_copied_sms_db_path(copied_sms_db_path, project_dir)
    present_tables = get_sqlite_table_names(sms_db_path)
    missing_tables = sorted(EXPECTED_SMS_TABLES.difference(present_tables))

    return {
        "valid": len(missing_tables) == 0,
        "present_tables": sorted(EXPECTED_SMS_TABLES.intersection(present_tables)),
        "missing_tables": missing_tables,
        "parsed": False,
        "message_contents_read": False,
    }


def inspect_copied_sms_db_metadata(copied_sms_db_path: str, project_dir: Path) -> dict:
    sms_db_path = resolve_copied_sms_db_path(copied_sms_db_path, project_dir)
    present_tables = get_sqlite_table_names(sms_db_path)
    missing_tables = sorted(EXPECTED_SMS_TABLES.difference(present_tables))
    if missing_tables:
        return {
            "inspected": False,
            "valid": False,
            "missing_tables": missing_tables,
            "row_counts": {},
            "min_message_date": None,
            "max_message_date": None,
            "parsed": False,
            "message_contents_read": False,
        }

    row_counts = get_sms_metadata_row_counts(sms_db_path)
    min_message_date, max_message_date = get_message_date_range(sms_db_path)

    return {
        "inspected": True,
        "valid": True,
        "row_counts": row_counts,
        "min_message_date": min_message_date,
        "max_message_date": max_message_date,
        "parsed": False,
        "message_contents_read": False,
    }


def import_copied_sms_db_messages(
    copied_sms_db_path: str,
    project_dir: Path,
    archive_conn: sqlite3.Connection,
) -> dict:
    sms_db_path = resolve_copied_sms_db_path(copied_sms_db_path, project_dir)
    present_tables = get_sqlite_table_names(sms_db_path)
    missing_tables = sorted(EXPECTED_SMS_TABLES.difference(present_tables))
    if missing_tables:
        raise ValueError(f"Copied sms.db is missing required tables: {missing_tables}")

    sms_conn = sqlite3.connect(f"{sms_db_path.as_uri()}?mode=ro", uri=True)
    sms_conn.row_factory = sqlite3.Row
    try:
        handle_rows = fetch_handle_rows(sms_conn)
        chat_rows = fetch_chat_rows(sms_conn)
        message_chat_ids = fetch_message_chat_ids(sms_conn)
        message_rows = fetch_message_rows(sms_conn)
    finally:
        sms_conn.close()

    contact_ids_by_handle_rowid = {}
    contacts_imported = 0
    for handle in handle_rows:
        contact_id, inserted = upsert_iphone_contact(
            archive_conn,
            handle=handle["handle"],
            display_name=handle["handle"],
            handle_type="iphone",
        )
        contact_ids_by_handle_rowid[handle["rowid"]] = contact_id
        contacts_imported += inserted

    self_contact_id, self_inserted = upsert_iphone_contact(
        archive_conn,
        handle=SELF_CONTACT_HANDLE,
        display_name="Me",
        handle_type="iphone_self",
    )
    contacts_imported += self_inserted

    conversation_ids_by_chat_rowid = {}
    conversations_imported = 0
    for chat in chat_rows:
        conversation_id, inserted = upsert_iphone_conversation(
            archive_conn,
            chat_rowid=chat["rowid"],
            title=chat["title"],
        )
        conversation_ids_by_chat_rowid[chat["rowid"]] = conversation_id
        conversations_imported += inserted

    orphan_conversation_id = None
    messages_imported = 0
    participants_imported = 0
    for message in message_rows:
        chat_ids = message_chat_ids.get(message["rowid"], [])
        if not chat_ids:
            if orphan_conversation_id is None:
                orphan_conversation_id, inserted = upsert_iphone_conversation(
                    archive_conn,
                    chat_rowid="orphan",
                    title="iPhone messages without chat",
                )
                conversations_imported += inserted
            conversation_id = orphan_conversation_id
        else:
            conversation_id = conversation_ids_by_chat_rowid.get(chat_ids[0])
            if conversation_id is None:
                conversation_id, inserted = upsert_iphone_conversation(
                    archive_conn,
                    chat_rowid=chat_ids[0],
                    title=f"iPhone chat {chat_ids[0]}",
                )
                conversation_ids_by_chat_rowid[chat_ids[0]] = conversation_id
                conversations_imported += inserted

        if message["is_from_me"]:
            sender_contact_id = self_contact_id
        else:
            sender_contact_id = contact_ids_by_handle_rowid.get(message["handle_id"])
            if sender_contact_id is None:
                fallback_handle = f"iphone:unknown-handle:{message['handle_id'] or 'missing'}"
                sender_contact_id, inserted = upsert_iphone_contact(
                    archive_conn,
                    handle=fallback_handle,
                    display_name=fallback_handle,
                    handle_type="iphone_unknown",
                )
                contacts_imported += inserted

        participants_imported += insert_conversation_participant(
            archive_conn,
            conversation_id,
            sender_contact_id,
        )
        imported = insert_iphone_message(
            archive_conn,
            conversation_id=conversation_id,
            sender_contact_id=sender_contact_id,
            message=message,
        )
        messages_imported += imported

    archive_conn.commit()
    return {
        "attachments_imported": 0,
        "contacts_imported": contacts_imported,
        "conversations_imported": conversations_imported,
        "conversation_participants_imported": participants_imported,
        "messages_imported": messages_imported,
    }


def resolve_copied_sms_db_path(copied_sms_db_path: str, project_dir: Path) -> Path:
    import_root = (project_dir / "data" / "imports" / "iphone").resolve()
    sms_db_path = Path(copied_sms_db_path).expanduser().resolve(strict=True)
    if not sms_db_path.is_relative_to(import_root):
        raise UnsafeBackupPathError("Copied sms.db path must stay inside data/imports/iphone.")
    if not sms_db_path.is_file():
        raise FileNotFoundError("Copied sms.db file was not found.")
    return sms_db_path


def fetch_handle_rows(conn: sqlite3.Connection) -> list[dict]:
    columns = get_table_columns(conn, "handle")
    handle_expr = '"id"' if "id" in columns else "NULL"
    service_expr = '"service"' if "service" in columns else "NULL"
    rows = conn.execute(
        f"""
        SELECT ROWID AS rowid, {handle_expr} AS handle, {service_expr} AS service
        FROM "handle"
        ORDER BY ROWID
        """
    ).fetchall()
    return [
        {
            "rowid": row["rowid"],
            "handle": row["handle"] or f"iphone:handle:{row['rowid']}",
            "service": row["service"],
        }
        for row in rows
    ]


def fetch_chat_rows(conn: sqlite3.Connection) -> list[dict]:
    columns = get_table_columns(conn, "chat")
    identifier_expr = '"chat_identifier"' if "chat_identifier" in columns else "NULL"
    display_name_expr = '"display_name"' if "display_name" in columns else "NULL"
    service_expr = '"service_name"' if "service_name" in columns else "NULL"
    rows = conn.execute(
        f"""
        SELECT
          ROWID AS rowid,
          {identifier_expr} AS chat_identifier,
          {display_name_expr} AS display_name,
          {service_expr} AS service_name
        FROM "chat"
        ORDER BY ROWID
        """
    ).fetchall()
    return [
        {
            "rowid": row["rowid"],
            "title": row["display_name"] or row["chat_identifier"] or f"iPhone chat {row['rowid']}",
            "service": row["service_name"],
        }
        for row in rows
    ]


def fetch_message_chat_ids(conn: sqlite3.Connection) -> dict[int, list[int]]:
    rows = conn.execute(
        """
        SELECT chat_id, message_id
        FROM "chat_message_join"
        ORDER BY chat_id, message_id
        """
    ).fetchall()
    message_chat_ids: dict[int, list[int]] = {}
    for row in rows:
        message_chat_ids.setdefault(row["message_id"], []).append(row["chat_id"])
    return message_chat_ids


def fetch_message_rows(conn: sqlite3.Connection) -> list[dict]:
    columns = get_table_columns(conn, "message")
    handle_expr = '"handle_id"' if "handle_id" in columns else "NULL"
    date_expr = '"date"' if "date" in columns else "NULL"
    text_expr = '"text"' if "text" in columns else "NULL"
    is_from_me_expr = '"is_from_me"' if "is_from_me" in columns else "0"
    service_expr = '"service"' if "service" in columns else "NULL"
    rows = conn.execute(
        f"""
        SELECT
          ROWID AS rowid,
          {handle_expr} AS handle_id,
          {date_expr} AS date,
          {text_expr} AS text,
          {is_from_me_expr} AS is_from_me,
          {service_expr} AS service
        FROM "message"
        ORDER BY ROWID
        """
    ).fetchall()
    return [
        {
            "rowid": row["rowid"],
            "handle_id": row["handle_id"],
            "date": row["date"],
            "text": row["text"] or "",
            "is_from_me": bool(row["is_from_me"]),
            "service": row["service"],
        }
        for row in rows
    ]


def get_table_columns(conn: sqlite3.Connection, table_name: str) -> set[str]:
    return {
        row[1]
        for row in conn.execute(f'PRAGMA table_info("{table_name}")').fetchall()
    }


def get_sqlite_table_names(database_path: Path) -> set[str]:
    conn = sqlite3.connect(f"{database_path.as_uri()}?mode=ro", uri=True)
    try:
        rows = conn.execute(
            """
            SELECT name
            FROM sqlite_master
            WHERE type = 'table'
            """
        ).fetchall()
    finally:
        conn.close()
    return {row[0] for row in rows}


def get_sms_metadata_row_counts(database_path: Path) -> dict[str, int]:
    conn = sqlite3.connect(f"{database_path.as_uri()}?mode=ro", uri=True)
    try:
        return {
            table_name: conn.execute(f'SELECT COUNT(*) FROM "{table_name}"').fetchone()[0]
            for table_name in SMS_METADATA_TABLES
        }
    finally:
        conn.close()


def get_message_date_range(database_path: Path) -> tuple[int | None, int | None]:
    conn = sqlite3.connect(f"{database_path.as_uri()}?mode=ro", uri=True)
    try:
        message_columns = {
            row[1]
            for row in conn.execute('PRAGMA table_info("message")').fetchall()
        }
        if "date" not in message_columns:
            return None, None

        row = conn.execute('SELECT MIN("date"), MAX("date") FROM "message"').fetchone()
        return row[0], row[1]
    finally:
        conn.close()


def upsert_iphone_contact(
    conn: sqlite3.Connection,
    *,
    handle: str,
    display_name: str,
    handle_type: str,
) -> tuple[int, int]:
    cursor = conn.execute(
        """
        INSERT OR IGNORE INTO contacts (display_name, handle, handle_type)
        VALUES (?, ?, ?)
        """,
        (display_name, handle, handle_type),
    )
    row = conn.execute("SELECT id FROM contacts WHERE handle = ?", (handle,)).fetchone()
    return int(row["id"]), cursor.rowcount


def upsert_iphone_conversation(
    conn: sqlite3.Connection,
    *,
    chat_rowid: int | str,
    title: str,
) -> tuple[int, int]:
    source_thread_id = f"iphone-chat:{chat_rowid}"
    cursor = conn.execute(
        """
        INSERT OR IGNORE INTO conversations (source_thread_id, title, updated_at)
        VALUES (?, ?, CURRENT_TIMESTAMP)
        """,
        (source_thread_id, title),
    )
    if cursor.rowcount == 0:
        conn.execute(
            """
            UPDATE conversations
            SET title = ?, updated_at = CURRENT_TIMESTAMP
            WHERE source_thread_id = ?
            """,
            (title, source_thread_id),
        )
    row = conn.execute(
        "SELECT id FROM conversations WHERE source_thread_id = ?",
        (source_thread_id,),
    ).fetchone()
    return int(row["id"]), cursor.rowcount


def insert_conversation_participant(
    conn: sqlite3.Connection,
    conversation_id: int,
    contact_id: int,
) -> int:
    cursor = conn.execute(
        """
        INSERT OR IGNORE INTO conversation_participants (conversation_id, contact_id)
        VALUES (?, ?)
        """,
        (conversation_id, contact_id),
    )
    return cursor.rowcount


def insert_iphone_message(
    conn: sqlite3.Connection,
    *,
    conversation_id: int,
    sender_contact_id: int,
    message: dict,
) -> int:
    cursor = conn.execute(
        """
        INSERT OR IGNORE INTO messages (
          conversation_id,
          sender_contact_id,
          source_message_id,
          sent_at,
          direction,
          body,
          service
        )
        VALUES (?, ?, ?, ?, ?, ?, ?)
        """,
        (
            conversation_id,
            sender_contact_id,
            str(message["rowid"]),
            convert_iphone_timestamp(message["date"]),
            "outgoing" if message["is_from_me"] else "incoming",
            message["text"],
            message["service"],
        ),
    )
    return cursor.rowcount


def convert_iphone_timestamp(value) -> str:
    if value is None:
        return "unavailable"
    try:
        raw_value = float(value)
    except (TypeError, ValueError):
        return "unavailable"

    seconds = raw_value / 1_000_000_000 if abs(raw_value) > 1_000_000_000 else raw_value
    unix_seconds = seconds + APPLE_EPOCH_OFFSET_SECONDS
    try:
        return datetime.fromtimestamp(unix_seconds, tz=timezone.utc).isoformat()
    except (OverflowError, OSError, ValueError):
        return "unavailable"


def query_sms_manifest_row(manifest_path: Path) -> sqlite3.Row | None:
    conn = sqlite3.connect(f"{manifest_path.as_uri()}?mode=ro", uri=True)
    conn.row_factory = sqlite3.Row
    try:
        return conn.execute(
            """
            SELECT fileID, domain, relativePath
            FROM Files
            WHERE domain = ? AND relativePath = ?
            LIMIT 1
            """,
            (SMS_DOMAIN, SMS_RELATIVE_PATH),
        ).fetchone()
    finally:
        conn.close()
