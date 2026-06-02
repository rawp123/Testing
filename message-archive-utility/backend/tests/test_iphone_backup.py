import asyncio
import sqlite3
from pathlib import Path

import pytest

from server import main as app_main
from server.importers.iphone_backup import (
    EXPECTED_SMS_TABLES,
    SmsDbNotFoundError,
    UnsafeBackupPathError,
    copy_sms_db_from_backup,
    extract_message_body_text,
    import_copied_sms_db_messages,
    insert_iphone_message,
    inspect_copied_sms_db_metadata,
    locate_sms_db_dry_run,
    validate_copied_sms_db,
)


FAKE_FILE_ID = "3d0d7e5fb2ce288813306e4d4636395e047a3d28"
FAKE_ATTACHMENT_FILE_ID = "aabbccddeeff0011223344556677889900aabbcc"
FAKE_ADDRESS_BOOK_FILE_ID = "31bb7ba8914766d4ba40d6dfb6113c8b614be442"


def test_locates_sms_db_from_fake_manifest(tmp_path):
    backup_folder = tmp_path / "fake-backup"
    backup_folder.mkdir()
    create_fake_manifest(backup_folder / "Manifest.db", include_sms=True)

    result = locate_sms_db_dry_run(str(backup_folder))

    assert result == {
        "sms_db_found": True,
        "domain": "HomeDomain",
        "relativePath": "Library/SMS/sms.db",
        "fileID": FAKE_FILE_ID,
        "expected_backup_file_path": str(backup_folder / FAKE_FILE_ID[:2] / FAKE_FILE_ID),
        "manifest_readable": True,
        "locator": "manifest",
    }


def test_returns_not_found_when_fake_manifest_has_no_sms_row(tmp_path):
    backup_folder = tmp_path / "fake-backup"
    backup_folder.mkdir()
    create_fake_manifest(backup_folder / "Manifest.db", include_sms=False)

    result = locate_sms_db_dry_run(str(backup_folder))

    assert result == {
        "sms_db_found": False,
        "domain": "HomeDomain",
        "relativePath": "Library/SMS/sms.db",
        "fileID": None,
        "expected_backup_file_path": str(backup_folder / FAKE_FILE_ID[:2] / FAKE_FILE_ID),
        "manifest_readable": True,
        "locator": "manifest",
    }


def test_locates_sms_db_by_known_file_id_when_manifest_is_unreadable(tmp_path):
    backup_folder = tmp_path / "fake-backup"
    backup_folder.mkdir()
    (backup_folder / "Manifest.db").write_bytes(b"not a sqlite database")
    source_path = backup_folder / FAKE_FILE_ID[:2] / FAKE_FILE_ID
    source_path.parent.mkdir()
    create_fake_sms_db(source_path, EXPECTED_SMS_TABLES)

    result = locate_sms_db_dry_run(str(backup_folder))

    assert result == {
        "sms_db_found": True,
        "domain": "HomeDomain",
        "relativePath": "Library/SMS/sms.db",
        "fileID": FAKE_FILE_ID,
        "expected_backup_file_path": str(source_path),
        "manifest_readable": False,
        "locator": "known_sms_db_file",
    }


def test_locates_sms_db_by_schema_scan_when_manifest_is_unreadable(tmp_path):
    backup_folder = tmp_path / "fake-backup"
    backup_folder.mkdir()
    (backup_folder / "Manifest.db").write_bytes(b"not a sqlite database")
    source_path = backup_folder / "aa" / "aabbccddeeff0011223344556677889900aabbcc"
    source_path.parent.mkdir()
    create_fake_sms_db(source_path, EXPECTED_SMS_TABLES)

    result = locate_sms_db_dry_run(str(backup_folder))

    assert result["sms_db_found"] is True
    assert result["manifest_readable"] is False
    assert result["locator"] == "schema_scan"
    assert result["expected_backup_file_path"] == str(source_path)


def test_locates_sms_db_by_schema_scan_when_manifest_file_is_missing(tmp_path):
    backup_folder = tmp_path / "fake-backup"
    backup_folder.mkdir()
    create_fake_manifest(backup_folder / "Manifest.db", include_sms=True)
    source_path = backup_folder / "aa" / "aabbccddeeff0011223344556677889900aabbcc"
    source_path.parent.mkdir()
    create_fake_sms_db(source_path, EXPECTED_SMS_TABLES)

    result = locate_sms_db_dry_run(str(backup_folder))

    assert result["sms_db_found"] is True
    assert result["manifest_readable"] is True
    assert result["locator"] == "schema_scan"
    assert result["expected_backup_file_path"] == str(source_path)


def test_unreadable_manifest_without_known_sms_db_returns_not_found(tmp_path):
    backup_folder = tmp_path / "fake-backup"
    backup_folder.mkdir()
    (backup_folder / "Manifest.db").write_bytes(b"not a sqlite database")

    result = locate_sms_db_dry_run(str(backup_folder))

    assert result == {
        "sms_db_found": False,
        "domain": "HomeDomain",
        "relativePath": "Library/SMS/sms.db",
        "fileID": None,
        "expected_backup_file_path": str(backup_folder / FAKE_FILE_ID[:2] / FAKE_FILE_ID),
        "manifest_readable": False,
        "locator": "known_sms_db_file",
    }


def test_requires_manifest_inside_provided_folder(tmp_path):
    backup_folder = tmp_path / "fake-backup"
    backup_folder.mkdir()

    with pytest.raises(FileNotFoundError):
        locate_sms_db_dry_run(str(backup_folder))


def test_diagnostics_endpoint_reports_usable_fake_backup(tmp_path, monkeypatch):
    backup_folder = tmp_path / "fake-backup"
    backup_folder.mkdir()
    create_fake_manifest(backup_folder / "Manifest.db", include_sms=True)
    source_path = backup_folder / FAKE_FILE_ID[:2] / FAKE_FILE_ID
    source_path.parent.mkdir()
    create_fake_sms_db(source_path, ["message"])
    monkeypatch.setenv("MESSAGE_ARCHIVE_DB_PATH", str(tmp_path / "archive.sqlite3"))

    assert route_exists("/import/iphone-backup/diagnostics", "POST")

    result = app_main.iphone_backup_diagnostics(
        app_main.IPhoneBackupDryRunRequest(backup_folder_path=str(backup_folder)),
    )

    assert result == {
        "backup_folder_exists": True,
        "backup_folder_is_directory": True,
        "manifest_exists": True,
        "manifest_readable_sqlite": True,
        "manifest_appears_truncated": False,
        "backup_appears_encrypted": False,
        "sms_db_manifest_entry_exists": True,
        "sms_db_payload_exists": True,
        "sms_db_payload_nonzero": True,
        "sms_db_payload_size_bytes": source_path.stat().st_size,
        "usable_without_import": True,
    }


def test_diagnostics_endpoint_flags_non_sqlite_message_payload(tmp_path, monkeypatch):
    backup_folder = tmp_path / "fake-backup"
    backup_folder.mkdir()
    create_fake_manifest(backup_folder / "Manifest.db", include_sms=True)
    source_path = backup_folder / FAKE_FILE_ID[:2] / FAKE_FILE_ID
    source_path.parent.mkdir()
    source_path.write_bytes(b"not a sqlite payload")
    monkeypatch.setenv("MESSAGE_ARCHIVE_DB_PATH", str(tmp_path / "archive.sqlite3"))

    result = app_main.iphone_backup_diagnostics(
        app_main.IPhoneBackupDryRunRequest(backup_folder_path=str(backup_folder)),
    )

    assert result["sms_db_payload_exists"] is True
    assert result["sms_db_payload_nonzero"] is True
    assert result["backup_appears_encrypted"] is True
    assert result["usable_without_import"] is False
    assert_no_private_import_api_fields(result)


def test_diagnostics_endpoint_returns_safe_shape_for_missing_backup(tmp_path, monkeypatch):
    monkeypatch.setenv("MESSAGE_ARCHIVE_DB_PATH", str(tmp_path / "archive.sqlite3"))

    result = app_main.iphone_backup_diagnostics(
        app_main.IPhoneBackupDryRunRequest(backup_folder_path=str(tmp_path / "missing-backup")),
    )

    assert result["backup_folder_exists"] is False
    assert result["usable_without_import"] is False
    assert "backup_folder_path" not in result
    assert "expected_backup_file_path" not in result


def test_dry_run_endpoint_omits_private_backup_paths_and_ids(tmp_path):
    backup_folder = tmp_path / "fake-backup"
    backup_folder.mkdir()
    create_fake_manifest(backup_folder / "Manifest.db", include_sms=True)
    source_path = backup_folder / FAKE_FILE_ID[:2] / FAKE_FILE_ID
    source_path.parent.mkdir()
    source_path.write_bytes(b"fake sms database bytes")

    result = app_main.iphone_backup_dry_run(
        app_main.IPhoneBackupDryRunRequest(backup_folder_path=str(backup_folder)),
    )

    assert result == {
        "sms_db_found": True,
        "manifest_readable": True,
        "locator": "manifest",
    }
    assert_no_private_import_api_fields(result)


def test_backup_candidates_endpoint_returns_opaque_candidate_ids(tmp_path, monkeypatch):
    backup_folder = tmp_path / "fake-backup"
    backup_folder.mkdir()
    create_fake_manifest(backup_folder / "Manifest.db", include_sms=True)
    source_path = backup_folder / FAKE_FILE_ID[:2] / FAKE_FILE_ID
    source_path.parent.mkdir()
    create_fake_sms_db(source_path, ["message"])
    monkeypatch.setenv("MESSAGE_ARCHIVE_IPHONE_BACKUP_PATHS", str(backup_folder))

    result = app_main.iphone_backup_candidates()

    assert result["default_candidate_id"] == "backup-1"
    assert result["default_path"] == ""
    assert result["candidates"][0]["id"] == "backup-1"
    assert result["candidates"][0]["name"] == "Local iPhone backup 1"
    assert "path" not in result["candidates"][0]
    assert str(backup_folder) not in str(result)


def test_copy_sms_db_endpoint_returns_safe_prepared_import_reference(tmp_path, monkeypatch):
    backup_folder = tmp_path / "fake-backup"
    backup_folder.mkdir()
    create_fake_manifest(backup_folder / "Manifest.db", include_sms=True)
    source_path = backup_folder / FAKE_FILE_ID[:2] / FAKE_FILE_ID
    source_path.parent.mkdir()
    source_path.write_bytes(b"fake sms database bytes")
    app_data_dir = tmp_path / "app-data"
    monkeypatch.setenv("MESSAGE_ARCHIVE_DATA_DIR", str(app_data_dir))

    result = app_main.iphone_backup_copy_sms_db(
        app_main.IPhoneBackupDryRunRequest(backup_folder_path=str(backup_folder)),
    )

    assert result["copied"] is True
    assert result["destination_path"].startswith("sms_import_")
    assert (app_data_dir / "imports" / "iphone" / result["destination_path"]).is_file()
    assert_no_private_import_api_fields(result)


def test_local_api_token_validation_accepts_only_header_token():
    expected_token = "fake-launch-token"

    assert app_main.is_valid_api_token(expected_token, expected_token)
    assert not app_main.is_valid_api_token(None, expected_token)
    assert not app_main.is_valid_api_token("wrong-token", expected_token)


def test_local_api_routes_require_token_except_root_health_and_options():
    assert not app_main.route_requires_api_token("/", "GET")
    assert not app_main.route_requires_api_token("/health", "GET")
    assert not app_main.route_requires_api_token("/archive/stats", "OPTIONS")
    assert app_main.route_requires_api_token("/archive/stats", "GET")
    assert app_main.route_requires_api_token("/conversations", "GET")
    assert app_main.route_requires_api_token("/export/messages.pdf", "GET")
    assert app_main.route_requires_api_token("/attachments/1", "GET")
    assert app_main.route_requires_api_token("/import/iphone-backup/candidates", "GET")


def test_route_inventory_is_token_protected_by_default():
    exposed_paths = {
        route.path
        for route in app_main.app.routes
        if getattr(route, "include_in_schema", True)
    }

    assert "/openapi.json" not in exposed_paths
    assert "/docs" not in exposed_paths
    assert "/redoc" not in exposed_paths
    assert all(
        not path.startswith("/api")
        for path in exposed_paths
    )
    assert all(
        path in app_main.UNAUTHENTICATED_PATHS
        or app_main.route_requires_api_token(path, "GET")
        for path in exposed_paths
    )


def test_health_response_does_not_expose_private_paths(monkeypatch, tmp_path):
    monkeypatch.setenv("MESSAGE_ARCHIVE_DATA_DIR", str(tmp_path / "private-data"))
    monkeypatch.setenv("MESSAGE_ARCHIVE_DB_PATH", str(tmp_path / "private-data" / "archive.sqlite3"))
    monkeypatch.setenv("MESSAGE_ARCHIVE_API_TOKEN", "fake-launch-token")

    result = app_main.health()

    assert result == {
        "status": "ok",
        "app": "message-archive-utility",
        "storage": "local",
        "desktop_mode": False,
        "auth_required": True,
    }
    assert "data_dir" not in result
    assert "db_path" not in result


def test_protected_api_fails_closed_without_configured_token(monkeypatch, tmp_path):
    monkeypatch.delenv("MESSAGE_ARCHIVE_API_TOKEN", raising=False)
    monkeypatch.setenv("MESSAGE_ARCHIVE_DB_PATH", str(tmp_path / "archive.sqlite3"))
    monkeypatch.setenv("MESSAGE_ARCHIVE_DATA_DIR", str(tmp_path / "data"))

    response = run_token_middleware("/archive/stats", "GET", headers={})

    assert response.status_code == 401


def test_protected_api_requires_matching_token(monkeypatch, tmp_path):
    monkeypatch.setenv("MESSAGE_ARCHIVE_API_TOKEN", "fake-launch-token")
    monkeypatch.setenv("MESSAGE_ARCHIVE_DB_PATH", str(tmp_path / "archive.sqlite3"))
    monkeypatch.setenv("MESSAGE_ARCHIVE_DATA_DIR", str(tmp_path / "data"))

    no_token = run_token_middleware("/archive/stats", "GET", headers={})
    wrong_token = run_token_middleware("/archive/stats", "GET", headers={app_main.API_TOKEN_HEADER: "wrong"})
    valid_token = run_token_middleware(
        "/archive/stats",
        "GET",
        headers={app_main.API_TOKEN_HEADER: "fake-launch-token"},
    )

    assert no_token.status_code == 401
    assert wrong_token.status_code == 401
    assert valid_token.status_code == 200


def test_copies_fake_backup_file_to_ignored_import_folder(tmp_path):
    backup_folder = tmp_path / "fake-backup"
    backup_folder.mkdir()
    create_fake_manifest(backup_folder / "Manifest.db", include_sms=True)
    source_path = backup_folder / FAKE_FILE_ID[:2] / FAKE_FILE_ID
    source_path.parent.mkdir()
    source_path.write_bytes(b"fake sms database bytes, no message content")
    project_dir = tmp_path / "project"

    result = copy_sms_db_from_backup(
        str(backup_folder),
        project_dir,
        timestamp="20260101T120000Z",
    )

    destination = project_dir / "data" / "imports" / "iphone" / "sms_import_20260101T120000Z.db"
    assert result["copied"] is True
    assert result["parsed"] is False
    assert result["fileID"] == FAKE_FILE_ID
    assert result["manifest_readable"] is True
    assert result["locator"] == "manifest"
    assert result["source_path"] == str(source_path)
    assert result["destination_path"] == str(destination)
    assert destination.read_bytes() == b"fake sms database bytes, no message content"


def test_copies_fake_backup_file_to_configured_data_dir(tmp_path):
    backup_folder = tmp_path / "fake-backup"
    backup_folder.mkdir()
    create_fake_manifest(backup_folder / "Manifest.db", include_sms=True)
    source_path = backup_folder / FAKE_FILE_ID[:2] / FAKE_FILE_ID
    source_path.parent.mkdir()
    source_path.write_bytes(b"fake sms database bytes")
    project_dir = tmp_path / "project"
    data_dir = tmp_path / "app-support"

    result = copy_sms_db_from_backup(
        str(backup_folder),
        project_dir,
        timestamp="20260101T120000Z",
        data_dir=data_dir,
    )

    destination = data_dir / "imports" / "iphone" / "sms_import_20260101T120000Z.db"
    assert result["destination_path"] == str(destination)
    assert destination.read_bytes() == b"fake sms database bytes"


def test_validation_uses_configured_data_dir(tmp_path):
    project_dir = tmp_path / "project"
    data_dir = tmp_path / "app-support"
    copied_sms_db = data_dir / "imports" / "iphone" / "sms_import_20260101T120000Z.db"
    copied_sms_db.parent.mkdir(parents=True)
    create_fake_sms_db(copied_sms_db, EXPECTED_SMS_TABLES)

    result = validate_copied_sms_db(str(copied_sms_db), project_dir, data_dir=data_dir)

    assert result["valid"] is True


def test_validation_accepts_prepared_import_filename(tmp_path):
    project_dir = tmp_path / "project"
    data_dir = tmp_path / "app-support"
    copied_sms_db = data_dir / "imports" / "iphone" / "sms_import_20260101T120000Z.db"
    copied_sms_db.parent.mkdir(parents=True)
    create_fake_sms_db(copied_sms_db, EXPECTED_SMS_TABLES)

    result = validate_copied_sms_db(copied_sms_db.name, project_dir, data_dir=data_dir)

    assert result["valid"] is True


def test_copies_known_sms_db_file_when_manifest_is_unreadable(tmp_path):
    backup_folder = tmp_path / "fake-backup"
    backup_folder.mkdir()
    (backup_folder / "Manifest.db").write_bytes(b"not a sqlite database")
    source_path = backup_folder / FAKE_FILE_ID[:2] / FAKE_FILE_ID
    source_path.parent.mkdir()
    create_fake_sms_db(source_path, EXPECTED_SMS_TABLES)
    project_dir = tmp_path / "project"

    result = copy_sms_db_from_backup(
        str(backup_folder),
        project_dir,
        timestamp="20260101T120000Z",
    )

    destination = project_dir / "data" / "imports" / "iphone" / "sms_import_20260101T120000Z.db"
    assert result["copied"] is True
    assert result["manifest_readable"] is False
    assert result["locator"] == "known_sms_db_file"
    assert result["source_path"] == str(source_path)
    assert destination.read_bytes() == source_path.read_bytes()


def test_copies_schema_scanned_sms_db_when_manifest_file_is_missing(tmp_path):
    backup_folder = tmp_path / "fake-backup"
    backup_folder.mkdir()
    create_fake_manifest(backup_folder / "Manifest.db", include_sms=True)
    source_path = backup_folder / "aa" / "aabbccddeeff0011223344556677889900aabbcc"
    source_path.parent.mkdir()
    create_fake_sms_db(source_path, EXPECTED_SMS_TABLES)
    project_dir = tmp_path / "project"

    result = copy_sms_db_from_backup(
        str(backup_folder),
        project_dir,
        timestamp="20260101T120000Z",
    )

    destination = project_dir / "data" / "imports" / "iphone" / "sms_import_20260101T120000Z.db"
    assert result["copied"] is True
    assert result["locator"] == "schema_scan"
    assert result["source_path"] == str(source_path)
    assert destination.is_file()


def test_copy_fails_when_manifest_has_no_sms_row(tmp_path):
    backup_folder = tmp_path / "fake-backup"
    backup_folder.mkdir()
    create_fake_manifest(backup_folder / "Manifest.db", include_sms=False)

    with pytest.raises(SmsDbNotFoundError):
        copy_sms_db_from_backup(str(backup_folder), tmp_path / "project")


def test_copy_does_not_overwrite_existing_import_file(tmp_path):
    backup_folder = tmp_path / "fake-backup"
    backup_folder.mkdir()
    create_fake_manifest(backup_folder / "Manifest.db", include_sms=True)
    source_path = backup_folder / FAKE_FILE_ID[:2] / FAKE_FILE_ID
    source_path.parent.mkdir()
    source_path.write_bytes(b"fake sms database bytes")
    project_dir = tmp_path / "project"
    destination = project_dir / "data" / "imports" / "iphone" / "sms_import_20260101T120000Z.db"
    destination.parent.mkdir(parents=True)
    destination.write_bytes(b"existing fake import")

    with pytest.raises(FileExistsError):
        copy_sms_db_from_backup(
            str(backup_folder),
            project_dir,
            timestamp="20260101T120000Z",
        )

    assert destination.read_bytes() == b"existing fake import"


def test_validates_fake_sms_schema_without_reading_message_contents(tmp_path):
    project_dir = tmp_path / "project"
    copied_sms_db = project_dir / "data" / "imports" / "iphone" / "sms_import_20260101T120000Z.db"
    copied_sms_db.parent.mkdir(parents=True)
    create_fake_sms_db(copied_sms_db, EXPECTED_SMS_TABLES)

    result = validate_copied_sms_db(str(copied_sms_db), project_dir)

    assert result == {
        "valid": True,
        "present_tables": sorted(EXPECTED_SMS_TABLES),
        "missing_tables": [],
        "parsed": False,
        "message_contents_read": False,
    }


def test_validation_reports_missing_fake_sms_tables(tmp_path):
    project_dir = tmp_path / "project"
    copied_sms_db = project_dir / "data" / "imports" / "iphone" / "sms_import_20260101T120000Z.db"
    copied_sms_db.parent.mkdir(parents=True)
    create_fake_sms_db(copied_sms_db, {"message", "handle"})

    result = validate_copied_sms_db(str(copied_sms_db), project_dir)

    assert result["valid"] is False
    assert result["present_tables"] == ["handle", "message"]
    assert result["missing_tables"] == [
        "attachment",
        "chat",
        "chat_message_join",
        "message_attachment_join",
    ]
    assert result["parsed"] is False
    assert result["message_contents_read"] is False


def test_validation_rejects_paths_outside_import_folder(tmp_path):
    project_dir = tmp_path / "project"
    outside_db = tmp_path / "outside.db"
    create_fake_sms_db(outside_db, EXPECTED_SMS_TABLES)

    with pytest.raises(UnsafeBackupPathError):
        validate_copied_sms_db(str(outside_db), project_dir)


def test_inspects_fake_sms_metadata_without_reading_message_contents(tmp_path):
    project_dir = tmp_path / "project"
    copied_sms_db = project_dir / "data" / "imports" / "iphone" / "sms_import_20260101T120000Z.db"
    copied_sms_db.parent.mkdir(parents=True)
    create_fake_sms_metadata_db(copied_sms_db)

    result = inspect_copied_sms_db_metadata(str(copied_sms_db), project_dir)

    assert result == {
        "inspected": True,
        "valid": True,
        "row_counts": {
            "attachment": 2,
            "chat": 1,
            "chat_message_join": 2,
            "handle": 2,
            "message": 3,
            "message_attachment_join": 1,
        },
        "min_message_date": 100,
        "max_message_date": 300,
        "parsed": False,
        "message_contents_read": False,
    }


def test_inspection_returns_empty_date_range_when_message_date_is_unavailable(tmp_path):
    project_dir = tmp_path / "project"
    copied_sms_db = project_dir / "data" / "imports" / "iphone" / "sms_import_20260101T120000Z.db"
    copied_sms_db.parent.mkdir(parents=True)
    create_fake_sms_db(copied_sms_db, EXPECTED_SMS_TABLES)

    result = inspect_copied_sms_db_metadata(str(copied_sms_db), project_dir)

    assert result["inspected"] is True
    assert result["row_counts"]["message"] == 0
    assert result["min_message_date"] is None
    assert result["max_message_date"] is None
    assert result["parsed"] is False
    assert result["message_contents_read"] is False


def test_inspection_rejects_paths_outside_import_folder(tmp_path):
    project_dir = tmp_path / "project"
    outside_db = tmp_path / "outside.db"
    create_fake_sms_metadata_db(outside_db)

    with pytest.raises(UnsafeBackupPathError):
        inspect_copied_sms_db_metadata(str(outside_db), project_dir)


def test_imports_fake_iphone_messages_into_normalized_archive(tmp_path):
    project_dir = tmp_path / "project"
    copied_sms_db = project_dir / "data" / "imports" / "iphone" / "sms_import_20260101T120000Z.db"
    copied_sms_db.parent.mkdir(parents=True)
    create_fake_sms_import_db(copied_sms_db)
    archive_conn = create_archive_connection()

    result = import_copied_sms_db_messages(str(copied_sms_db), project_dir, archive_conn)

    assert result == {
        "attachments_imported": 1,
        "attachment_files_copied": 0,
        "message_attachment_links_imported": 1,
        "contacts_imported": 3,
        "contacts_named": 0,
        "conversations_imported": 1,
        "conversation_participants_imported": 2,
        "messages_imported": 2,
    }
    assert "hello from fake iphone" not in str(result)

    contacts = archive_conn.execute(
        "SELECT handle, display_name, handle_type FROM contacts ORDER BY handle"
    ).fetchall()
    assert [dict(row) for row in contacts] == [
        {
            "handle": "+15550001111",
            "display_name": "(555) 000-1111",
            "handle_type": "iphone",
        },
        {
            "handle": "+15550002222",
            "display_name": "(555) 000-2222",
            "handle_type": "iphone",
        },
        {
            "handle": "iphone:self",
            "display_name": "Me",
            "handle_type": "iphone_self",
        },
    ]

    conversation = archive_conn.execute(
        "SELECT source_thread_id, title FROM conversations"
    ).fetchone()
    assert dict(conversation) == {
        "source_thread_id": "iphone-chat:1",
        "title": "Fake chat",
    }

    messages = archive_conn.execute(
        """
        SELECT source_message_id, direction, sent_at, body, service
        FROM messages
        ORDER BY source_message_id
        """
    ).fetchall()
    assert [dict(row) for row in messages] == [
        {
            "source_message_id": "1",
            "direction": "incoming",
            "sent_at": "2001-01-01T00:00:00+00:00",
            "body": "hello from fake iphone",
            "service": "iMessage",
        },
        {
            "source_message_id": "2",
            "direction": "outgoing",
            "sent_at": "2001-01-01T00:00:05+00:00",
            "body": "fake reply from me",
            "service": "SMS",
        },
    ]
    attachment = archive_conn.execute(
        """
        SELECT
          source_ref,
          source_relative_path,
          original_filename,
          mime_type,
          local_path,
          byte_size,
          availability_status,
          imported_at
        FROM attachments
        """
    ).fetchone()
    attachment_data = dict(attachment)
    imported_at = attachment_data.pop("imported_at")
    assert imported_at
    assert attachment_data == {
        "source_ref": "iphone-attachment:1:not-imported.jpg",
        "source_relative_path": None,
        "original_filename": "not-imported.jpg",
        "mime_type": None,
        "local_path": None,
        "byte_size": None,
        "availability_status": "metadata_only",
    }
    linked_source_message = archive_conn.execute(
        """
        SELECT messages.source_message_id
        FROM message_attachments
        JOIN messages ON messages.id = message_attachments.message_id
        """
    ).fetchone()
    assert linked_source_message["source_message_id"] == "1"


def test_import_stores_safe_attachment_metadata_and_message_link(tmp_path):
    project_dir = tmp_path / "project"
    copied_sms_db = project_dir / "data" / "imports" / "iphone" / "sms_import_20260101T120000Z.db"
    copied_sms_db.parent.mkdir(parents=True)
    create_fake_sms_import_db(
        copied_sms_db,
        attachment_filename="/private/var/mobile/Library/SMS/Attachments/fake/photo.jpg",
        transfer_name="photo.jpg",
        mime_type="image/jpeg",
        byte_size=8,
    )
    archive_conn = create_archive_connection()

    result = import_copied_sms_db_messages(str(copied_sms_db), project_dir, archive_conn)

    assert result["attachments_imported"] == 1
    assert result["message_attachment_links_imported"] == 1
    attachment = archive_conn.execute(
        """
        SELECT
          attachments.source_relative_path,
          attachments.original_filename,
          attachments.mime_type,
          attachments.local_path,
          attachments.byte_size,
          attachments.availability_status,
          messages.source_message_id
        FROM attachments
        JOIN message_attachments ON message_attachments.attachment_id = attachments.id
        JOIN messages ON messages.id = message_attachments.message_id
        """
    ).fetchone()
    assert dict(attachment) == {
        "source_relative_path": "Library/SMS/Attachments/fake/photo.jpg",
        "original_filename": "photo.jpg",
        "mime_type": "image/jpeg",
        "local_path": None,
        "byte_size": 8,
        "availability_status": "metadata_only",
        "source_message_id": "1",
    }


def test_conversation_api_returns_only_safe_attachment_display_metadata(tmp_path, monkeypatch):
    project_dir = tmp_path / "project"
    copied_sms_db = project_dir / "data" / "imports" / "iphone" / "sms_import_20260101T120000Z.db"
    copied_sms_db.parent.mkdir(parents=True)
    create_fake_sms_import_db(
        copied_sms_db,
        attachment_filename="/private/var/mobile/Library/SMS/Attachments/fake/photo.jpg",
        transfer_name="photo.jpg",
        mime_type="image/jpeg",
        byte_size=8,
    )
    archive_conn = create_archive_connection()
    import_copied_sms_db_messages(str(copied_sms_db), project_dir, archive_conn)
    conversation_id = archive_conn.execute("SELECT id FROM conversations").fetchone()["id"]
    monkeypatch.setattr(app_main, "get_connection", lambda: archive_conn)

    response = app_main.list_conversation_messages(conversation_id)

    message = next(message for message in response["messages"] if message["attachments"])
    attachment = message["attachments"][0]
    assert attachment == {
        "mime_type": "image/jpeg",
        "available": False,
        "availability_status": "metadata_only",
    }
    assert "original_filename" not in attachment
    assert "source_relative_path" not in attachment
    assert "local_path" not in attachment
    assert "url" not in attachment
    assert "id" not in attachment


def test_conversation_api_includes_render_url_only_for_available_image_attachment(tmp_path, monkeypatch):
    backup_folder = tmp_path / "fake-backup"
    backup_folder.mkdir()
    create_fake_manifest(
        backup_folder / "Manifest.db",
        include_sms=True,
        extra_files=[
            (
                FAKE_ATTACHMENT_FILE_ID,
                "MediaDomain",
                "Library/SMS/Attachments/fake/photo.jpg",
            ),
        ],
    )
    attachment_source = backup_folder / FAKE_ATTACHMENT_FILE_ID[:2] / FAKE_ATTACHMENT_FILE_ID
    attachment_source.parent.mkdir()
    attachment_source.write_bytes(b"fake jpg")
    project_dir = tmp_path / "project"
    copied_sms_db = project_dir / "data" / "imports" / "iphone" / "sms_import_20260101T120000Z.db"
    copied_sms_db.parent.mkdir(parents=True)
    create_fake_sms_import_db(
        copied_sms_db,
        attachment_filename="~/Library/SMS/Attachments/fake/photo.jpg",
        transfer_name="photo.jpg",
        mime_type="image/jpeg",
        byte_size=8,
    )
    archive_conn = create_archive_connection()
    import_copied_sms_db_messages(
        str(copied_sms_db),
        project_dir,
        archive_conn,
        backup_folder_path=str(backup_folder),
    )
    conversation_id = archive_conn.execute("SELECT id FROM conversations").fetchone()["id"]
    attachment_id = archive_conn.execute("SELECT id FROM attachments").fetchone()["id"]
    monkeypatch.setattr(app_main, "get_connection", lambda: archive_conn)

    response = app_main.list_conversation_messages(conversation_id)

    message = next(message for message in response["messages"] if message["attachments"])
    attachment = message["attachments"][0]
    assert attachment == {
        "mime_type": "image/jpeg",
        "available": True,
        "availability_status": "available",
        "render_url": f"/attachments/{attachment_id}",
    }
    assert_no_private_attachment_api_fields(attachment)


def test_conversation_api_omits_render_url_for_available_non_image_attachment(tmp_path, monkeypatch):
    backup_folder = tmp_path / "fake-backup"
    backup_folder.mkdir()
    create_fake_manifest(
        backup_folder / "Manifest.db",
        include_sms=True,
        extra_files=[
            (
                FAKE_ATTACHMENT_FILE_ID,
                "HomeDomain",
                "Library/SMS/Attachments/fake/file.pdf",
            ),
        ],
    )
    attachment_source = backup_folder / FAKE_ATTACHMENT_FILE_ID[:2] / FAKE_ATTACHMENT_FILE_ID
    attachment_source.parent.mkdir()
    attachment_source.write_bytes(b"%PDF fake")
    project_dir = tmp_path / "project"
    copied_sms_db = project_dir / "data" / "imports" / "iphone" / "sms_import_20260101T120000Z.db"
    copied_sms_db.parent.mkdir(parents=True)
    create_fake_sms_import_db(
        copied_sms_db,
        attachment_filename="~/Library/SMS/Attachments/fake/file.pdf",
        transfer_name="file.pdf",
        mime_type="application/pdf",
        byte_size=9,
    )
    archive_conn = create_archive_connection()
    import_copied_sms_db_messages(
        str(copied_sms_db),
        project_dir,
        archive_conn,
        backup_folder_path=str(backup_folder),
    )
    conversation_id = archive_conn.execute("SELECT id FROM conversations").fetchone()["id"]
    monkeypatch.setattr(app_main, "get_connection", lambda: archive_conn)

    response = app_main.list_conversation_messages(conversation_id)

    attachment = next(message for message in response["messages"] if message["attachments"])["attachments"][0]
    assert attachment == {
        "mime_type": "application/pdf",
        "available": True,
        "availability_status": "available",
    }
    assert_no_private_attachment_api_fields(attachment)


def test_conversation_api_omits_render_url_for_missing_image_attachment(tmp_path, monkeypatch):
    backup_folder = tmp_path / "fake-backup"
    backup_folder.mkdir()
    create_fake_manifest(
        backup_folder / "Manifest.db",
        include_sms=True,
        extra_files=[
            (
                FAKE_ATTACHMENT_FILE_ID,
                "HomeDomain",
                "Library/SMS/Attachments/fake/missing.jpg",
            ),
        ],
    )
    project_dir = tmp_path / "project"
    copied_sms_db = project_dir / "data" / "imports" / "iphone" / "sms_import_20260101T120000Z.db"
    copied_sms_db.parent.mkdir(parents=True)
    create_fake_sms_import_db(
        copied_sms_db,
        attachment_filename="~/Library/SMS/Attachments/fake/missing.jpg",
        transfer_name="missing.jpg",
        mime_type="image/jpeg",
    )
    archive_conn = create_archive_connection()
    import_copied_sms_db_messages(
        str(copied_sms_db),
        project_dir,
        archive_conn,
        backup_folder_path=str(backup_folder),
    )
    conversation_id = archive_conn.execute("SELECT id FROM conversations").fetchone()["id"]
    monkeypatch.setattr(app_main, "get_connection", lambda: archive_conn)

    response = app_main.list_conversation_messages(conversation_id)

    attachment = next(message for message in response["messages"] if message["attachments"])["attachments"][0]
    assert attachment == {
        "mime_type": "image/jpeg",
        "available": False,
        "availability_status": "missing",
    }
    assert_no_private_attachment_api_fields(attachment)


def test_conversation_api_omits_render_url_for_metadata_only_image_attachment(tmp_path, monkeypatch):
    project_dir = tmp_path / "project"
    copied_sms_db = project_dir / "data" / "imports" / "iphone" / "sms_import_20260101T120000Z.db"
    copied_sms_db.parent.mkdir(parents=True)
    create_fake_sms_import_db(
        copied_sms_db,
        attachment_filename="~/Library/SMS/Attachments/fake/photo.jpg",
        transfer_name="photo.jpg",
        mime_type="image/jpeg",
        byte_size=8,
    )
    archive_conn = create_archive_connection()
    import_copied_sms_db_messages(str(copied_sms_db), project_dir, archive_conn)
    conversation_id = archive_conn.execute("SELECT id FROM conversations").fetchone()["id"]
    monkeypatch.setattr(app_main, "get_connection", lambda: archive_conn)

    response = app_main.list_conversation_messages(conversation_id)

    attachment = next(message for message in response["messages"] if message["attachments"])["attachments"][0]
    assert attachment == {
        "mime_type": "image/jpeg",
        "available": False,
        "availability_status": "metadata_only",
    }
    assert_no_private_attachment_api_fields(attachment)


def test_conversation_messages_support_paginated_loading(monkeypatch):
    archive_conn = create_archive_connection()
    contact_id = archive_conn.execute(
        """
        INSERT INTO contacts (handle, display_name, handle_type)
        VALUES ('+15550001111', 'Ada Lovelace', 'iphone')
        RETURNING id
        """
    ).fetchone()["id"]
    conversation_id = archive_conn.execute(
        """
        INSERT INTO conversations (source_thread_id, title)
        VALUES ('iphone-chat:1', 'Long chat')
        RETURNING id
        """
    ).fetchone()["id"]
    archive_conn.execute(
        "INSERT INTO conversation_participants (conversation_id, contact_id) VALUES (?, ?)",
        (conversation_id, contact_id),
    )
    for index, sent_at in enumerate([
        "2026-01-01T09:00:00+00:00",
        "2026-01-02T09:00:00+00:00",
        "2026-01-03T09:00:00+00:00",
    ], start=1):
        archive_conn.execute(
            """
            INSERT INTO messages (
              conversation_id,
              sender_contact_id,
              source_message_id,
              sent_at,
              direction,
              body,
              service
            )
            VALUES (?, ?, ?, ?, 'incoming', ?, 'iMessage')
            """,
            (conversation_id, contact_id, f"fake-{index}", sent_at, f"Message {index}"),
        )
    archive_conn.commit()
    monkeypatch.setattr(app_main, "get_connection", lambda: archive_conn)

    first_page = app_main.list_conversation_messages(conversation_id, limit=2, offset=0)
    second_page = app_main.list_conversation_messages(conversation_id, limit=2, offset=2)

    assert [message["body"] for message in first_page["messages"]] == ["Message 3", "Message 2"]
    assert first_page["total_message_count"] == 3
    assert first_page["has_more_messages"] is True
    assert first_page["next_offset"] == 2
    assert [message["body"] for message in second_page["messages"]] == ["Message 1"]
    assert second_page["has_more_messages"] is False
    assert second_page["conversation"]["first_message_at"] == "2026-01-01T09:00:00+00:00"
    assert second_page["conversation"]["last_message_at"] == "2026-01-03T09:00:00+00:00"


def test_one_click_import_copies_validates_and_imports_detected_backup(tmp_path, monkeypatch):
    backup_folder = tmp_path / "fake-backup"
    backup_folder.mkdir()
    create_fake_manifest(backup_folder / "Manifest.db", include_sms=True)
    source_path = backup_folder / FAKE_FILE_ID[:2] / FAKE_FILE_ID
    source_path.parent.mkdir()
    create_fake_sms_import_db(source_path)

    app_data_dir = tmp_path / "app-data"
    monkeypatch.setenv("MESSAGE_ARCHIVE_DATA_DIR", str(app_data_dir))
    monkeypatch.setenv("MESSAGE_ARCHIVE_DB_PATH", str(app_data_dir / "archive.sqlite3"))
    app_main.initialize_database()

    result = app_main.import_iphone_backup_from_path(str(backup_folder))

    assert result["imported"] is True
    assert result["valid"] is True
    assert result["inspected"] is True
    assert result["messages_imported"] == 2
    assert result["contacts_imported"] == 3
    assert result["copied_sms_db_path"].startswith("sms_import_")
    assert (app_data_dir / "imports" / "iphone" / result["copied_sms_db_path"]).is_file()
    assert_no_private_import_api_fields(result)

    with app_main.get_connection() as conn:
        assert conn.execute("SELECT COUNT(*) FROM messages").fetchone()[0] == 2
        assert conn.execute("SELECT COUNT(*) FROM contacts").fetchone()[0] == 3


def test_import_uses_address_book_names_when_available(tmp_path):
    backup_folder = tmp_path / "fake-backup"
    backup_folder.mkdir()
    create_fake_manifest(
        backup_folder / "Manifest.db",
        include_sms=True,
        extra_files=[
            (
                FAKE_ADDRESS_BOOK_FILE_ID,
                "HomeDomain",
                "Library/AddressBook/AddressBook.sqlitedb",
            ),
        ],
    )
    address_book_path = backup_folder / FAKE_ADDRESS_BOOK_FILE_ID[:2] / FAKE_ADDRESS_BOOK_FILE_ID
    address_book_path.parent.mkdir()
    create_fake_address_book_db(address_book_path)

    project_dir = tmp_path / "project"
    copied_sms_db = project_dir / "data" / "imports" / "iphone" / "sms_import_20260101T120000Z.db"
    copied_sms_db.parent.mkdir(parents=True)
    create_fake_sms_import_db(copied_sms_db)
    archive_conn = create_archive_connection()

    result = import_copied_sms_db_messages(
        str(copied_sms_db),
        project_dir,
        archive_conn,
        backup_folder_path=str(backup_folder),
    )

    assert result["contacts_named"] == 2
    contacts = archive_conn.execute(
        "SELECT handle, display_name FROM contacts ORDER BY handle"
    ).fetchall()
    assert [dict(row) for row in contacts] == [
        {"handle": "+15550001111", "display_name": "Ada Lovelace"},
        {"handle": "+15550002222", "display_name": "Grace Hopper"},
        {"handle": "iphone:self", "display_name": "Me"},
    ]


def test_iphone_message_import_is_idempotent_for_existing_source_ids(tmp_path):
    project_dir = tmp_path / "project"
    copied_sms_db = project_dir / "data" / "imports" / "iphone" / "sms_import_20260101T120000Z.db"
    copied_sms_db.parent.mkdir(parents=True)
    create_fake_sms_import_db(copied_sms_db)
    archive_conn = create_archive_connection()

    first_result = import_copied_sms_db_messages(str(copied_sms_db), project_dir, archive_conn)
    second_result = import_copied_sms_db_messages(str(copied_sms_db), project_dir, archive_conn)

    assert first_result["messages_imported"] == 2
    assert second_result["messages_imported"] == 0
    assert second_result["attachments_imported"] == 0
    assert second_result["attachment_files_copied"] == 0
    assert second_result["message_attachment_links_imported"] == 0
    assert second_result["contacts_imported"] == 0
    assert second_result["conversations_imported"] == 0
    assert archive_conn.execute("SELECT COUNT(*) FROM messages").fetchone()[0] == 2
    assert archive_conn.execute("SELECT COUNT(*) FROM attachments").fetchone()[0] == 1
    assert archive_conn.execute("SELECT COUNT(*) FROM message_attachments").fetchone()[0] == 1


def test_import_uses_chat_handle_join_for_conversation_participants(tmp_path):
    project_dir = tmp_path / "project"
    copied_sms_db = project_dir / "data" / "imports" / "iphone" / "sms_import_20260101T120000Z.db"
    copied_sms_db.parent.mkdir(parents=True)
    create_fake_sms_import_db(copied_sms_db)
    add_fake_chat_handle_join(copied_sms_db)
    archive_conn = create_archive_connection()

    result = import_copied_sms_db_messages(str(copied_sms_db), project_dir, archive_conn)

    assert result["conversation_participants_imported"] == 3
    participants = archive_conn.execute(
        """
        SELECT contacts.display_name
        FROM conversation_participants
        JOIN contacts ON contacts.id = conversation_participants.contact_id
        ORDER BY contacts.handle
        """
    ).fetchall()
    assert [row["display_name"] for row in participants] == [
        "(555) 000-1111",
        "(555) 000-2222",
        "Me",
    ]


def test_import_copies_linked_attachment_files_from_backup_manifest(tmp_path):
    backup_folder = tmp_path / "fake-backup"
    backup_folder.mkdir()
    create_fake_manifest(
        backup_folder / "Manifest.db",
        include_sms=True,
        extra_files=[
            (
                FAKE_ATTACHMENT_FILE_ID,
                "HomeDomain",
                "Library/SMS/Attachments/fake/photo.jpg",
            ),
        ],
    )
    attachment_source = backup_folder / FAKE_ATTACHMENT_FILE_ID[:2] / FAKE_ATTACHMENT_FILE_ID
    attachment_source.parent.mkdir()
    attachment_source.write_bytes(b"fake jpg")

    project_dir = tmp_path / "project"
    copied_sms_db = project_dir / "data" / "imports" / "iphone" / "sms_import_20260101T120000Z.db"
    copied_sms_db.parent.mkdir(parents=True)
    create_fake_sms_import_db(
        copied_sms_db,
        attachment_filename="~/Library/SMS/Attachments/fake/photo.jpg",
        transfer_name="photo.jpg",
        mime_type="image/jpeg",
        byte_size=8,
    )
    archive_conn = create_archive_connection()

    result = import_copied_sms_db_messages(
        str(copied_sms_db),
        project_dir,
        archive_conn,
        backup_folder_path=str(backup_folder),
    )

    assert result["attachments_imported"] == 1
    assert result["attachment_files_copied"] == 1
    attachment = archive_conn.execute(
        """
        SELECT
          source_ref,
          source_relative_path,
          original_filename,
          mime_type,
          local_path,
          byte_size,
          availability_status,
          imported_at
        FROM attachments
        """
    ).fetchone()
    local_path = project_dir / "data" / attachment["local_path"]
    attachment_data = dict(attachment)
    imported_at = attachment_data.pop("imported_at")
    assert imported_at
    assert attachment_data == {
        "source_ref": "iphone-attachment:1:~/Library/SMS/Attachments/fake/photo.jpg",
        "source_relative_path": "Library/SMS/Attachments/fake/photo.jpg",
        "original_filename": "photo.jpg",
        "mime_type": "image/jpeg",
        "local_path": "attachments/iphone/sms_import_20260101T120000Z/1-photo.jpg",
        "byte_size": 8,
        "availability_status": "available",
    }
    assert local_path.read_bytes() == b"fake jpg"

    second_result = import_copied_sms_db_messages(
        str(copied_sms_db),
        project_dir,
        archive_conn,
        backup_folder_path=str(backup_folder),
    )

    assert second_result["attachments_imported"] == 0
    assert second_result["attachment_files_copied"] == 0


def test_reimport_without_backup_keeps_available_copied_attachment(tmp_path):
    backup_folder = tmp_path / "fake-backup"
    backup_folder.mkdir()
    create_fake_manifest(
        backup_folder / "Manifest.db",
        include_sms=True,
        extra_files=[
            (
                FAKE_ATTACHMENT_FILE_ID,
                "HomeDomain",
                "Library/SMS/Attachments/fake/photo.jpg",
            ),
        ],
    )
    attachment_source = backup_folder / FAKE_ATTACHMENT_FILE_ID[:2] / FAKE_ATTACHMENT_FILE_ID
    attachment_source.parent.mkdir()
    attachment_source.write_bytes(b"fake jpg")

    project_dir = tmp_path / "project"
    copied_sms_db = project_dir / "data" / "imports" / "iphone" / "sms_import_20260101T120000Z.db"
    copied_sms_db.parent.mkdir(parents=True)
    create_fake_sms_import_db(
        copied_sms_db,
        attachment_filename="~/Library/SMS/Attachments/fake/photo.jpg",
        transfer_name="photo.jpg",
        mime_type="image/jpeg",
        byte_size=8,
    )
    archive_conn = create_archive_connection()

    import_copied_sms_db_messages(
        str(copied_sms_db),
        project_dir,
        archive_conn,
        backup_folder_path=str(backup_folder),
    )
    import_copied_sms_db_messages(str(copied_sms_db), project_dir, archive_conn)

    attachment = archive_conn.execute(
        "SELECT local_path, availability_status FROM attachments"
    ).fetchone()
    assert attachment["local_path"] == "attachments/iphone/sms_import_20260101T120000Z/1-photo.jpg"
    assert attachment["availability_status"] == "available"


def test_attachment_copy_stores_data_dir_relative_path_for_configured_data_dir(tmp_path):
    backup_folder = tmp_path / "fake-backup"
    backup_folder.mkdir()
    create_fake_manifest(
        backup_folder / "Manifest.db",
        include_sms=True,
        extra_files=[
            (
                FAKE_ATTACHMENT_FILE_ID,
                "HomeDomain",
                "Library/SMS/Attachments/fake/photo.jpg",
            ),
        ],
    )
    attachment_source = backup_folder / FAKE_ATTACHMENT_FILE_ID[:2] / FAKE_ATTACHMENT_FILE_ID
    attachment_source.parent.mkdir()
    attachment_source.write_bytes(b"fake jpg")

    project_dir = tmp_path / "project"
    data_dir = tmp_path / "app-support"
    copied_sms_db = data_dir / "imports" / "iphone" / "sms_import_20260101T120000Z.db"
    copied_sms_db.parent.mkdir(parents=True)
    create_fake_sms_import_db(
        copied_sms_db,
        attachment_filename="~/Library/SMS/Attachments/fake/photo.jpg",
        transfer_name="photo.jpg",
        mime_type="image/jpeg",
        byte_size=8,
    )
    archive_conn = create_archive_connection()

    result = import_copied_sms_db_messages(
        str(copied_sms_db),
        project_dir,
        archive_conn,
        backup_folder_path=str(backup_folder),
        data_dir=data_dir,
    )

    attachment = archive_conn.execute(
        "SELECT local_path, availability_status FROM attachments"
    ).fetchone()
    assert result["attachment_files_copied"] == 1
    assert attachment["local_path"] == "attachments/iphone/sms_import_20260101T120000Z/1-photo.jpg"
    assert attachment["availability_status"] == "available"
    assert not Path(attachment["local_path"]).is_absolute()
    assert (data_dir / attachment["local_path"]).read_bytes() == b"fake jpg"


def test_import_copies_three_linked_sample_image_attachments(tmp_path):
    backup_folder = tmp_path / "fake-backup"
    backup_folder.mkdir()
    image_files = [
        (
            "1111111111111111111111111111111111111111",
            "Library/SMS/Attachments/fake/photo-1.jpg",
            "photo-1.jpg",
            "image/jpeg",
            b"\xff\xd8fake sample image one\xff\xd9",
        ),
        (
            "2222222222222222222222222222222222222222",
            "Library/SMS/Attachments/fake/photo-2.png",
            "photo-2.png",
            "image/png",
            b"\x89PNG\r\n\x1a\nfake sample image two",
        ),
        (
            "3333333333333333333333333333333333333333",
            "Library/SMS/Attachments/fake/photo-3.heic",
            "photo-3.heic",
            "image/heic",
            b"fake sample image three",
        ),
    ]
    create_fake_manifest(
        backup_folder / "Manifest.db",
        include_sms=True,
        extra_files=[
            (file_id, "MediaDomain", relative_path)
            for file_id, relative_path, _name, _mime_type, _bytes in image_files
        ],
    )
    for file_id, _relative_path, _name, _mime_type, contents in image_files:
        source_path = backup_folder / file_id[:2] / file_id
        source_path.parent.mkdir()
        source_path.write_bytes(contents)

    project_dir = tmp_path / "project"
    copied_sms_db = project_dir / "data" / "imports" / "iphone" / "sms_import_20260101T120000Z.db"
    copied_sms_db.parent.mkdir(parents=True)
    first_image = image_files[0]
    create_fake_sms_import_db(
        copied_sms_db,
        attachment_filename=f"~/{first_image[1]}",
        transfer_name=first_image[2],
        mime_type=first_image[3],
        byte_size=len(first_image[4]),
    )
    for rowid, image_file in enumerate(image_files[1:], start=2):
        _file_id, relative_path, transfer_name, mime_type, contents = image_file
        add_fake_linked_attachment(
            copied_sms_db,
            rowid=rowid,
            message_id=1,
            filename=f"~/{relative_path}",
            transfer_name=transfer_name,
            mime_type=mime_type,
            byte_size=len(contents),
        )
    archive_conn = create_archive_connection()

    result = import_copied_sms_db_messages(
        str(copied_sms_db),
        project_dir,
        archive_conn,
        backup_folder_path=str(backup_folder),
    )

    attachments = archive_conn.execute(
        """
        SELECT original_filename, mime_type, local_path, availability_status
        FROM attachments
        ORDER BY original_filename
        """
    ).fetchall()
    links = archive_conn.execute("SELECT COUNT(*) FROM message_attachments").fetchone()[0]
    assert result["attachments_imported"] == 3
    assert result["attachment_files_copied"] == 3
    assert result["message_attachment_links_imported"] == 3
    assert links == 3
    assert [dict(row) for row in attachments] == [
        {
            "original_filename": "photo-1.jpg",
            "mime_type": "image/jpeg",
            "local_path": "attachments/iphone/sms_import_20260101T120000Z/1-photo-1.jpg",
            "availability_status": "available",
        },
        {
            "original_filename": "photo-2.png",
            "mime_type": "image/png",
            "local_path": "attachments/iphone/sms_import_20260101T120000Z/2-photo-2.png",
            "availability_status": "available",
        },
        {
            "original_filename": "photo-3.heic",
            "mime_type": "image/heic",
            "local_path": "attachments/iphone/sms_import_20260101T120000Z/3-photo-3.heic",
            "availability_status": "available",
        },
    ]
    for row, image_file in zip(attachments, image_files, strict=True):
        assert (project_dir / "data" / row["local_path"]).read_bytes() == image_file[4]


def test_import_normalizes_image_uti_for_inline_preview_metadata(tmp_path, monkeypatch):
    backup_folder = tmp_path / "fake-backup"
    backup_folder.mkdir()
    create_fake_manifest(
        backup_folder / "Manifest.db",
        include_sms=True,
        extra_files=[
            (
                FAKE_ATTACHMENT_FILE_ID,
                "MediaDomain",
                "Library/SMS/Attachments/fake/photo.jpg",
            ),
        ],
    )
    attachment_source = backup_folder / FAKE_ATTACHMENT_FILE_ID[:2] / FAKE_ATTACHMENT_FILE_ID
    attachment_source.parent.mkdir()
    attachment_source.write_bytes(b"fake jpg")

    project_dir = tmp_path / "project"
    copied_sms_db = project_dir / "data" / "imports" / "iphone" / "sms_import_20260101T120000Z.db"
    copied_sms_db.parent.mkdir(parents=True)
    create_fake_sms_import_db(
        copied_sms_db,
        attachment_filename="~/Library/SMS/Attachments/fake/photo.jpg",
        transfer_name="photo.jpg",
        mime_type="public.jpeg",
        byte_size=8,
    )
    archive_conn = create_archive_connection()
    import_copied_sms_db_messages(
        str(copied_sms_db),
        project_dir,
        archive_conn,
        backup_folder_path=str(backup_folder),
    )
    conversation_id = archive_conn.execute("SELECT id FROM conversations").fetchone()["id"]
    attachment_id = archive_conn.execute("SELECT id FROM attachments").fetchone()["id"]
    monkeypatch.setattr(app_main, "get_connection", lambda: archive_conn)

    response = app_main.list_conversation_messages(conversation_id)

    attachment = next(message for message in response["messages"] if message["attachments"])["attachments"][0]
    assert attachment == {
        "mime_type": "image/jpeg",
        "available": True,
        "availability_status": "available",
        "render_url": f"/attachments/{attachment_id}",
    }


def test_attachment_file_response_uses_private_headers_and_generic_filename(tmp_path, monkeypatch):
    data_dir = tmp_path / "app-data"
    attachment_path = data_dir / "attachments" / "iphone" / "fake-import" / "private-photo.jpg"
    attachment_path.parent.mkdir(parents=True)
    attachment_path.write_bytes(b"fake image bytes")
    monkeypatch.setenv("MESSAGE_ARCHIVE_DATA_DIR", str(data_dir))
    archive_conn = create_archive_connection()
    archive_conn.execute(
        """
        INSERT INTO attachments (
          source_ref,
          source_relative_path,
          original_filename,
          mime_type,
          local_path,
          byte_size,
          availability_status
        )
        VALUES (
          'iphone-attachment:1:private-photo.jpg',
          'Library/SMS/Attachments/fake/private-photo.jpg',
          'private-photo.jpg',
          'image/jpeg',
          'attachments/iphone/fake-import/private-photo.jpg',
          16,
          'available'
        )
        """
    )
    attachment_id = archive_conn.execute("SELECT id FROM attachments").fetchone()["id"]
    monkeypatch.setattr(app_main, "get_connection", lambda: archive_conn)

    response = app_main.get_attachment_file(attachment_id)

    assert response.headers["cache-control"] == "no-store"
    assert response.headers["pragma"] == "no-cache"
    assert response.headers["x-content-type-options"] == "nosniff"
    assert response.headers["content-disposition"] == 'inline; filename="attachment"'
    assert "private-photo" not in response.headers["content-disposition"]


def test_attachment_file_response_forces_non_images_to_download(tmp_path, monkeypatch):
    data_dir = tmp_path / "app-data"
    attachment_path = data_dir / "attachments" / "iphone" / "fake-import" / "private-file.pdf"
    attachment_path.parent.mkdir(parents=True)
    attachment_path.write_bytes(b"%PDF fake")
    monkeypatch.setenv("MESSAGE_ARCHIVE_DATA_DIR", str(data_dir))
    archive_conn = create_archive_connection()
    archive_conn.execute(
        """
        INSERT INTO attachments (
          source_ref,
          source_relative_path,
          original_filename,
          mime_type,
          local_path,
          byte_size,
          availability_status
        )
        VALUES (
          'iphone-attachment:1:private-file.pdf',
          'Library/SMS/Attachments/fake/private-file.pdf',
          'private-file.pdf',
          'application/pdf',
          'attachments/iphone/fake-import/private-file.pdf',
          9,
          'available'
        )
        """
    )
    attachment_id = archive_conn.execute("SELECT id FROM attachments").fetchone()["id"]
    monkeypatch.setattr(app_main, "get_connection", lambda: archive_conn)

    response = app_main.get_attachment_file(attachment_id)

    assert response.media_type == "application/octet-stream"
    assert response.headers["content-disposition"] == 'attachment; filename="attachment"'
    assert "private-file" not in response.headers["content-disposition"]


def test_attachment_copy_rejects_manifest_file_id_outside_backup(tmp_path):
    backup_folder = tmp_path / "fake-backup"
    backup_folder.mkdir()
    create_fake_manifest(
        backup_folder / "Manifest.db",
        include_sms=True,
        extra_files=[
            (
                "../outside-attachment",
                "HomeDomain",
                "Library/SMS/Attachments/fake/photo.jpg",
            ),
        ],
    )
    project_dir = tmp_path / "project"
    copied_sms_db = project_dir / "data" / "imports" / "iphone" / "sms_import_20260101T120000Z.db"
    copied_sms_db.parent.mkdir(parents=True)
    create_fake_sms_import_db(
        copied_sms_db,
        attachment_filename="~/Library/SMS/Attachments/fake/photo.jpg",
        transfer_name="photo.jpg",
        mime_type="image/jpeg",
    )
    archive_conn = create_archive_connection()

    with pytest.raises(UnsafeBackupPathError):
        import_copied_sms_db_messages(
            str(copied_sms_db),
            project_dir,
            archive_conn,
            backup_folder_path=str(backup_folder),
        )


def test_missing_attachment_source_keeps_metadata_only(tmp_path):
    backup_folder = tmp_path / "fake-backup"
    backup_folder.mkdir()
    create_fake_manifest(
        backup_folder / "Manifest.db",
        include_sms=True,
        extra_files=[
            (
                FAKE_ATTACHMENT_FILE_ID,
                "HomeDomain",
                "Library/SMS/Attachments/fake/missing.jpg",
            ),
        ],
    )
    project_dir = tmp_path / "project"
    copied_sms_db = project_dir / "data" / "imports" / "iphone" / "sms_import_20260101T120000Z.db"
    copied_sms_db.parent.mkdir(parents=True)
    create_fake_sms_import_db(
        copied_sms_db,
        attachment_filename="~/Library/SMS/Attachments/fake/missing.jpg",
        transfer_name="missing.jpg",
        mime_type="image/jpeg",
    )
    archive_conn = create_archive_connection()

    result = import_copied_sms_db_messages(
        str(copied_sms_db),
        project_dir,
        archive_conn,
        backup_folder_path=str(backup_folder),
    )

    attachment = archive_conn.execute(
        """
        SELECT source_relative_path, local_path, availability_status
        FROM attachments
        """
    ).fetchone()
    assert result["attachments_imported"] == 1
    assert result["attachment_files_copied"] == 0
    assert attachment["local_path"] is None
    assert attachment["source_relative_path"] == "Library/SMS/Attachments/fake/missing.jpg"
    assert attachment["availability_status"] == "missing"


def test_attachment_reference_without_manifest_file_row_is_marked_missing(tmp_path):
    backup_folder = tmp_path / "fake-backup"
    backup_folder.mkdir()
    create_fake_manifest(backup_folder / "Manifest.db", include_sms=True)
    project_dir = tmp_path / "project"
    copied_sms_db = project_dir / "data" / "imports" / "iphone" / "sms_import_20260101T120000Z.db"
    copied_sms_db.parent.mkdir(parents=True)
    create_fake_sms_import_db(
        copied_sms_db,
        attachment_filename="~/Library/SMS/Attachments/fake/photo.jpg",
        transfer_name="photo.jpg",
        mime_type="image/jpeg",
        byte_size=1234,
    )
    archive_conn = create_archive_connection()

    result = import_copied_sms_db_messages(
        str(copied_sms_db),
        project_dir,
        archive_conn,
        backup_folder_path=str(backup_folder),
    )

    attachment = archive_conn.execute(
        """
        SELECT source_relative_path, original_filename, mime_type, local_path, byte_size, availability_status
        FROM attachments
        """
    ).fetchone()
    link_count = archive_conn.execute("SELECT COUNT(*) FROM message_attachments").fetchone()[0]
    assert result["messages_imported"] == 2
    assert result["attachments_imported"] == 1
    assert result["message_attachment_links_imported"] == 1
    assert result["attachment_files_copied"] == 0
    assert link_count == 1
    assert dict(attachment) == {
        "source_relative_path": "Library/SMS/Attachments/fake/photo.jpg",
        "original_filename": "photo.jpg",
        "mime_type": "image/jpeg",
        "local_path": None,
        "byte_size": 1234,
        "availability_status": "missing",
    }


def test_unreadable_manifest_does_not_block_message_import(tmp_path):
    backup_folder = tmp_path / "fake-backup"
    backup_folder.mkdir()
    (backup_folder / "Manifest.db").write_bytes(b"not a sqlite database")
    project_dir = tmp_path / "project"
    copied_sms_db = project_dir / "data" / "imports" / "iphone" / "sms_import_20260101T120000Z.db"
    copied_sms_db.parent.mkdir(parents=True)
    create_fake_sms_import_db(
        copied_sms_db,
        attachment_filename="~/Library/SMS/Attachments/fake/photo.jpg",
        transfer_name="photo.jpg",
        mime_type="image/jpeg",
    )
    archive_conn = create_archive_connection()

    result = import_copied_sms_db_messages(
        str(copied_sms_db),
        project_dir,
        archive_conn,
        backup_folder_path=str(backup_folder),
    )

    attachment = archive_conn.execute("SELECT local_path FROM attachments").fetchone()
    assert result["messages_imported"] == 2
    assert result["attachments_imported"] == 1
    assert result["attachment_files_copied"] == 0
    assert attachment["local_path"] is None


def test_unlinked_attachment_files_are_not_copied(tmp_path):
    backup_folder = tmp_path / "fake-backup"
    backup_folder.mkdir()
    second_attachment_file_id = "ffeeddccbbaa0011223344556677889900ffeedd"
    create_fake_manifest(
        backup_folder / "Manifest.db",
        include_sms=True,
        extra_files=[
            (
                FAKE_ATTACHMENT_FILE_ID,
                "HomeDomain",
                "Library/SMS/Attachments/fake/linked.jpg",
            ),
            (
                second_attachment_file_id,
                "HomeDomain",
                "Library/SMS/Attachments/fake/unlinked.jpg",
            ),
        ],
    )
    linked_source = backup_folder / FAKE_ATTACHMENT_FILE_ID[:2] / FAKE_ATTACHMENT_FILE_ID
    linked_source.parent.mkdir()
    linked_source.write_bytes(b"linked jpg")
    unlinked_source = backup_folder / second_attachment_file_id[:2] / second_attachment_file_id
    unlinked_source.parent.mkdir()
    unlinked_source.write_bytes(b"unlinked jpg")

    project_dir = tmp_path / "project"
    copied_sms_db = project_dir / "data" / "imports" / "iphone" / "sms_import_20260101T120000Z.db"
    copied_sms_db.parent.mkdir(parents=True)
    create_fake_sms_import_db(
        copied_sms_db,
        attachment_filename="~/Library/SMS/Attachments/fake/linked.jpg",
        transfer_name="linked.jpg",
        mime_type="image/jpeg",
    )
    add_fake_unlinked_attachment(
        copied_sms_db,
        rowid=2,
        filename="~/Library/SMS/Attachments/fake/unlinked.jpg",
        transfer_name="unlinked.jpg",
        mime_type="image/jpeg",
    )
    archive_conn = create_archive_connection()

    result = import_copied_sms_db_messages(
        str(copied_sms_db),
        project_dir,
        archive_conn,
        backup_folder_path=str(backup_folder),
    )

    attachments = archive_conn.execute(
        "SELECT original_filename, local_path FROM attachments ORDER BY original_filename"
    ).fetchall()
    assert result["attachments_imported"] == 2
    assert result["attachment_files_copied"] == 1
    assert [dict(row) for row in attachments] == [
        {
            "original_filename": "linked.jpg",
            "local_path": "attachments/iphone/sms_import_20260101T120000Z/1-linked.jpg",
        },
        {
            "original_filename": "unlinked.jpg",
            "local_path": None,
        },
    ]
    assert not (project_dir / "data" / "attachments" / "iphone" / "sms_import_20260101T120000Z" / "2-unlinked.jpg").exists()


def test_attachment_destination_filename_is_sanitized(tmp_path):
    backup_folder = tmp_path / "fake-backup"
    backup_folder.mkdir()
    create_fake_manifest(
        backup_folder / "Manifest.db",
        include_sms=True,
        extra_files=[
            (
                FAKE_ATTACHMENT_FILE_ID,
                "HomeDomain",
                "Library/SMS/Attachments/fake/photo.jpg",
            ),
        ],
    )
    attachment_source = backup_folder / FAKE_ATTACHMENT_FILE_ID[:2] / FAKE_ATTACHMENT_FILE_ID
    attachment_source.parent.mkdir()
    attachment_source.write_bytes(b"fake jpg")
    project_dir = tmp_path / "project"
    copied_sms_db = project_dir / "data" / "imports" / "iphone" / "sms_import_20260101T120000Z.db"
    copied_sms_db.parent.mkdir(parents=True)
    create_fake_sms_import_db(
        copied_sms_db,
        attachment_filename="~/Library/SMS/Attachments/fake/photo.jpg",
        transfer_name="../../private photo?.jpg",
        mime_type="image/jpeg",
    )
    archive_conn = create_archive_connection()

    import_copied_sms_db_messages(
        str(copied_sms_db),
        project_dir,
        archive_conn,
        backup_folder_path=str(backup_folder),
    )

    attachment = archive_conn.execute("SELECT local_path FROM attachments").fetchone()
    local_path = attachment["local_path"]
    assert local_path == "attachments/iphone/sms_import_20260101T120000Z/1-private_photo_.jpg"
    assert (project_dir / "data" / local_path).read_bytes() == b"fake jpg"


def test_extracts_message_text_from_attributed_body_when_text_is_empty():
    body = extract_message_body_text(
        None,
        b"\x00\x01NSObject\x00Recovered attributed body text\x00\x02",
        None,
    )

    assert body == "Recovered attributed body text"


def test_extracts_plain_payload_text_when_text_is_empty():
    body = extract_message_body_text(None, None, b"Recovered payload text")

    assert body == "Recovered payload text"


def test_ignores_decoded_binary_attributed_body_noise_when_text_is_empty():
    fake_decoded_binary_noise = ("龘" * 90).encode("utf-16-be")

    body = extract_message_body_text(None, fake_decoded_binary_noise, None)

    assert body == ""


def test_ignores_long_symbol_like_attributed_body_noise_when_text_is_empty():
    fake_decoded_binary_noise = (
        "懵擎獵薔།鐡詩荒刀臺挨棉湯牡∨請樟鉚喔⊖護鐵祕泪呻懵獨敦"
        "賬繳拐琊蔣昪藥撿腸憾墩艘整慎斂鈿限汪蛹旡殮勞巴Xㄱㄴ"
    ).encode("utf-16-be")

    body = extract_message_body_text(None, fake_decoded_binary_noise, None)

    assert body == ""


def test_ignores_mixed_script_decoded_body_noise_when_text_is_empty():
    fake_decoded_binary_noise = (
        "敖複挠槙莈º噢葵樑⇧鈾莞⊙华棉瑔漢億侵鑚bl詩陽弦欺腐澀數"
        "煻瑩渝舫物挽棉湯瑁牴扩璐乏淖薇詩莈丈丘泅敢r莞万噓污敵鑚b莉b"
    ).encode("utf-16-be")

    body = extract_message_body_text(None, fake_decoded_binary_noise, None)

    assert body == ""


def test_preserves_coherent_non_latin_attributed_body_text_when_text_is_empty():
    real_message_text = (
        "今天我们一起去喝咖啡然后讨论周末计划我觉得这个地方很好"
        "我们下午三点见面可以吗谢谢你"
    )

    body = extract_message_body_text(None, real_message_text.encode("utf-16-be"), None)

    assert body == real_message_text


def test_ignores_binary_payload_data_when_text_is_empty():
    fake_decoded_binary_noise = ("龘" * 90).encode("utf-16-be")

    body = extract_message_body_text(None, None, fake_decoded_binary_noise)

    assert body == ""


def test_reimport_clears_existing_binary_noise_body():
    archive_conn = create_archive_connection()
    archive_conn.execute(
        """
        INSERT INTO conversations (source_thread_id, title)
        VALUES ('iphone-chat:1', 'Existing chat')
        """
    )
    archive_conn.execute(
        """
        INSERT INTO contacts (handle, display_name, handle_type)
        VALUES ('+15550001111', '+15550001111', 'iphone')
        """
    )
    conversation_id = archive_conn.execute("SELECT id FROM conversations").fetchone()["id"]
    contact_id = archive_conn.execute("SELECT id FROM contacts").fetchone()["id"]
    archive_conn.execute(
        """
        INSERT INTO messages (
          conversation_id,
          sender_contact_id,
          source_message_id,
          sent_at,
          direction,
          body,
          service
        )
        VALUES (?, ?, '1', '2001-01-01T00:00:00+00:00', 'incoming', ?, 'iMessage')
        """,
        (
            conversation_id,
            contact_id,
            "懵擎獵薔鐡詩荒刀臺挨棉湯牡請樟鉚喔護鐵祕泪呻懵獨敦賬繳拐琊蔣昪藥撿腸憾墩艘整慎斂鈿限汪蛹旡殮勞巴Xㄱㄴ",
        ),
    )
    archive_conn.commit()

    updated = insert_iphone_message(
        archive_conn,
        conversation_id=conversation_id,
        sender_contact_id=contact_id,
        message={
            "rowid": 1,
            "date": 0,
            "text": "",
            "is_from_me": 0,
            "service": "iMessage",
        },
    )

    body = archive_conn.execute(
        "SELECT body FROM messages WHERE source_message_id = '1'"
    ).fetchone()["body"]
    assert updated == 1
    assert body == ""


def test_reimport_updates_existing_blank_body_from_attributed_body(tmp_path):
    project_dir = tmp_path / "project"
    copied_sms_db = project_dir / "data" / "imports" / "iphone" / "sms_import_20260101T120000Z.db"
    copied_sms_db.parent.mkdir(parents=True)
    create_fake_sms_attributed_body_db(copied_sms_db)
    archive_conn = create_archive_connection()
    archive_conn.execute(
        """
        INSERT INTO conversations (source_thread_id, title)
        VALUES ('iphone-chat:1', 'Existing chat')
        """
    )
    archive_conn.execute(
        """
        INSERT INTO contacts (handle, display_name, handle_type)
        VALUES ('+15550001111', '+15550001111', 'iphone')
        """
    )
    conversation_id = archive_conn.execute("SELECT id FROM conversations").fetchone()["id"]
    contact_id = archive_conn.execute("SELECT id FROM contacts").fetchone()["id"]
    archive_conn.execute(
        """
        INSERT INTO messages (
          conversation_id,
          sender_contact_id,
          source_message_id,
          sent_at,
          direction,
          body,
          service
        )
        VALUES (?, ?, '1', '2001-01-01T00:00:00+00:00', 'incoming', '', 'iMessage')
        """,
        (conversation_id, contact_id),
    )
    archive_conn.commit()

    result = import_copied_sms_db_messages(str(copied_sms_db), project_dir, archive_conn)

    assert result["messages_imported"] == 1
    body = archive_conn.execute(
        "SELECT body FROM messages WHERE source_message_id = '1'"
    ).fetchone()["body"]
    assert body == "Recovered attributed body text"


def test_message_import_rejects_paths_outside_import_folder(tmp_path):
    project_dir = tmp_path / "project"
    outside_db = tmp_path / "outside.db"
    create_fake_sms_import_db(outside_db)
    archive_conn = create_archive_connection()

    with pytest.raises(UnsafeBackupPathError):
        import_copied_sms_db_messages(str(outside_db), project_dir, archive_conn)


def create_fake_manifest(path, include_sms, extra_files=None):
    conn = sqlite3.connect(path)
    try:
        conn.execute(
            """
            CREATE TABLE Files (
              fileID TEXT PRIMARY KEY,
              domain TEXT NOT NULL,
              relativePath TEXT NOT NULL
            )
            """
        )
        if include_sms:
            conn.execute(
                """
                INSERT INTO Files (fileID, domain, relativePath)
                VALUES (?, 'HomeDomain', 'Library/SMS/sms.db')
                """,
                (FAKE_FILE_ID,),
            )
        for file_id, domain, relative_path in extra_files or []:
            conn.execute(
                """
                INSERT INTO Files (fileID, domain, relativePath)
                VALUES (?, ?, ?)
                """,
                (file_id, domain, relative_path),
            )
        conn.commit()
    finally:
        conn.close()


def route_exists(path, method):
    return any(
        route.path == path and method in route.methods
        for route in app_main.app.routes
    )


def run_token_middleware(path, method, *, headers):
    class FakeUrl:
        def __init__(self, path):
            self.path = path

    class FakeRequest:
        def __init__(self, path, method, headers):
            self.url = FakeUrl(path)
            self.method = method
            self.headers = headers

    async def call_next(_request):
        return app_main.JSONResponse(status_code=200, content={"ok": True})

    return asyncio.run(
        app_main.require_local_api_token(
            FakeRequest(path, method, headers),
            call_next,
        )
    )


def create_fake_sms_metadata_db(path):
    conn = sqlite3.connect(path)
    try:
        conn.executescript(
            """
            CREATE TABLE message (
              id INTEGER PRIMARY KEY,
              date INTEGER,
              text TEXT,
              attributedBody BLOB,
              payload_data BLOB
            );
            CREATE TABLE handle (id INTEGER PRIMARY KEY);
            CREATE TABLE chat (id INTEGER PRIMARY KEY);
            CREATE TABLE chat_message_join (chat_id INTEGER, message_id INTEGER);
            CREATE TABLE attachment (
              id INTEGER PRIMARY KEY,
              filename TEXT,
              mime_type TEXT,
              payload_data BLOB
            );
            CREATE TABLE message_attachment_join (message_id INTEGER, attachment_id INTEGER);
            INSERT INTO message (id, date, text, attributedBody, payload_data)
            VALUES
              (1, 100, 'fake private text that must not be selected', x'00', x'01'),
              (2, 300, 'another fake private message', x'02', x'03'),
              (3, 200, NULL, NULL, NULL);
            INSERT INTO handle (id) VALUES (1), (2);
            INSERT INTO chat (id) VALUES (1);
            INSERT INTO chat_message_join (chat_id, message_id) VALUES (1, 1), (1, 2);
            INSERT INTO attachment (id, filename, mime_type, payload_data)
            VALUES
              (1, 'fake-photo.jpg', 'image/jpeg', x'04'),
              (2, 'fake-file.pdf', 'application/pdf', x'05');
            INSERT INTO message_attachment_join (message_id, attachment_id) VALUES (1, 1);
            """
        )
        conn.commit()
    finally:
        conn.close()


def create_fake_sms_import_db(
    path,
    *,
    attachment_filename="not-imported.jpg",
    transfer_name=None,
    mime_type=None,
    byte_size=None,
):
    conn = sqlite3.connect(path)
    try:
        conn.executescript(
            """
            CREATE TABLE handle (
              id TEXT,
              service TEXT
            );
            CREATE TABLE chat (
              chat_identifier TEXT,
              display_name TEXT,
              service_name TEXT
            );
            CREATE TABLE chat_message_join (
              chat_id INTEGER,
              message_id INTEGER
            );
            CREATE TABLE message (
              handle_id INTEGER,
              date INTEGER,
              text TEXT,
              is_from_me INTEGER,
              service TEXT,
              attributedBody BLOB,
              payload_data BLOB
            );
            CREATE TABLE attachment (
              id INTEGER PRIMARY KEY,
              filename TEXT,
              transfer_name TEXT,
              mime_type TEXT,
              total_bytes INTEGER,
              payload_data BLOB
            );
            CREATE TABLE message_attachment_join (
              message_id INTEGER,
              attachment_id INTEGER
            );
            INSERT INTO handle (ROWID, id, service)
            VALUES
              (1, '+15550001111', 'iMessage'),
              (2, '+15550002222', 'SMS');
            INSERT INTO chat (ROWID, chat_identifier, display_name, service_name)
            VALUES (1, 'chat.fake', 'Fake chat', 'iMessage');
            INSERT INTO message (ROWID, handle_id, date, text, is_from_me, service, attributedBody, payload_data)
            VALUES
              (1, 1, 0, 'hello from fake iphone', 0, 'iMessage', x'00', x'01'),
              (2, 2, 5000000000, 'fake reply from me', 1, 'SMS', x'02', x'03');
            INSERT INTO chat_message_join (chat_id, message_id)
            VALUES (1, 1), (1, 2);
            INSERT INTO message_attachment_join (message_id, attachment_id)
            VALUES (1, 1);
            """
        )
        conn.execute(
            """
            INSERT INTO attachment (id, filename, transfer_name, mime_type, total_bytes, payload_data)
            VALUES (1, ?, ?, ?, ?, x'04')
            """,
            (attachment_filename, transfer_name, mime_type, byte_size),
        )
        conn.commit()
    finally:
        conn.close()


def create_fake_address_book_db(path):
    conn = sqlite3.connect(path)
    try:
        conn.executescript(
            """
            CREATE TABLE ABPerson (
              First TEXT,
              Middle TEXT,
              Last TEXT,
              Organization TEXT
            );
            CREATE TABLE ABMultiValue (
              record_id INTEGER,
              property INTEGER,
              value TEXT
            );
            INSERT INTO ABPerson (ROWID, First, Middle, Last, Organization)
            VALUES
              (1, 'Ada', NULL, 'Lovelace', NULL),
              (2, 'Grace', NULL, 'Hopper', NULL);
            INSERT INTO ABMultiValue (record_id, property, value)
            VALUES
              (1, 3, '+1 (555) 000-1111'),
              (2, 3, '5550002222');
            """
        )
        conn.commit()
    finally:
        conn.close()


def add_fake_unlinked_attachment(
    path,
    *,
    rowid,
    filename,
    transfer_name,
    mime_type,
):
    conn = sqlite3.connect(path)
    try:
        conn.execute(
            """
            INSERT INTO attachment (id, filename, transfer_name, mime_type, total_bytes, payload_data)
            VALUES (?, ?, ?, ?, NULL, x'05')
            """,
            (rowid, filename, transfer_name, mime_type),
        )
        conn.commit()
    finally:
        conn.close()


def add_fake_linked_attachment(
    path,
    *,
    rowid,
    message_id,
    filename,
    transfer_name,
    mime_type,
    byte_size=None,
):
    conn = sqlite3.connect(path)
    try:
        conn.execute(
            """
            INSERT INTO attachment (id, filename, transfer_name, mime_type, total_bytes, payload_data)
            VALUES (?, ?, ?, ?, ?, x'05')
            """,
            (rowid, filename, transfer_name, mime_type, byte_size),
        )
        conn.execute(
            """
            INSERT INTO message_attachment_join (message_id, attachment_id)
            VALUES (?, ?)
            """,
            (message_id, rowid),
        )
        conn.commit()
    finally:
        conn.close()


def add_fake_chat_handle_join(path):
    conn = sqlite3.connect(path)
    try:
        conn.executescript(
            """
            CREATE TABLE chat_handle_join (
              chat_id INTEGER,
              handle_id INTEGER
            );
            INSERT INTO chat_handle_join (chat_id, handle_id)
            VALUES (1, 1), (1, 2);
            """
        )
        conn.commit()
    finally:
        conn.close()


def create_fake_sms_attributed_body_db(path):
    conn = sqlite3.connect(path)
    try:
        conn.executescript(
            """
            CREATE TABLE handle (
              id TEXT,
              service TEXT
            );
            CREATE TABLE chat (
              chat_identifier TEXT,
              display_name TEXT,
              service_name TEXT
            );
            CREATE TABLE chat_message_join (
              chat_id INTEGER,
              message_id INTEGER
            );
            CREATE TABLE message (
              handle_id INTEGER,
              date INTEGER,
              text TEXT,
              is_from_me INTEGER,
              service TEXT,
              attributedBody BLOB,
              payload_data BLOB
            );
            CREATE TABLE attachment (
              id INTEGER PRIMARY KEY,
              filename TEXT,
              payload_data BLOB
            );
            CREATE TABLE message_attachment_join (
              message_id INTEGER,
              attachment_id INTEGER
            );
            INSERT INTO handle (ROWID, id, service)
            VALUES (1, '+15550001111', 'iMessage');
            INSERT INTO chat (ROWID, chat_identifier, display_name, service_name)
            VALUES (1, 'chat.fake', 'Fake chat', 'iMessage');
            INSERT INTO message (ROWID, handle_id, date, text, is_from_me, service, attributedBody, payload_data)
            VALUES (
              1,
              1,
              0,
              NULL,
              0,
              'iMessage',
              x'00014E534F626A656374005265636F7665726564206174747269627574656420626F647920746578740002',
              NULL
            );
            INSERT INTO chat_message_join (chat_id, message_id)
            VALUES (1, 1);
            """
        )
        conn.commit()
    finally:
        conn.close()


def create_archive_connection():
    schema_path = Path(__file__).resolve().parents[1] / "server" / "db" / "schema.sql"
    conn = sqlite3.connect(":memory:")
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    conn.executescript(schema_path.read_text())
    return conn


def assert_no_private_attachment_api_fields(attachment):
    assert not {
        "id",
        "original_filename",
        "source_ref",
        "source_relative_path",
        "local_path",
        "backup_folder_path",
        "backup_id",
        "fileID",
        "file_id",
        "storage_path",
        "destination_path",
        "source_path",
        "byte_size",
    } & set(attachment)


def assert_no_private_import_api_fields(result):
    assert not {
        "backup_folder_path",
        "copied_sms_db_path_absolute",
        "domain",
        "expected_backup_file_path",
        "fileID",
        "relativePath",
        "source_path",
    } & set(result)
    for key in ("copied_sms_db_path", "destination_path"):
        if key in result and isinstance(result[key], str):
            assert not Path(result[key]).is_absolute()
    for value in result.values():
        if isinstance(value, str):
            assert "/Users/" not in value
            assert str(Path.home()) not in value


def create_fake_sms_db(path, tables):
    conn = sqlite3.connect(path)
    try:
        for table_name in tables:
            conn.execute(f'CREATE TABLE "{table_name}" (id INTEGER PRIMARY KEY)')
        conn.commit()
    finally:
        conn.close()
