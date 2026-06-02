import sqlite3
from pathlib import Path

from server.services.export_csv import export_messages_csv


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


def test_export_messages_csv_can_export_search_results():
    conn = create_archive_connection()
    contact_id = conn.execute(
        """
        INSERT INTO contacts (handle, display_name, handle_type)
        VALUES ('+15550001111', 'Ada Lovelace', 'iphone')
        RETURNING id
        """
    ).fetchone()["id"]
    conversation_id = insert_conversation(conn, "iphone-chat:1", "Trip chat")
    insert_message(conn, conversation_id, contact_id, "1", "Greenland plan")
    insert_message(conn, conversation_id, contact_id, "2", "Iceland plan")

    search_csv = export_messages_csv(conn, q="Greenland")

    assert "Greenland plan" in search_csv
    assert "Iceland plan" not in search_csv


def test_export_messages_csv_can_export_date_range():
    conn = create_archive_connection()
    contact_id = conn.execute(
        """
        INSERT INTO contacts (handle, display_name, handle_type)
        VALUES ('+15550001111', 'Ada Lovelace', 'iphone')
        RETURNING id
        """
    ).fetchone()["id"]
    conversation_id = insert_conversation(conn, "iphone-chat:1", "Date chat")
    insert_message(conn, conversation_id, contact_id, "1", "January message", sent_at="2026-01-15T12:00:00+00:00")
    insert_message(conn, conversation_id, contact_id, "2", "February message", sent_at="2026-02-15T12:00:00+00:00")

    date_csv = export_messages_csv(conn, start_date="2026-02-01", end_date="2026-02-28")

    assert "February message" in date_csv
    assert "January message" not in date_csv


def test_export_messages_csv_includes_attachment_count():
    conn = create_archive_connection()
    contact_id = conn.execute(
        """
        INSERT INTO contacts (handle, display_name, handle_type)
        VALUES ('+15550001111', 'Ada Lovelace', 'iphone')
        RETURNING id
        """
    ).fetchone()["id"]
    conversation_id = insert_conversation(conn, "iphone-chat:1", "Attachment chat")
    message_id = insert_message(conn, conversation_id, contact_id, "1", "see photo")
    attachment_id = conn.execute(
        """
        INSERT INTO attachments (source_ref, mime_type, availability_status)
        VALUES ('fake-attachment', 'image/jpeg', 'metadata_only')
        RETURNING id
        """
    ).fetchone()["id"]
    conn.execute(
        "INSERT INTO message_attachments (message_id, attachment_id) VALUES (?, ?)",
        (message_id, attachment_id),
    )
    conn.commit()

    csv_text = export_messages_csv(conn)

    assert "attachment_count" in csv_text.splitlines()[0]
    assert "see photo" in csv_text
    assert ",1" in csv_text


def test_export_messages_csv_neutralizes_spreadsheet_formulas():
    conn = create_archive_connection()
    contact_id = conn.execute(
        """
        INSERT INTO contacts (handle, display_name, handle_type)
        VALUES ('=cmd', '+SUM(1,1)', 'iphone')
        RETURNING id
        """
    ).fetchone()["id"]
    conversation_id = insert_conversation(conn, "iphone-chat:1", "@Risky chat")
    insert_message(conn, conversation_id, contact_id, "1", "=HYPERLINK(\"http://example.test\")")

    csv_text = export_messages_csv(conn)

    assert "'=HYPERLINK" in csv_text
    assert "'+SUM(1,1)" in csv_text
    assert "'@Risky chat" in csv_text
    assert "'=cmd" in csv_text


def test_export_messages_csv_neutralizes_whitespace_prefixed_formulas():
    conn = create_archive_connection()
    contact_id = conn.execute(
        """
        INSERT INTO contacts (handle, display_name, handle_type)
        VALUES ('\t=cmd', '\n+SUM(1,1)', 'iphone')
        RETURNING id
        """
    ).fetchone()["id"]
    conversation_id = insert_conversation(conn, "iphone-chat:1", " @Risky chat")
    insert_message(conn, conversation_id, contact_id, "1", "\t=HYPERLINK(\"http://example.test\")")

    csv_text = export_messages_csv(conn)

    assert "'\t=HYPERLINK" in csv_text
    assert "'\n+SUM(1,1)" in csv_text
    assert "' @Risky chat" in csv_text
    assert "'\t=cmd" in csv_text


def insert_conversation(conn, source_thread_id, title):
    return conn.execute(
        """
        INSERT INTO conversations (source_thread_id, title)
        VALUES (?, ?)
        RETURNING id
        """,
        (source_thread_id, title),
    ).fetchone()["id"]


def insert_message(conn, conversation_id, contact_id, source_message_id, body, *, sent_at="2026-05-13T12:00:00+00:00"):
    row = conn.execute(
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
        RETURNING id
        """,
        (conversation_id, contact_id, source_message_id, sent_at, body),
    ).fetchone()
    conn.commit()
    return row["id"]


def create_archive_connection():
    schema_path = Path(__file__).resolve().parents[1] / "server" / "db" / "schema.sql"
    conn = sqlite3.connect(":memory:")
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    conn.executescript(schema_path.read_text())
    return conn
