from datetime import datetime, timezone
from pathlib import Path
import shutil
import sqlite3


SMS_DOMAIN = "HomeDomain"
SMS_RELATIVE_PATH = "Library/SMS/sms.db"


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
