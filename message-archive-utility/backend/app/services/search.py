import sqlite3


def search_messages(conn: sqlite3.Connection, q: str, limit: int = 50) -> list[dict]:
    query = f"%{q.strip()}%"
    rows = conn.execute(
        """
        SELECT
          messages.id,
          messages.conversation_id,
          messages.sent_at,
          messages.direction,
          messages.body,
          messages.service,
          conversations.title AS conversation_title,
          contacts.display_name AS sender_name,
          contacts.handle AS sender_handle
        FROM messages
        JOIN conversations ON conversations.id = messages.conversation_id
        LEFT JOIN contacts ON contacts.id = messages.sender_contact_id
        WHERE ? = '%%' OR messages.body LIKE ? OR conversations.title LIKE ? OR contacts.display_name LIKE ?
        ORDER BY messages.sent_at DESC
        LIMIT ?
        """,
        (query, query, query, query, max(1, min(limit, 200))),
    ).fetchall()
    return [dict(row) for row in rows]
