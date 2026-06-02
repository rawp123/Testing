import sqlite3
from pathlib import Path

from server.services.search import build_search_summary


def test_build_search_summary_counts_messages_occurrences_people_conversations_and_dates():
    conn = create_archive_connection()
    ada_id = insert_contact(conn, "+15550001111", "Ada Lovelace")
    grace_id = insert_contact(conn, "+15550002222", "Grace Hopper")
    first_conversation_id = insert_conversation(conn, "iphone-chat:1", "Trip plans")
    second_conversation_id = insert_conversation(conn, "iphone-chat:2", "Family")
    insert_message(
        conn,
        first_conversation_id,
        ada_id,
        "1",
        "2026-01-05T12:00:00+00:00",
        "Greenland and greenland again",
    )
    insert_message(
        conn,
        first_conversation_id,
        grace_id,
        "2",
        "2026-01-20T12:00:00+00:00",
        "No keyword here",
    )
    insert_message(
        conn,
        second_conversation_id,
        grace_id,
        "3",
        "2026-02-02T12:00:00+00:00",
        "Greenland photos",
    )
    insert_message(
        conn,
        second_conversation_id,
        ada_id,
        "4",
        "2026-02-14T12:00:00+00:00",
        "Still thinking about Greenland",
    )

    summary = build_search_summary(conn, "Greenland")

    assert summary["total_matching_messages"] == 3
    assert summary["total_keyword_occurrences"] == 4
    assert summary["people"] == [
        {"name": "Ada Lovelace", "mentions": 3},
        {"name": "Grace Hopper", "mentions": 1},
    ]
    assert summary["conversations"] == [
        {"id": second_conversation_id, "title": "Family", "matching_messages": 2},
        {"id": first_conversation_id, "title": "Trip plans", "matching_messages": 1},
    ]
    assert summary["first_mention_at"] == "2026-01-05T12:00:00+00:00"
    assert summary["most_recent_mention_at"] == "2026-02-14T12:00:00+00:00"
    assert summary["mentions_by_month"] == [
        {"month": "2026-01", "mentions": 2},
        {"month": "2026-02", "mentions": 2},
    ]


def test_build_search_summary_counts_conversation_title_matches_without_keyword_occurrences():
    conn = create_archive_connection()
    contact_id = insert_contact(conn, "+15550001111", "Ada Lovelace")
    conversation_id = insert_conversation(conn, "iphone-chat:1", "Greenland plans")
    insert_message(
        conn,
        conversation_id,
        contact_id,
        "1",
        "2026-01-05T12:00:00+00:00",
        "The place name is only in the thread title",
    )

    summary = build_search_summary(conn, "Greenland")

    assert summary["total_matching_messages"] == 1
    assert summary["total_keyword_occurrences"] == 0
    assert summary["people"] == []
    assert summary["conversations"] == [
        {"id": conversation_id, "title": "Greenland plans", "matching_messages": 1},
    ]
    assert summary["first_mention_at"] is None
    assert summary["most_recent_mention_at"] is None
    assert summary["mentions_by_month"] == []


def test_build_search_summary_returns_empty_summary_for_no_results():
    conn = create_archive_connection()
    contact_id = insert_contact(conn, "+15550001111", "Ada Lovelace")
    conversation_id = insert_conversation(conn, "iphone-chat:1", "Trip plans")
    insert_message(
        conn,
        conversation_id,
        contact_id,
        "1",
        "2026-01-05T12:00:00+00:00",
        "Iceland",
    )

    summary = build_search_summary(conn, "Greenland")

    assert summary == {
        "query": "Greenland",
        "total_matching_messages": 0,
        "total_keyword_occurrences": 0,
        "people": [],
        "conversations": [],
        "first_mention_at": None,
        "most_recent_mention_at": None,
        "mentions_by_month": [],
    }


def insert_contact(conn, handle, display_name):
    return conn.execute(
        """
        INSERT INTO contacts (handle, display_name, handle_type)
        VALUES (?, ?, 'iphone')
        RETURNING id
        """,
        (handle, display_name),
    ).fetchone()["id"]


def insert_conversation(conn, source_thread_id, title):
    return conn.execute(
        """
        INSERT INTO conversations (source_thread_id, title)
        VALUES (?, ?)
        RETURNING id
        """,
        (source_thread_id, title),
    ).fetchone()["id"]


def insert_message(conn, conversation_id, contact_id, source_message_id, sent_at, body):
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
        VALUES (?, ?, ?, ?, 'incoming', ?, 'iMessage')
        """,
        (conversation_id, contact_id, source_message_id, sent_at, body),
    )
    conn.commit()


def create_archive_connection():
    schema_path = Path(__file__).resolve().parents[1] / "server" / "db" / "schema.sql"
    conn = sqlite3.connect(":memory:")
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    conn.executescript(schema_path.read_text())
    return conn
