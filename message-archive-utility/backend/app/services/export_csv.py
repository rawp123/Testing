import csv
import io
import sqlite3


def export_messages_csv(
    conn: sqlite3.Connection,
    conversation_id: int | None = None,
    q: str | None = None,
    start_date: str | None = None,
    end_date: str | None = None,
    contact_id: int | None = None,
) -> str:
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

    where_conditions = []
    params: list[object] = []
    if conversation_id is not None:
        where_conditions.append("conversations.id = ?")
        params.append(conversation_id)
    if q and q.strip():
        query = f"%{q.strip()}%"
        where_conditions.append(
            "(messages.body LIKE ? OR conversations.title LIKE ? OR contacts.display_name LIKE ?)"
        )
        params.extend([query, query, query])
    if start_date:
        where_conditions.append("date(messages.sent_at) >= date(?)")
        params.append(start_date)
    if end_date:
        where_conditions.append("date(messages.sent_at) <= date(?)")
        params.append(end_date)
    if contact_id is not None:
        where_conditions.append(
            """
            (
              messages.conversation_id IN (
                SELECT conversation_id
                FROM conversation_participants
                WHERE contact_id = ?
              )
              OR messages.sender_contact_id = ?
            )
            """
        )
        params.extend([contact_id, contact_id])

    where_clause = f"WHERE {' AND '.join(where_conditions)}" if where_conditions else ""

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
        tuple(params),
    ).fetchall()
    for row in rows:
        writer.writerow({key: safe_csv_cell(value) for key, value in dict(row).items()})

    return output.getvalue()


def safe_csv_cell(value):
    if isinstance(value, str) and value.lstrip(" \t\r\n\ufeff")[:1] in {"=", "+", "-", "@"}:
        return f"'{value}"
    return value
