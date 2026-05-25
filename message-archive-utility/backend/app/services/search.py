import sqlite3
from collections import Counter


def normalize_search_query(q: str) -> str:
    return q.strip()


def build_search_like_query(q: str) -> str:
    return f"%{normalize_search_query(q)}%"


def count_keyword_occurrences(text: str | None, keyword: str) -> int:
    normalized_keyword = normalize_search_query(keyword).casefold()
    if not normalized_keyword:
        return 0
    return str(text or "").casefold().count(normalized_keyword)


def search_messages(conn: sqlite3.Connection, q: str, limit: int = 50) -> list[dict]:
    query = build_search_like_query(q)
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


def count_matching_messages(conn: sqlite3.Connection, q: str) -> int:
    normalized_query = normalize_search_query(q)
    if not normalized_query:
        return 0
    query = build_search_like_query(normalized_query)
    return int(
        conn.execute(
            """
            SELECT COUNT(*)
            FROM messages
            JOIN conversations ON conversations.id = messages.conversation_id
            LEFT JOIN contacts ON contacts.id = messages.sender_contact_id
            WHERE messages.body LIKE ? OR conversations.title LIKE ? OR contacts.display_name LIKE ?
            """,
            (query, query, query),
        ).fetchone()[0]
        or 0
    )


def build_search_summary(conn: sqlite3.Connection, q: str) -> dict:
    normalized_query = normalize_search_query(q)
    empty_summary = {
        "query": q,
        "total_matching_messages": 0,
        "total_keyword_occurrences": 0,
        "people": [],
        "conversations": [],
        "first_mention_at": None,
        "most_recent_mention_at": None,
        "mentions_by_month": [],
    }
    if not normalized_query:
        return empty_summary

    query = build_search_like_query(normalized_query)
    rows = conn.execute(
        """
        SELECT
          messages.id,
          messages.conversation_id,
          messages.sent_at,
          messages.body,
          conversations.title AS conversation_title,
          contacts.display_name AS sender_name,
          contacts.handle AS sender_handle
        FROM messages
        JOIN conversations ON conversations.id = messages.conversation_id
        LEFT JOIN contacts ON contacts.id = messages.sender_contact_id
        WHERE messages.body LIKE ? OR conversations.title LIKE ? OR contacts.display_name LIKE ?
        ORDER BY messages.sent_at ASC, messages.id ASC
        """,
        (query, query, query),
    ).fetchall()

    if not rows:
        return empty_summary

    people_counts = Counter()
    conversation_counts = Counter()
    conversation_titles: dict[int, str] = {}
    month_counts = Counter()
    total_occurrences = 0
    mention_dates = []

    for row in rows:
        occurrence_count = count_keyword_occurrences(row["body"], normalized_query)
        sender_name = format_summary_label(row["sender_name"], row["sender_handle"], "Unknown sender")
        conversation_title = row["conversation_title"] or "Untitled conversation"
        conversation_id = row["conversation_id"]

        conversation_titles[conversation_id] = conversation_title
        conversation_counts[conversation_id] += 1

        if occurrence_count > 0:
            people_counts[sender_name] += occurrence_count
            total_occurrences += occurrence_count
            month_key = format_month_key(row["sent_at"])
            if month_key:
                month_counts[month_key] += occurrence_count
            if row["sent_at"]:
                mention_dates.append(row["sent_at"])

    return {
        "query": q,
        "total_matching_messages": len(rows),
        "total_keyword_occurrences": total_occurrences,
        "people": [
            {"name": name, "mentions": mentions}
            for name, mentions in sorted(people_counts.items(), key=lambda item: (-item[1], item[0].casefold()))
        ],
        "conversations": [
            {
                "id": conversation_id,
                "title": conversation_titles[conversation_id],
                "matching_messages": matching_messages,
            }
            for conversation_id, matching_messages in sorted(
                conversation_counts.items(),
                key=lambda item: (-item[1], conversation_titles[item[0]].casefold()),
            )
        ],
        "first_mention_at": min(mention_dates) if mention_dates else None,
        "most_recent_mention_at": max(mention_dates) if mention_dates else None,
        "mentions_by_month": [
            {"month": month, "mentions": mentions}
            for month, mentions in sorted(month_counts.items())
        ],
    }


def format_summary_label(display_name: str | None, handle: str | None, fallback: str) -> str:
    value = display_name or handle
    return value.strip() if value and value.strip() else fallback


def format_month_key(value: str | None) -> str | None:
    if not value or len(value) < 7:
        return None
    return value[:7]
