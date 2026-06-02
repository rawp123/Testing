import logging
import sqlite3

from server import main


def test_pdf_full_archive_export_returns_downloadable_pdf(tmp_path, monkeypatch):
    create_test_archive(tmp_path, monkeypatch)

    response = main.export_messages_pdf_response()

    assert response.status_code == 200
    assert response.media_type == "application/pdf"
    assert response.headers["content-disposition"] == "attachment; filename=full-archive.pdf"
    assert response.body.startswith(b"%PDF-1.4")
    assert b"Message Archive Export" in response.body
    assert b"Created locally from messages stored on this computer." in response.body
    assert b"Attachments are not included in this export." in response.body


def test_export_responses_include_private_file_headers(tmp_path, monkeypatch):
    create_test_archive(tmp_path, monkeypatch)

    responses = [
        main.export_csv(),
        main.export_messages_pdf_response(),
        main.export_messages_xlsx_response(),
        main.export_search_summary_pdf_response(q="Greenland"),
        main.export_search_summary_xlsx_response(q="Greenland"),
    ]

    for response in responses:
        assert response.headers["cache-control"] == "no-store"
        assert response.headers["pragma"] == "no-cache"
        assert response.headers["x-content-type-options"] == "nosniff"


def test_csv_response_uses_utf8_bom_and_date_range_filename(tmp_path, monkeypatch):
    create_test_archive(tmp_path, monkeypatch)

    response = main.export_csv(start_date="2026-01-01", end_date="2026-01-31")

    assert response.status_code == 200
    assert response.media_type == "text/csv; charset=utf-8"
    assert response.headers["content-disposition"] == "attachment; filename=date-range-messages.csv"
    assert response.body.startswith("\ufeff".encode("utf-8"))
    assert b"Greenland plan" in response.body
    assert b"Iceland follow up" not in response.body


def test_pdf_selected_conversation_export_filters_messages(tmp_path, monkeypatch):
    create_test_archive(tmp_path, monkeypatch)

    response = main.export_messages_pdf_response(conversation_id=1)

    assert response.status_code == 200
    assert response.headers["content-disposition"] == "attachment; filename=conversation-1.pdf"
    assert b"Greenland plan" in response.body
    assert b"Iceland follow up" not in response.body


def test_pdf_search_results_export_filters_messages(tmp_path, monkeypatch):
    create_test_archive(tmp_path, monkeypatch)

    response = main.export_messages_pdf_response(q="Greenland", style="summary")

    assert response.status_code == 200
    assert response.headers["content-disposition"] == "attachment; filename=search-results.pdf"
    assert b"Message Summary Report" in response.body
    assert b"Greenland plan" in response.body
    assert b"Iceland follow up" not in response.body


def test_pdf_empty_export_still_returns_readable_pdf(tmp_path, monkeypatch):
    create_test_archive(tmp_path, monkeypatch)

    response = main.export_messages_pdf_response(q="Neverland")

    assert response.status_code == 200
    assert response.media_type == "application/pdf"
    assert b"No messages matched this export." in response.body


def test_pdf_export_uses_safe_filename_for_search_summary(tmp_path, monkeypatch):
    create_test_archive(tmp_path, monkeypatch)

    response = main.export_search_summary_pdf_response(q="../Greenland secret")

    assert response.status_code == 200
    assert response.headers["content-disposition"] == "attachment; filename=search-summary.pdf"
    assert "/" not in response.headers["content-disposition"].split("filename=", 1)[1]
    assert "\\" not in response.headers["content-disposition"].split("filename=", 1)[1]


def test_pdf_export_does_not_log_message_content(tmp_path, monkeypatch, caplog):
    create_test_archive(tmp_path, monkeypatch)
    caplog.set_level(logging.INFO)

    response = main.export_messages_pdf_response(q="Greenland")

    assert response.status_code == 200
    assert "Greenland plan" not in caplog.text
    assert "Iceland follow up" not in caplog.text


def create_test_archive(tmp_path, monkeypatch):
    db_path = tmp_path / "archive.sqlite3"
    monkeypatch.setenv("MESSAGE_ARCHIVE_DB_PATH", str(db_path))
    main.initialize_database()
    with main.get_connection() as conn:
        insert_sample_archive(conn)


def insert_sample_archive(conn: sqlite3.Connection):
    ada_id = insert_contact(conn, "+15550001111", "Ada Lovelace")
    grace_id = insert_contact(conn, "+15550002222", "Grace Hopper")
    first_conversation_id = insert_conversation(conn, "iphone-chat:1", "Trip chat")
    second_conversation_id = insert_conversation(conn, "iphone-chat:2", "Research chat")
    insert_message(
        conn,
        first_conversation_id,
        ada_id,
        "1",
        "2026-01-05T12:00:00+00:00",
        "Greenland plan",
    )
    insert_message(
        conn,
        second_conversation_id,
        grace_id,
        "2",
        "2026-02-05T12:00:00+00:00",
        "Iceland follow up",
    )


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
