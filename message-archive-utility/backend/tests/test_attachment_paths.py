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

    resolved = main.resolve_private_attachment_path("data/attachments/iphone/import/photo.jpg")

    assert resolved == private_file.resolve()


def test_resolve_private_attachment_path_rejects_relative_escape(tmp_path, monkeypatch):
    project_dir = tmp_path / "project"
    outside_file = tmp_path / "outside.jpg"
    outside_file.write_bytes(b"not private")
    monkeypatch.setattr(main, "PROJECT_DIR", project_dir)

    with pytest.raises(HTTPException) as error:
        main.resolve_private_attachment_path("../outside.jpg")

    assert error.value.status_code == 400


def test_resolve_private_attachment_path_rejects_absolute_outside_file(tmp_path, monkeypatch):
    project_dir = tmp_path / "project"
    outside_file = tmp_path / "outside.jpg"
    outside_file.write_bytes(b"not private")
    monkeypatch.setattr(main, "PROJECT_DIR", project_dir)

    with pytest.raises(HTTPException) as error:
        main.resolve_private_attachment_path(str(outside_file))

    assert error.value.status_code == 400


def test_resolve_private_attachment_path_rejects_missing_private_file(tmp_path, monkeypatch):
    project_dir = tmp_path / "project"
    (project_dir / "data" / "attachments").mkdir(parents=True)
    monkeypatch.setattr(main, "PROJECT_DIR", project_dir)

    with pytest.raises(HTTPException) as error:
        main.resolve_private_attachment_path("data/attachments/iphone/import/missing.jpg")

    assert error.value.status_code == 404

