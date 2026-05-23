from pathlib import Path

from fastapi import HTTPException
import pytest

from app import main


def test_resolve_private_attachment_path_accepts_private_relative_path(tmp_path, monkeypatch):
    project_dir = tmp_path / "project"
    private_file = project_dir / "data" / "attachments" / "iphone" / "import" / "photo.jpg"
    private_file.parent.mkdir(parents=True)
    private_file.write_bytes(b"fake image")
    monkeypatch.setattr(main, "PROJECT_DIR", project_dir)
    monkeypatch.delenv("MESSAGE_ARCHIVE_DATA_DIR", raising=False)

    resolved = main.resolve_private_attachment_path("data/attachments/iphone/import/photo.jpg")

    assert resolved == private_file.resolve()


def test_resolve_private_attachment_path_rejects_relative_escape(tmp_path, monkeypatch):
    project_dir = tmp_path / "project"
    outside_file = tmp_path / "outside.jpg"
    outside_file.write_bytes(b"not private")
    monkeypatch.setattr(main, "PROJECT_DIR", project_dir)
    monkeypatch.delenv("MESSAGE_ARCHIVE_DATA_DIR", raising=False)

    with pytest.raises(HTTPException) as error:
        main.resolve_private_attachment_path("../outside.jpg")

    assert error.value.status_code == 400


def test_resolve_private_attachment_path_rejects_absolute_outside_file(tmp_path, monkeypatch):
    project_dir = tmp_path / "project"
    outside_file = tmp_path / "outside.jpg"
    outside_file.write_bytes(b"not private")
    monkeypatch.setattr(main, "PROJECT_DIR", project_dir)
    monkeypatch.delenv("MESSAGE_ARCHIVE_DATA_DIR", raising=False)

    with pytest.raises(HTTPException) as error:
        main.resolve_private_attachment_path(str(outside_file))

    assert error.value.status_code == 400


def test_resolve_private_attachment_path_rejects_missing_private_file(tmp_path, monkeypatch):
    project_dir = tmp_path / "project"
    (project_dir / "data" / "attachments").mkdir(parents=True)
    monkeypatch.setattr(main, "PROJECT_DIR", project_dir)
    monkeypatch.delenv("MESSAGE_ARCHIVE_DATA_DIR", raising=False)

    with pytest.raises(HTTPException) as error:
        main.resolve_private_attachment_path("data/attachments/iphone/import/missing.jpg")

    assert error.value.status_code == 404


def test_resolve_private_attachment_path_uses_configured_data_dir(tmp_path, monkeypatch):
    project_dir = tmp_path / "project"
    data_dir = tmp_path / "app-support"
    private_file = data_dir / "attachments" / "iphone" / "import" / "photo.jpg"
    private_file.parent.mkdir(parents=True)
    private_file.write_bytes(b"fake image")
    monkeypatch.setattr(main, "PROJECT_DIR", project_dir)
    monkeypatch.setenv("MESSAGE_ARCHIVE_DATA_DIR", str(data_dir))

    resolved = main.resolve_private_attachment_path(str(private_file))

    assert resolved == private_file.resolve()


def test_get_db_path_uses_configured_data_dir_by_default(tmp_path, monkeypatch):
    project_dir = tmp_path / "project"
    data_dir = tmp_path / "app-support"
    monkeypatch.setattr(main, "PROJECT_DIR", project_dir)
    monkeypatch.setenv("MESSAGE_ARCHIVE_DATA_DIR", str(data_dir))
    monkeypatch.delenv("MESSAGE_ARCHIVE_DB_PATH", raising=False)

    assert main.get_db_path() == data_dir / "message_archive.sqlite3"
