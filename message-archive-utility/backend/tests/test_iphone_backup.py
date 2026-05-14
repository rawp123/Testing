import sqlite3

import pytest

from app.importers.iphone_backup import (
    EXPECTED_SMS_TABLES,
    SmsDbNotFoundError,
    UnsafeBackupPathError,
    copy_sms_db_from_backup,
    locate_sms_db_dry_run,
    validate_copied_sms_db,
)


FAKE_FILE_ID = "3d0d7e5fb2ce288813306e4d4636395e047a3d28"


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
        "expected_backup_file_path": None,
    }


def test_requires_manifest_inside_provided_folder(tmp_path):
    backup_folder = tmp_path / "fake-backup"
    backup_folder.mkdir()

    with pytest.raises(FileNotFoundError):
        locate_sms_db_dry_run(str(backup_folder))


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
    assert result["source_path"] == str(source_path)
    assert result["destination_path"] == str(destination)
    assert destination.read_bytes() == b"fake sms database bytes, no message content"


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


def create_fake_manifest(path, include_sms):
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
        conn.commit()
    finally:
        conn.close()


def create_fake_sms_db(path, tables):
    conn = sqlite3.connect(path)
    try:
        for table_name in tables:
            conn.execute(f'CREATE TABLE "{table_name}" (id INTEGER PRIMARY KEY)')
        conn.commit()
    finally:
        conn.close()
