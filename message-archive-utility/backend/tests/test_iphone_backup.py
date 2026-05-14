import sqlite3

import pytest

from app.importers.iphone_backup import locate_sms_db_dry_run


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
