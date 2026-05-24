import csv
import io
import sqlite3


def export_messages_csv(conn: sqlite3.Connection, conversation_id: int | None = None) -> str:
    output = io.StringIO()
    writer = csv.DictWriter(
        output,
        fieldnames=[
            "sent_at",
            "conversation_title",
            "sender_name",
            "sender_handle",
            "direction",
            "body",
            "service",
        ],
    )
    writer.writeheader()

    where_clause = ""
    params = ()
    if conversation_id is not None:
        where_clause = "WHERE conversations.id = ?"
        params = (conversation_id,)

    rows = conn.execute(
        f"""
        SELECT
          messages.sent_at,
          conversations.title AS conversation_title,
          contacts.display_name AS sender_name,
          contacts.handle AS sender_handle,
          messages.direction,
          messages.body,
          messages.service
        FROM messages
        JOIN conversations ON conversations.id = messages.conversation_id
        LEFT JOIN contacts ON contacts.id = messages.sender_contact_id
        {where_clause}
        ORDER BY messages.sent_at ASC
        """,
        params,
    ).fetchall()
    for row in rows:
        writer.writerow(dict(row))

    return output.getvalue()
