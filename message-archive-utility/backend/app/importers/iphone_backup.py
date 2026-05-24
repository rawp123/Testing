from datetime import datetime, timezone
from pathlib import Path
import re
import shutil
import sqlite3

from app.services.contact_display import format_contact_display_name


SMS_DOMAIN = "HomeDomain"
SMS_RELATIVE_PATH = "Library/SMS/sms.db"
EXPECTED_SMS_FILE_ID = "3d0d7e5fb2ce288813306e4d4636395e047a3d28"
ADDRESS_BOOK_RELATIVE_PATHS = [
    "Library/AddressBook/AddressBook.sqlitedb",
    "Library/AddressBook/AddressBook-v22.abcddb",
]
EXPECTED_ADDRESS_BOOK_FILE_IDS = {
    "Library/AddressBook/AddressBook.sqlitedb": "31bb7ba8914766d4ba40d6dfb6113c8b614be442",
    "Library/AddressBook/AddressBook-v22.abcddb": "6c205a17de08b35ab604103e533b1748c1285986",
}
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

    try:
        row = query_sms_manifest_row(resolved_manifest)
    except sqlite3.DatabaseError:
        return locate_sms_db_without_manifest(backup_folder, manifest_readable=False)

    if row is None:
        fallback_result = locate_sms_db_without_manifest(backup_folder, manifest_readable=True)
        if fallback_result["sms_db_found"]:
            return fallback_result
        return {
            "sms_db_found": False,
            "domain": SMS_DOMAIN,
            "relativePath": SMS_RELATIVE_PATH,
            "fileID": None,
            "expected_backup_file_path": str(
                backup_folder / EXPECTED_SMS_FILE_ID[:2] / EXPECTED_SMS_FILE_ID
            ),
            "manifest_readable": True,
            "locator": "manifest",
        }

    file_id = row["fileID"]
    expected_backup_file_path = backup_folder / file_id[:2] / file_id
    if not backup_file_is_present(expected_backup_file_path):
        fallback_result = locate_sms_db_without_manifest(backup_folder, manifest_readable=True)
        if fallback_result["sms_db_found"]:
            return fallback_result

    return {
        "sms_db_found": True,
        "domain": row["domain"],
        "relativePath": row["relativePath"],
        "fileID": file_id,
        "expected_backup_file_path": str(expected_backup_file_path),
        "manifest_readable": True,
        "locator": "manifest",
    }


def locate_sms_db_without_manifest(backup_folder: Path, *, manifest_readable: bool) -> dict:
    known_file_result = locate_sms_db_by_known_file_id(
        backup_folder,
        manifest_readable=manifest_readable,
    )
    if known_file_result["sms_db_found"]:
        return known_file_result

    scanned_path = find_sms_db_by_schema_scan(backup_folder)
    if scanned_path is not None:
        file_id = scanned_path.name
        return {
            "sms_db_found": True,
            "domain": SMS_DOMAIN,
            "relativePath": SMS_RELATIVE_PATH,
            "fileID": file_id,
            "expected_backup_file_path": str(scanned_path),
            "manifest_readable": manifest_readable,
            "locator": "schema_scan",
        }

    return known_file_result


def locate_sms_db_by_known_file_id(backup_folder: Path, *, manifest_readable: bool) -> dict:
    expected_backup_file_path = backup_folder / EXPECTED_SMS_FILE_ID[:2] / EXPECTED_SMS_FILE_ID
    sms_db_found = backup_file_is_present(expected_backup_file_path)
    return {
        "sms_db_found": sms_db_found,
        "domain": SMS_DOMAIN,
        "relativePath": SMS_RELATIVE_PATH,
        "fileID": EXPECTED_SMS_FILE_ID if sms_db_found else None,
        "expected_backup_file_path": str(expected_backup_file_path),
        "manifest_readable": manifest_readable,
        "locator": "known_sms_db_file",
    }


def backup_file_is_present(path: Path) -> bool:
    return path.is_file() and path.stat().st_size > 0


def find_sms_db_by_schema_scan(backup_folder: Path) -> Path | None:
    for candidate_path in iter_backup_payload_files(backup_folder):
        if not sqlite_header_is_present(candidate_path):
            continue
        try:
            present_tables = get_sqlite_table_names(candidate_path)
        except sqlite3.DatabaseError:
            continue
        if EXPECTED_SMS_TABLES.issubset(present_tables):
            return candidate_path
    return None


def iter_backup_payload_files(backup_folder: Path):
    for path in sorted(backup_folder.rglob("*")):
        if not path.is_file() or path.name in {"Manifest.db", "Manifest.db-shm", "Manifest.db-wal"}:
            continue
        try:
            resolved_path = path.resolve(strict=True)
        except OSError:
            continue
        if resolved_path.is_relative_to(backup_folder):
            yield resolved_path


def sqlite_header_is_present(path: Path) -> bool:
    try:
        with path.open("rb") as file:
            return file.read(16) == b"SQLite format 3\x00"
    except OSError:
        return False


def copy_sms_db_from_backup(
    backup_folder_path: str,
    project_dir: Path,
    timestamp: str | None = None,
    data_dir: Path | None = None,
) -> dict:
    locator_result = locate_sms_db_dry_run(backup_folder_path)
    if not locator_result["sms_db_found"]:
        raise SmsDbNotFoundError(
            "sms.db was not found in the backup. Make sure the backup folder contains "
            "the hashed payload files, not just Manifest.db."
        )

    backup_folder = Path(backup_folder_path).expanduser().resolve(strict=True)
    source_path = Path(locator_result["expected_backup_file_path"]).resolve(strict=True)
    if not source_path.is_relative_to(backup_folder):
        raise UnsafeBackupPathError("Resolved sms.db path must stay inside the backup folder.")
    if not source_path.is_file():
        raise FileNotFoundError("Resolved sms.db file was not found in the backup.")

    destination_root = get_iphone_import_root(project_dir, data_dir)
    destination_root.mkdir(parents=True, exist_ok=True)

    safe_timestamp = timestamp or datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S%fZ")
    destination_path = (destination_root / f"sms_import_{safe_timestamp}.db").resolve()
    if not destination_path.is_relative_to(destination_root):
        raise UnsafeBackupPathError("Destination path must stay inside the configured iPhone import folder.")
    if destination_path.exists():
        raise FileExistsError("Destination import file already exists.")

    shutil.copy2(source_path, destination_path)

    return {
        "copied": True,
        "parsed": False,
        "domain": locator_result["domain"],
        "relativePath": locator_result["relativePath"],
        "fileID": locator_result["fileID"],
        "manifest_readable": locator_result["manifest_readable"],
        "locator": locator_result["locator"],
        "source_path": str(source_path),
        "destination_path": str(destination_path),
    }


def validate_copied_sms_db(copied_sms_db_path: str, project_dir: Path, data_dir: Path | None = None) -> dict:
    sms_db_path = resolve_copied_sms_db_path(copied_sms_db_path, project_dir, data_dir)
    present_tables = get_sqlite_table_names(sms_db_path)
    missing_tables = sorted(EXPECTED_SMS_TABLES.difference(present_tables))

    return {
        "valid": len(missing_tables) == 0,
        "present_tables": sorted(EXPECTED_SMS_TABLES.intersection(present_tables)),
        "missing_tables": missing_tables,
        "parsed": False,
        "message_contents_read": False,
    }


def inspect_copied_sms_db_metadata(copied_sms_db_path: str, project_dir: Path, data_dir: Path | None = None) -> dict:
    sms_db_path = resolve_copied_sms_db_path(copied_sms_db_path, project_dir, data_dir)
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
    backup_folder_path: str | None = None,
    data_dir: Path | None = None,
) -> dict:
    sms_db_path = resolve_copied_sms_db_path(copied_sms_db_path, project_dir, data_dir)
    present_tables = get_sqlite_table_names(sms_db_path)
    missing_tables = sorted(EXPECTED_SMS_TABLES.difference(present_tables))
    if missing_tables:
        raise ValueError(f"Copied sms.db is missing required tables: {missing_tables}")

    sms_conn = sqlite3.connect(f"{sms_db_path.as_uri()}?mode=ro", uri=True)
    sms_conn.row_factory = sqlite3.Row
    try:
        handle_rows = fetch_handle_rows(sms_conn)
        chat_rows = fetch_chat_rows(sms_conn)
        chat_handle_ids = fetch_chat_handle_ids(sms_conn)
        message_chat_ids = fetch_message_chat_ids(sms_conn)
        message_rows = fetch_message_rows(sms_conn)
        attachment_rows = fetch_attachment_rows(sms_conn)
        message_attachment_rows = fetch_message_attachment_rows(sms_conn)
    finally:
        sms_conn.close()

    backup_folder = resolve_backup_folder(backup_folder_path) if backup_folder_path else None
    contact_names_by_handle = (
        read_contact_display_names_from_backup(backup_folder) if backup_folder else {}
    )

    contact_ids_by_handle_rowid = {}
    contacts_imported = 0
    contacts_named = 0
    for handle in handle_rows:
        display_name = contact_names_by_handle.get(
            normalize_contact_lookup_key(handle["handle"]),
            format_contact_display_name(handle["handle"]),
        )
        contact_id, inserted = upsert_iphone_contact(
            archive_conn,
            handle=handle["handle"],
            display_name=display_name,
            handle_type="iphone",
        )
        contact_ids_by_handle_rowid[handle["rowid"]] = contact_id
        contacts_imported += inserted
        contacts_named += int(display_name != format_contact_display_name(handle["handle"]))

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
    for chat_rowid, handle_rowids in chat_handle_ids.items():
        conversation_id = conversation_ids_by_chat_rowid.get(chat_rowid)
        if conversation_id is None:
            continue
        for handle_rowid in handle_rowids:
            contact_id = contact_ids_by_handle_rowid.get(handle_rowid)
            if contact_id is None:
                continue
            participants_imported += insert_conversation_participant(
                archive_conn,
                conversation_id,
                contact_id,
            )

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
                display_name = contact_names_by_handle.get(
                    normalize_contact_lookup_key(fallback_handle),
                    format_contact_display_name(fallback_handle),
                )
                sender_contact_id, inserted = upsert_iphone_contact(
                    archive_conn,
                    handle=fallback_handle,
                    display_name=display_name,
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

    attachment_ids_by_rowid = {}
    attachments_imported = 0
    attachment_files_copied = 0
    linked_attachment_rowids = {
        row["attachment_id"]
        for row in message_attachment_rows
    }
    for attachment in attachment_rows:
        local_path = None
        if backup_folder and attachment["rowid"] in linked_attachment_rowids:
            copy_result = copy_iphone_attachment_file(
                attachment=attachment,
                backup_folder=backup_folder,
                project_dir=project_dir,
                import_stem=sms_db_path.stem,
                data_dir=data_dir,
            )
            local_path = copy_result["local_path"]
            attachment_files_copied += copy_result["copied"]
        attachment_id, inserted = upsert_iphone_attachment_metadata(
            archive_conn,
            attachment,
            local_path=local_path,
        )
        attachment_ids_by_rowid[attachment["rowid"]] = attachment_id
        attachments_imported += inserted

    message_attachment_links_imported = 0
    for row in message_attachment_rows:
        message_id = get_archive_message_id(archive_conn, row["message_id"])
        attachment_id = attachment_ids_by_rowid.get(row["attachment_id"])
        if message_id is None or attachment_id is None:
            continue
        message_attachment_links_imported += insert_message_attachment_link(
            archive_conn,
            message_id=message_id,
            attachment_id=attachment_id,
        )

    archive_conn.commit()
    return {
        "attachments_imported": attachments_imported,
        "attachment_files_copied": attachment_files_copied,
        "message_attachment_links_imported": message_attachment_links_imported,
        "contacts_imported": contacts_imported,
        "contacts_named": contacts_named,
        "conversations_imported": conversations_imported,
        "conversation_participants_imported": participants_imported,
        "messages_imported": messages_imported,
    }


def resolve_copied_sms_db_path(copied_sms_db_path: str, project_dir: Path, data_dir: Path | None = None) -> Path:
    import_root = get_iphone_import_root(project_dir, data_dir)
    sms_db_path = Path(copied_sms_db_path).expanduser().resolve(strict=True)
    if not sms_db_path.is_relative_to(import_root):
        raise UnsafeBackupPathError("Copied sms.db path must stay inside the configured iPhone import folder.")
    if not sms_db_path.is_file():
        raise FileNotFoundError("Copied sms.db file was not found.")
    return sms_db_path


def resolve_backup_folder(backup_folder_path: str) -> Path:
    backup_folder = Path(backup_folder_path).expanduser().resolve(strict=True)
    if not backup_folder.is_dir():
        raise NotADirectoryError("Backup path must be a folder.")
    manifest_path = backup_folder / "Manifest.db"
    if not manifest_path.exists():
        raise FileNotFoundError("Manifest.db was not found in the backup folder.")
    return backup_folder


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


def fetch_chat_handle_ids(conn: sqlite3.Connection) -> dict[int, list[int]]:
    table_row = conn.execute(
        """
        SELECT name
        FROM sqlite_master
        WHERE type = 'table' AND name = 'chat_handle_join'
        """
    ).fetchone()
    if table_row is None:
        return {}

    rows = conn.execute(
        """
        SELECT chat_id, handle_id
        FROM "chat_handle_join"
        ORDER BY chat_id, handle_id
        """
    ).fetchall()
    chat_handle_ids: dict[int, list[int]] = {}
    for row in rows:
        chat_handle_ids.setdefault(row["chat_id"], []).append(row["handle_id"])
    return chat_handle_ids


def fetch_message_rows(conn: sqlite3.Connection) -> list[dict]:
    columns = get_table_columns(conn, "message")
    handle_expr = '"handle_id"' if "handle_id" in columns else "NULL"
    date_expr = '"date"' if "date" in columns else "NULL"
    text_expr = '"text"' if "text" in columns else "NULL"
    attributed_body_expr = '"attributedBody"' if "attributedBody" in columns else "NULL"
    payload_data_expr = '"payload_data"' if "payload_data" in columns else "NULL"
    is_from_me_expr = '"is_from_me"' if "is_from_me" in columns else "0"
    service_expr = '"service"' if "service" in columns else "NULL"
    rows = conn.execute(
        f"""
        SELECT
          ROWID AS rowid,
          {handle_expr} AS handle_id,
          {date_expr} AS date,
          {text_expr} AS text,
          {attributed_body_expr} AS attributed_body,
          {payload_data_expr} AS payload_data,
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
            "text": extract_message_body_text(
                row["text"],
                row["attributed_body"],
                row["payload_data"],
            ),
            "is_from_me": bool(row["is_from_me"]),
            "service": row["service"],
        }
        for row in rows
    ]


def fetch_attachment_rows(conn: sqlite3.Connection) -> list[dict]:
    columns = get_table_columns(conn, "attachment")
    filename_expr = first_available_column_expr(columns, ["filename"], "NULL")
    transfer_name_expr = first_available_column_expr(columns, ["transfer_name"], "NULL")
    mime_type_expr = first_available_column_expr(columns, ["mime_type", "uti"], "NULL")
    byte_size_expr = first_available_column_expr(columns, ["total_bytes", "byte_size", "file_size"], "NULL")
    rows = conn.execute(
        f"""
        SELECT
          ROWID AS rowid,
          {filename_expr} AS filename,
          {transfer_name_expr} AS transfer_name,
          {mime_type_expr} AS mime_type,
          {byte_size_expr} AS byte_size
        FROM "attachment"
        ORDER BY ROWID
        """
    ).fetchall()
    return [
        {
            "rowid": row["rowid"],
            "filename": row["filename"],
            "transfer_name": row["transfer_name"],
            "mime_type": row["mime_type"],
            "byte_size": row["byte_size"],
        }
        for row in rows
    ]


def fetch_message_attachment_rows(conn: sqlite3.Connection) -> list[dict]:
    rows = conn.execute(
        """
        SELECT message_id, attachment_id
        FROM "message_attachment_join"
        ORDER BY message_id, attachment_id
        """
    ).fetchall()
    return [
        {
            "message_id": row["message_id"],
            "attachment_id": row["attachment_id"],
        }
        for row in rows
    ]


def first_available_column_expr(columns: set[str], names: list[str], fallback: str) -> str:
    for name in names:
        if name in columns:
            return f'"{name}"'
    return fallback


def read_contact_display_names_from_backup(backup_folder: Path) -> dict[str, str]:
    address_book_path = locate_address_book_db(backup_folder)
    if address_book_path is None:
        return {}

    conn = sqlite3.connect(f"{address_book_path.as_uri()}?mode=ro", uri=True)
    conn.row_factory = sqlite3.Row
    try:
        return fetch_address_book_contact_names(conn)
    except sqlite3.DatabaseError:
        return {}
    finally:
        conn.close()


def locate_address_book_db(backup_folder: Path) -> Path | None:
    manifest_path = backup_folder / "Manifest.db"
    try:
        manifest_row = query_manifest_file_row(manifest_path, ADDRESS_BOOK_RELATIVE_PATHS)
    except sqlite3.DatabaseError:
        manifest_row = None

    if manifest_row is not None:
        address_book_path = (backup_folder / manifest_row["fileID"][:2] / manifest_row["fileID"]).resolve()
        if not address_book_path.is_relative_to(backup_folder):
            raise UnsafeBackupPathError("Resolved AddressBook path must stay inside the backup folder.")
        if backup_file_is_present(address_book_path):
            return address_book_path

    for file_id in EXPECTED_ADDRESS_BOOK_FILE_IDS.values():
        address_book_path = (backup_folder / file_id[:2] / file_id).resolve()
        if not address_book_path.is_relative_to(backup_folder):
            continue
        if backup_file_is_present(address_book_path):
            return address_book_path

    return None


def fetch_address_book_contact_names(conn: sqlite3.Connection) -> dict[str, str]:
    table_names = get_connection_table_names(conn)
    if "ABPerson" not in table_names or "ABMultiValue" not in table_names:
        return {}

    people_by_rowid = fetch_address_book_people(conn)
    value_rows = conn.execute(
        """
        SELECT record_id, value
        FROM "ABMultiValue"
        WHERE value IS NOT NULL
        ORDER BY record_id
        """
    ).fetchall()

    names_by_handle: dict[str, str] = {}
    for row in value_rows:
        display_name = people_by_rowid.get(row["record_id"])
        if not display_name:
            continue
        lookup_key = normalize_contact_lookup_key(row["value"])
        if lookup_key:
            names_by_handle.setdefault(lookup_key, display_name)
            for alias in build_contact_lookup_aliases(row["value"]):
                names_by_handle.setdefault(alias, display_name)
    return names_by_handle


def fetch_address_book_people(conn: sqlite3.Connection) -> dict[int, str]:
    columns = get_table_columns(conn, "ABPerson")
    first_expr = first_available_column_expr(columns, ["First", "first"], "NULL")
    middle_expr = first_available_column_expr(columns, ["Middle", "middle"], "NULL")
    last_expr = first_available_column_expr(columns, ["Last", "last"], "NULL")
    org_expr = first_available_column_expr(columns, ["Organization", "organization"], "NULL")
    rows = conn.execute(
        f"""
        SELECT
          ROWID AS rowid,
          {first_expr} AS first_name,
          {middle_expr} AS middle_name,
          {last_expr} AS last_name,
          {org_expr} AS organization
        FROM "ABPerson"
        ORDER BY ROWID
        """
    ).fetchall()

    people_by_rowid = {}
    for row in rows:
        name_parts = [
            row["first_name"],
            row["middle_name"],
            row["last_name"],
        ]
        display_name = " ".join(str(part).strip() for part in name_parts if part and str(part).strip())
        if not display_name and row["organization"]:
            display_name = str(row["organization"]).strip()
        if display_name:
            people_by_rowid[row["rowid"]] = display_name
    return people_by_rowid


def normalize_contact_lookup_key(value) -> str:
    if value is None:
        return ""
    raw_value = str(value).strip()
    if not raw_value:
        return ""
    if "@" in raw_value:
        return raw_value.lower()
    digits = re.sub(r"\D", "", raw_value)
    return digits if len(digits) >= 5 else raw_value.lower()


def build_contact_lookup_aliases(value) -> list[str]:
    lookup_key = normalize_contact_lookup_key(value)
    if not lookup_key:
        return []
    aliases = {lookup_key}
    if lookup_key.isdigit():
        if len(lookup_key) == 11 and lookup_key.startswith("1"):
            aliases.add(lookup_key[1:])
        if len(lookup_key) == 10:
            aliases.add(f"1{lookup_key}")
    return sorted(aliases)


def get_connection_table_names(conn: sqlite3.Connection) -> set[str]:
    rows = conn.execute(
        """
        SELECT name
        FROM sqlite_master
        WHERE type = 'table'
        """
    ).fetchall()
    return {row["name"] if isinstance(row, sqlite3.Row) else row[0] for row in rows}


def extract_message_body_text(text, attributed_body, payload_data) -> str:
    if text:
        return str(text)

    for candidate in (attributed_body, payload_data):
        extracted = extract_readable_text_from_blob(candidate)
        if extracted:
            return extracted

    return ""


def extract_readable_text_from_blob(blob) -> str:
    if blob is None:
        return ""
    if isinstance(blob, memoryview):
        blob = blob.tobytes()
    if isinstance(blob, str):
        return blob.strip()
    if not isinstance(blob, bytes):
        return ""

    candidates = []
    for encoding in ("utf-8", "utf-16-be", "utf-16-le"):
        try:
            decoded = blob.decode(encoding, errors="ignore")
        except LookupError:
            continue
        cleaned = normalize_extracted_blob_text(decoded)
        if cleaned:
            candidates.append(cleaned)

    if not candidates:
        return ""
    return max(candidates, key=lambda value: (len(value), printable_score(value)))


def normalize_extracted_blob_text(value: str) -> str:
    runs = []
    current = []
    for char in value:
        if char in "\r\n\t" or char.isprintable():
            current.append(char)
            continue
        if current:
            runs.append("".join(current))
            current = []
    if current:
        runs.append("".join(current))

    cleaned_runs = []
    for run in runs:
        cleaned = " ".join(run.split()).strip()
        if len(cleaned) < 2:
            continue
        if printable_score(cleaned) < 0.72:
            continue
        cleaned_runs.append(cleaned)

    if not cleaned_runs:
        return ""
    return max(cleaned_runs, key=len)


def printable_score(value: str) -> float:
    if not value:
        return 0.0
    useful = sum(char.isalnum() or char.isspace() or char in ".,!?;:'\"()[]{}@#$%&*-_+=/\\|" for char in value)
    return useful / len(value)


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
    row = conn.execute(
        "SELECT id, handle, display_name FROM contacts WHERE handle = ?",
        (handle,),
    ).fetchone()
    if cursor.rowcount == 0 and should_update_contact_display_name(row, display_name):
        conn.execute(
            """
            UPDATE contacts
            SET display_name = ?
            WHERE handle = ?
            """,
            (display_name, handle),
        )
    return int(row["id"]), cursor.rowcount


def should_update_contact_display_name(row: sqlite3.Row, new_display_name: str) -> bool:
    if not new_display_name or new_display_name == format_contact_display_name(row["handle"]):
        return False
    current_display_name = row["display_name"] or ""
    return (
        not current_display_name
        or current_display_name == format_contact_display_name(row["handle"])
        or current_display_name == "Unknown sender"
    )


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
    if cursor.rowcount == 0 and message["text"]:
        cursor = conn.execute(
            """
            UPDATE messages
            SET body = ?
            WHERE source_message_id = ?
              AND body = ''
            """,
            (message["text"], str(message["rowid"])),
        )
    return cursor.rowcount


def copy_iphone_attachment_file(
    *,
    attachment: dict,
    backup_folder: Path,
    project_dir: Path,
    import_stem: str,
    data_dir: Path | None = None,
) -> dict:
    source_path = resolve_iphone_attachment_backup_path(attachment, backup_folder)
    if source_path is None:
        return {"copied": 0, "local_path": None}

    resolved_data_dir = resolve_data_dir(project_dir, data_dir)
    destination_root = (resolved_data_dir / "attachments" / "iphone" / import_stem).resolve()
    destination_root.mkdir(parents=True, exist_ok=True)

    destination_name = build_attachment_destination_name(attachment)
    destination_path = (destination_root / destination_name).resolve()
    if not destination_path.is_relative_to(destination_root):
        raise UnsafeBackupPathError("Attachment destination path must stay inside the configured attachments folder.")

    copied = 0
    if not destination_path.exists():
        shutil.copy2(source_path, destination_path)
        copied = 1

    return {
        "copied": copied,
        "local_path": build_stored_local_path(destination_path, project_dir),
    }


def resolve_data_dir(project_dir: Path, data_dir: Path | None = None) -> Path:
    if data_dir is None:
        return (project_dir / "data").resolve()
    return Path(data_dir).expanduser().resolve()


def get_iphone_import_root(project_dir: Path, data_dir: Path | None = None) -> Path:
    return (resolve_data_dir(project_dir, data_dir) / "imports" / "iphone").resolve()


def build_stored_local_path(destination_path: Path, project_dir: Path) -> str:
    resolved_project_dir = project_dir.resolve()
    if destination_path.is_relative_to(resolved_project_dir):
        return str(destination_path.relative_to(resolved_project_dir))
    return str(destination_path)


def resolve_iphone_attachment_backup_path(attachment: dict, backup_folder: Path) -> Path | None:
    manifest_relative_paths = build_attachment_manifest_relative_path_candidates(attachment["filename"])
    if not manifest_relative_paths:
        return None

    try:
        manifest_row = query_manifest_file_row(backup_folder / "Manifest.db", manifest_relative_paths)
    except sqlite3.DatabaseError:
        return None
    if manifest_row is None:
        return None

    file_id = manifest_row["fileID"]
    source_path = (backup_folder / file_id[:2] / file_id).resolve()
    if not source_path.is_relative_to(backup_folder):
        raise UnsafeBackupPathError("Resolved attachment path must stay inside the backup folder.")
    if not source_path.is_file():
        return None
    return source_path


def build_attachment_manifest_relative_path_candidates(filename) -> list[str]:
    if not filename:
        return []

    value = str(filename).strip().replace("\\", "/")
    prefixes = (
        "~/",
        "/private/var/mobile/",
        "/var/mobile/",
    )
    for prefix in prefixes:
        if value.startswith(prefix):
            value = value[len(prefix):]
            break

    marker = "Library/SMS/Attachments/"
    if marker in value:
        value = value[value.index(marker):]
    elif value.startswith("Attachments/"):
        value = f"Library/SMS/{value}"
    elif not value.startswith("Library/SMS/"):
        return []

    return [value]


def build_attachment_destination_name(attachment: dict) -> str:
    original_filename = attachment["transfer_name"] or basename_or_none(attachment["filename"]) or "attachment"
    safe_name = re.sub(r"[^A-Za-z0-9._-]+", "_", original_filename).strip("._")
    if not safe_name:
        safe_name = "attachment"
    return f"{attachment['rowid']}-{safe_name}"


def upsert_iphone_attachment_metadata(
    conn: sqlite3.Connection,
    attachment: dict,
    *,
    local_path: str | None = None,
) -> tuple[int, int]:
    source_ref = build_iphone_attachment_source_ref(attachment)
    original_filename = attachment["transfer_name"] or basename_or_none(attachment["filename"])
    existing_row = conn.execute(
        "SELECT id FROM attachments WHERE source_ref = ?",
        (source_ref,),
    ).fetchone()
    normalized_byte_size = normalize_byte_size(attachment["byte_size"])
    if existing_row:
        conn.execute(
            """
            UPDATE attachments
            SET
              original_filename = COALESCE(?, original_filename),
              mime_type = COALESCE(?, mime_type),
              local_path = COALESCE(?, local_path),
              byte_size = COALESCE(?, byte_size)
            WHERE source_ref = ?
            """,
            (
                original_filename,
                attachment["mime_type"],
                local_path,
                normalized_byte_size,
                source_ref,
            ),
        )
        return int(existing_row["id"]), 0

    cursor = conn.execute(
        """
        INSERT INTO attachments (
          source_ref,
          original_filename,
          mime_type,
          local_path,
          byte_size
        )
        VALUES (?, ?, ?, ?, ?)
        """,
        (
            source_ref,
            original_filename,
            attachment["mime_type"],
            local_path,
            normalized_byte_size,
        ),
    )
    return int(cursor.lastrowid), cursor.rowcount


def build_iphone_attachment_source_ref(attachment: dict) -> str:
    filename = attachment["filename"] or ""
    return f"iphone-attachment:{attachment['rowid']}:{filename}"


def basename_or_none(value) -> str | None:
    if not value:
        return None
    return Path(str(value)).name


def normalize_byte_size(value) -> int | None:
    if value in (None, ""):
        return None
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def get_archive_message_id(conn: sqlite3.Connection, source_message_id) -> int | None:
    row = conn.execute(
        "SELECT id FROM messages WHERE source_message_id = ?",
        (str(source_message_id),),
    ).fetchone()
    return int(row["id"]) if row else None


def insert_message_attachment_link(
    conn: sqlite3.Connection,
    *,
    message_id: int,
    attachment_id: int,
) -> int:
    cursor = conn.execute(
        """
        INSERT OR IGNORE INTO message_attachments (message_id, attachment_id)
        VALUES (?, ?)
        """,
        (message_id, attachment_id),
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


def query_manifest_file_row(manifest_path: Path, relative_paths: list[str]) -> sqlite3.Row | None:
    if not relative_paths:
        return None

    conn = sqlite3.connect(f"{manifest_path.as_uri()}?mode=ro", uri=True)
    conn.row_factory = sqlite3.Row
    try:
        placeholders = ", ".join("?" for _ in relative_paths)
        return conn.execute(
            f"""
            SELECT fileID, domain, relativePath
            FROM Files
            WHERE domain = ?
              AND relativePath IN ({placeholders})
            LIMIT 1
            """,
            (SMS_DOMAIN, *relative_paths),
        ).fetchone()
    finally:
        conn.close()
