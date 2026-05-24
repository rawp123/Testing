import sqlite3
from pathlib import Path

from app.services.export_csv import export_messages_csv


def test_export_messages_csv_can_export_all_or_one_conversation():
    conn = create_archive_connection()
    contact_id = conn.execute(
        """
        INSERT INTO contacts (handle, display_name, handle_type)
        VALUES ('+15550001111', 'Ada Lovelace', 'iphone')
        RETURNING id
        """
    ).fetchone()["id"]
    first_conversation_id = insert_conversation(conn, "iphone-chat:1", "First chat")
    second_conversation_id = insert_conversation(conn, "iphone-chat:2", "Second chat")
    insert_message(conn, first_conversation_id, contact_id, "1", "hello first")
    insert_message(conn, second_conversation_id, contact_id, "2", "hello second")

    all_csv = export_messages_csv(conn)
    filtered_csv = export_messages_csv(conn, conversation_id=first_conversation_id)

    assert "hello first" in all_csv
    assert "hello second" in all_csv
    assert "hello first" in filtered_csv
    assert "hello second" not in filtered_csv


def insert_conversation(conn, source_thread_id, title):
    return conn.execute(
        """
        INSERT INTO conversations (source_thread_id, title)
        VALUES (?, ?)
        RETURNING id
        """,
        (source_thread_id, title),
    ).fetchone()["id"]


def insert_message(conn, conversation_id, contact_id, source_message_id, body):
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
        VALUES (?, ?, ?, '2026-05-13T12:00:00+00:00', 'incoming', ?, 'iMessage')
        """,
        (conversation_id, contact_id, source_message_id, body),
    )
    conn.commit()


def create_archive_connection():
    schema_path = Path(__file__).resolve().parents[1] / "app" / "db" / "schema.sql"
    conn = sqlite3.connect(":memory:")
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    conn.executescript(schema_path.read_text())
    return conn
