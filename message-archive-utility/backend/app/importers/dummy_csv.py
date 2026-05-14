import csv
import sqlite3
from pathlib import Path


REQUIRED_COLUMNS = {
    "conversation_source_id",
    "conversation_title",
    "sender_name",
    "sender_handle",
    "direction",
    "sent_at",
    "body",
}


def import_sample_csv(conn: sqlite3.Connection, csv_path: Path) -> int:
    """Import the repository's fake fixture CSV only."""
    if csv_path.name != "sample_messages.csv" or "fixtures" not in csv_path.parts:
        raise ValueError("Dummy importer only accepts the fake sample fixture.")

    with csv_path.open(newline="", encoding="utf-8") as file:
        reader = csv.DictReader(file)
        missing = REQUIRED_COLUMNS.difference(reader.fieldnames or [])
        if missing:
            raise ValueError(f"Sample CSV is missing columns: {sorted(missing)}")

        imported = 0
        for row in reader:
            contact_id = upsert_contact(
                conn,
                display_name=row["sender_name"],
                handle=row["sender_handle"],
            )
            conversation_id = upsert_conversation(
                conn,
                source_thread_id=row["conversation_source_id"],
                title=row["conversation_title"],
            )
            conn.execute(
                """
                INSERT OR IGNORE INTO conversation_participants (conversation_id, contact_id)
                VALUES (?, ?)
                """,
                (conversation_id, contact_id),
            )
            cursor = conn.execute(
                """
                INSERT OR IGNORE INTO messages (
                  conversation_id,
                  sender_contact_id,
                  source_message_id,
                  sent_at,
                  direction,
                  body,
                  service
                )
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    conversation_id,
                    contact_id,
                    row.get("source_message_id"),
                    row["sent_at"],
                    row["direction"],
                    row["body"],
                    row.get("service", "sample"),
                ),
            )
            imported += cursor.rowcount

    conn.commit()
    return imported


def upsert_contact(conn: sqlite3.Connection, display_name: str, handle: str) -> int:
    conn.execute(
        """
        INSERT INTO contacts (display_name, handle, handle_type)
        VALUES (?, ?, 'sample')
        ON CONFLICT(handle) DO UPDATE SET display_name = excluded.display_name
        """,
        (display_name, handle),
    )
    return int(conn.execute("SELECT id FROM contacts WHERE handle = ?", (handle,)).fetchone()["id"])


def upsert_conversation(conn: sqlite3.Connection, source_thread_id: str, title: str) -> int:
    conn.execute(
        """
        INSERT INTO conversations (source_thread_id, title, updated_at)
        VALUES (?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(source_thread_id) DO UPDATE SET
          title = excluded.title,
          updated_at = CURRENT_TIMESTAMP
        """,
        (source_thread_id, title),
    )
    return int(
        conn.execute(
            "SELECT id FROM conversations WHERE source_thread_id = ?",
            (source_thread_id,),
        ).fetchone()["id"]
    )
