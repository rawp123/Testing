import io
import logging
import sqlite3
import zipfile

from app import main
from app.services.export_xlsx import EXCEL_MEDIA_TYPE


def test_export_people_lists_contacts_with_message_counts(tmp_path, monkeypatch):
    ids = create_test_archive(tmp_path, monkeypatch)

    response = main.list_export_people()

    assert response["people"] == [
        {
            "id": ids["ada_id"],
            "name": "Ada / Lovelace",
            "detail": "+15550001111",
            "message_count": 2,
            "conversation_count": 1,
            "description": "1 conversation, 2 messages",
        },
        {
            "id": ids["grace_id"],
            "name": "Grace Hopper",
            "detail": "+15550002222",
            "message_count": 1,
            "conversation_count": 1,
            "description": "1 conversation, 1 message",
        },
        {
            "id": ids["local_id"],
            "name": "Local User",
            "detail": "me",
            "message_count": 2,
            "conversation_count": 1,
            "description": "1 conversation, 2 messages",
        },
    ]


def test_csv_person_export_includes_messages_with_that_person(tmp_path, monkeypatch):
    ids = create_test_archive(tmp_path, monkeypatch)

    response = main.export_csv(contact_id=ids["ada_id"])

    assert response.status_code == 200
    assert response.media_type == "text/csv; charset=utf-8"
    assert response.headers["content-disposition"] == "attachment; filename=messages-with-Ada-Lovelace.csv"
    assert "Greenland plan" in response.body.decode("utf-8")
    assert "Local reply to Ada" in response.body.decode("utf-8")
    assert "Iceland follow up" not in response.body.decode("utf-8")


def test_pdf_person_export_includes_messages_with_that_person(tmp_path, monkeypatch):
    ids = create_test_archive(tmp_path, monkeypatch)

    response = main.export_messages_pdf_response(contact_id=ids["ada_id"])

    assert response.status_code == 200
    assert response.media_type == "application/pdf"
    assert response.headers["content-disposition"] == "attachment; filename=messages-with-Ada-Lovelace.pdf"
    assert b"Greenland plan" in response.body
    assert b"Local reply to Ada" in response.body
    assert b"Iceland follow up" not in response.body


def test_excel_person_export_includes_messages_with_that_person(tmp_path, monkeypatch):
    ids = create_test_archive(tmp_path, monkeypatch)

    response = main.export_messages_xlsx_response(contact_id=ids["ada_id"])

    assert response.status_code == 200
    assert response.media_type == EXCEL_MEDIA_TYPE
    assert response.headers["content-disposition"] == "attachment; filename=messages-with-Ada-Lovelace.xlsx"
    xml = workbook_xml_text(response.body)
    assert "Greenland plan" in xml
    assert "Local reply to Ada" in xml
    assert "Iceland follow up" not in xml


def test_person_export_with_no_matching_messages_returns_empty_files(tmp_path, monkeypatch):
    ids = create_test_archive(tmp_path, monkeypatch)

    csv_response = main.export_csv(contact_id=ids["empty_id"])
    pdf_response = main.export_messages_pdf_response(contact_id=ids["empty_id"])
    xlsx_response = main.export_messages_xlsx_response(contact_id=ids["empty_id"])

    assert "Greenland plan" not in csv_response.body.decode("utf-8")
    assert b"No messages matched this export." in pdf_response.body
    assert "No messages matched this export." in workbook_xml_text(xlsx_response.body)


def test_person_export_does_not_break_other_export_scopes(tmp_path, monkeypatch):
    ids = create_test_archive(tmp_path, monkeypatch)

    full_csv = main.export_csv()
    conversation_pdf = main.export_messages_pdf_response(conversation_id=ids["ada_conversation_id"])
    search_xlsx = main.export_messages_xlsx_response(q="Greenland")
    date_xlsx = main.export_messages_xlsx_response(start_date="2026-02-01", end_date="2026-02-28")

    assert "Greenland plan" in full_csv.body.decode("utf-8")
    assert "Iceland follow up" in full_csv.body.decode("utf-8")
    assert b"Local reply to Ada" in conversation_pdf.body
    assert b"Iceland follow up" not in conversation_pdf.body
    assert "Greenland plan" in workbook_xml_text(search_xlsx.body)
    assert "Iceland follow up" not in workbook_xml_text(search_xlsx.body)
    assert "Iceland follow up" in workbook_xml_text(date_xlsx.body)
    assert "Greenland plan" not in workbook_xml_text(date_xlsx.body)


def test_person_export_does_not_log_message_content(tmp_path, monkeypatch, caplog):
    ids = create_test_archive(tmp_path, monkeypatch)
    caplog.set_level(logging.INFO)

    response = main.export_messages_pdf_response(contact_id=ids["ada_id"])

    assert response.status_code == 200
    assert "Greenland plan" not in caplog.text
    assert "Local reply to Ada" not in caplog.text


def test_person_export_uses_safe_filename(tmp_path, monkeypatch):
    ids = create_test_archive(tmp_path, monkeypatch)

    csv_response = main.export_csv(contact_id=ids["ada_id"])
    pdf_response = main.export_messages_pdf_response(contact_id=ids["ada_id"])
    xlsx_response = main.export_messages_xlsx_response(contact_id=ids["ada_id"])

    for response in [csv_response, pdf_response, xlsx_response]:
        filename = response.headers["content-disposition"].split("filename=", 1)[1]
        assert "/" not in filename
        assert "\\" not in filename
        assert filename.startswith("messages-with-Ada-Lovelace")


def workbook_xml_text(body: bytes) -> str:
    with zipfile.ZipFile(io.BytesIO(body)) as archive:
        return "\n".join(
            archive.read(name).decode("utf-8")
            for name in sorted(archive.namelist())
            if name.endswith(".xml")
        )


def create_test_archive(tmp_path, monkeypatch):
    db_path = tmp_path / "archive.sqlite3"
    monkeypatch.setenv("MESSAGE_ARCHIVE_DB_PATH", str(db_path))
    main.initialize_database()
    with main.get_connection() as conn:
        return insert_sample_archive(conn)


def insert_sample_archive(conn: sqlite3.Connection):
    ada_id = insert_contact(conn, "+15550001111", "Ada / Lovelace")
    grace_id = insert_contact(conn, "+15550002222", "Grace Hopper")
    local_id = insert_contact(conn, "me", "Local User")
    empty_id = insert_contact(conn, "+15550003333", "Empty Person")
    ada_conversation_id = insert_conversation(conn, "iphone-chat:1", "Trip chat")
    grace_conversation_id = insert_conversation(conn, "iphone-chat:2", "Research chat")

    insert_participant(conn, ada_conversation_id, ada_id)
    insert_participant(conn, ada_conversation_id, local_id)
    insert_participant(conn, grace_conversation_id, grace_id)

    insert_message(
        conn,
        ada_conversation_id,
        ada_id,
        "1",
        "2026-01-05T12:00:00+00:00",
        "Greenland plan",
    )
    insert_message(
        conn,
        ada_conversation_id,
        local_id,
        "2",
        "2026-01-05T12:05:00+00:00",
        "Local reply to Ada",
    )
    insert_message(
        conn,
        grace_conversation_id,
        grace_id,
        "3",
        "2026-02-05T12:00:00+00:00",
        "Iceland follow up",
    )

    return {
        "ada_id": ada_id,
        "grace_id": grace_id,
        "local_id": local_id,
        "empty_id": empty_id,
        "ada_conversation_id": ada_conversation_id,
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


def insert_participant(conn, conversation_id, contact_id):
    conn.execute(
        """
        INSERT INTO conversation_participants (conversation_id, contact_id)
        VALUES (?, ?)
        """,
        (conversation_id, contact_id),
    )
    conn.commit()


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
