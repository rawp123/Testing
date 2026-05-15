import sqlite3
from pathlib import Path

from app.main import build_archive_stats


def test_build_archive_stats_reports_message_quality():
    conn = create_archive_connection()
    contact_id = conn.execute(
        """
        INSERT INTO contacts (handle, display_name, handle_type)
        VALUES ('+15550001111', '+15550001111', 'iphone')
        RETURNING id
        """
    ).fetchone()["id"]
    conversation_id = conn.execute(
        """
        INSERT INTO conversations (source_thread_id, title)
        VALUES ('iphone-chat:1', 'Fake chat')
        RETURNING id
        """
    ).fetchone()["id"]
    conn.execute(
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
        VALUES
          (?, ?, '1', '2026-05-13T12:00:00+00:00', 'incoming', 'hello', 'iMessage'),
          (?, ?, '2', '2026-05-14T12:00:00+00:00', 'outgoing', '', 'iMessage')
        """,
        (conversation_id, contact_id, conversation_id, contact_id),
    )
    conn.commit()

    stats = build_archive_stats(conn)

    assert stats["messages"] == {
        "total": 2,
        "blank": 1,
        "blank_percent": 50.0,
        "earliest_sent_at": "2026-05-13T12:00:00+00:00",
        "latest_sent_at": "2026-05-14T12:00:00+00:00",
    }
    assert stats["conversations"] == {"total": 1}
    assert stats["contacts"] == {"total": 1}
    assert stats["attachments"] == {"total": 0, "linked_messages": 0}


def create_archive_connection():
    schema_path = Path(__file__).resolve().parents[1] / "app" / "db" / "schema.sql"
    conn = sqlite3.connect(":memory:")
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    conn.executescript(schema_path.read_text())
    return conn
