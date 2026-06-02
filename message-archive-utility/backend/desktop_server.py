from __future__ import annotations

import argparse
import os
from pathlib import Path

import uvicorn

from server.main import app as fastapi_app


DEFAULT_HOST = "127.0.0.1"
DEFAULT_PORT = 8765
DESKTOP_DATA_DIR_NAME = "Message Archive Utility"


def main() -> None:
    args = parse_args()
    configure_desktop_environment()
    uvicorn.run(
        fastapi_app,
        host=args.host,
        port=args.port,
        access_log=False,
        log_level="info",
    )


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Start the local Message Archive backend.")
    parser.add_argument("--host", default=DEFAULT_HOST)
    parser.add_argument("--port", type=int, default=get_default_port())
    return parser.parse_args()


def get_default_port() -> int:
    raw_port = os.getenv("MESSAGE_ARCHIVE_DESKTOP_BACKEND_PORT", str(DEFAULT_PORT))
    try:
        return int(raw_port)
    except ValueError:
        return DEFAULT_PORT


def configure_desktop_environment() -> None:
    os.environ.setdefault("MESSAGE_ARCHIVE_DESKTOP_MODE", "1")
    data_dir = os.environ.setdefault("MESSAGE_ARCHIVE_DATA_DIR", str(get_default_desktop_data_dir()))
    os.environ.setdefault("MESSAGE_ARCHIVE_DB_PATH", str(Path(data_dir) / "message-archive.sqlite3"))


def get_default_desktop_data_dir() -> Path:
    if os.name == "posix" and Path.home().joinpath("Library", "Application Support").exists():
        return Path.home() / "Library" / "Application Support" / DESKTOP_DATA_DIR_NAME
    return Path.home() / ".message-archive-utility"


if __name__ == "__main__":
    main()
