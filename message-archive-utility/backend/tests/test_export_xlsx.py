import io
import logging
import sqlite3
import zipfile

from server import main
from server.services.export_xlsx import EXCEL_MEDIA_TYPE


def test_excel_full_archive_export_returns_analysis_workbook(tmp_path, monkeypatch):
    create_test_archive(tmp_path, monkeypatch)

    response = main.export_messages_xlsx_response()

    assert response.status_code == 200
    assert response.media_type == EXCEL_MEDIA_TYPE
    assert response.headers["content-disposition"] == "attachment; filename=full-archive.xlsx"
    assert response.body.startswith(b"PK")
    assert workbook_sheet_names(response.body) == [
        "Messages",
        "Conversations",
        "Contacts",
        "Search Stats",
        "Speaker Counts",
        "Monthly Counts",
        "Export Notes",
        "Filters Criteria",
    ]
    xml = workbook_xml_text(response.body)
    assert "Date/Time" in xml
    assert "Sender" in xml
    assert "Conversation" in xml
    assert "Message" in xml
    assert "Greenland plan" in xml
    assert "Created locally from messages stored on this computer." in xml


def test_excel_selected_conversation_export_filters_messages(tmp_path, monkeypatch):
    create_test_archive(tmp_path, monkeypatch)

    response = main.export_messages_xlsx_response(conversation_id=1)

    assert response.status_code == 200
    assert response.headers["content-disposition"] == "attachment; filename=conversation-1.xlsx"
    xml = workbook_xml_text(response.body)
    assert "Greenland plan" in xml
    assert "Greenland and greenland again" in xml
    assert "Iceland follow up" not in xml


def test_excel_search_results_export_includes_search_stats(tmp_path, monkeypatch):
    create_test_archive(tmp_path, monkeypatch)

    response = main.export_messages_xlsx_response(q="Greenland")

    assert response.status_code == 200
    assert response.headers["content-disposition"] == "attachment; filename=search-results.xlsx"
    xml = workbook_xml_text(response.body)
    assert "Search term used" in xml
    assert "Total matching messages" in xml
    assert "Total keyword occurrences" in xml
    assert "First mention" in xml
    assert "Most recent mention" in xml
    assert "Greenland" in xml
    assert "Iceland follow up" not in xml


def test_excel_date_range_export_filters_messages(tmp_path, monkeypatch):
    create_test_archive(tmp_path, monkeypatch)

    response = main.export_messages_xlsx_response(start_date="2026-02-01", end_date="2026-02-28")

    assert response.status_code == 200
    assert response.headers["content-disposition"] == "attachment; filename=date-range.xlsx"
    xml = workbook_xml_text(response.body)
    assert "Greenland and greenland again" in xml
    assert "Iceland follow up" in xml
    assert "Greenland plan" not in xml


def test_excel_search_summary_only_export_includes_summary_tabs(tmp_path, monkeypatch):
    create_test_archive(tmp_path, monkeypatch)

    response = main.export_search_summary_xlsx_response(q="Greenland")

    assert response.status_code == 200
    assert response.media_type == EXCEL_MEDIA_TYPE
    assert response.headers["content-disposition"] == "attachment; filename=search-summary.xlsx"
    xml = workbook_xml_text(response.body)
    assert "Search Stats" in workbook_xml(response.body)
    assert "Speaker Counts" in workbook_xml(response.body)
    assert "Monthly Counts" in workbook_xml(response.body)
    assert "Total matching messages" in xml
    assert "Total keyword occurrences" in xml
    assert "Summary report only" in xml


def test_excel_empty_export_still_returns_readable_workbook(tmp_path, monkeypatch):
    create_test_archive(tmp_path, monkeypatch)

    response = main.export_messages_xlsx_response(q="Neverland")

    assert response.status_code == 200
    assert response.media_type == EXCEL_MEDIA_TYPE
    xml = workbook_xml_text(response.body)
    assert "No messages matched this export." in xml
    assert "Message count" in xml
    assert ">0<" in xml


def test_excel_export_uses_safe_filename_for_search_summary(tmp_path, monkeypatch):
    create_test_archive(tmp_path, monkeypatch)

    response = main.export_search_summary_xlsx_response(q="../Greenland secret")

    assert response.status_code == 200
    assert response.headers["content-disposition"] == "attachment; filename=search-summary.xlsx"
    filename = response.headers["content-disposition"].split("filename=", 1)[1]
    assert "/" not in filename
    assert "\\" not in filename


def test_excel_workbook_handles_blank_special_and_long_message_bodies(tmp_path, monkeypatch):
    create_test_archive(tmp_path, monkeypatch, include_special_messages=True)

    response = main.export_messages_xlsx_response()

    assert response.status_code == 200
    xml = workbook_xml_text(response.body)
    assert "Emoji" in xml
    assert "No text body" in xml
    assert "Line one" in xml
    assert "Line two" in xml


def test_excel_export_does_not_log_message_content(tmp_path, monkeypatch, caplog):
    create_test_archive(tmp_path, monkeypatch)
    caplog.set_level(logging.INFO)

    response = main.export_messages_xlsx_response(q="Greenland")

    assert response.status_code == 200
    assert "Greenland plan" not in caplog.text
    assert "Iceland follow up" not in caplog.text


def workbook_xml(body: bytes) -> str:
    with zipfile.ZipFile(io.BytesIO(body)) as archive:
        return archive.read("xl/workbook.xml").decode("utf-8")


def workbook_sheet_names(body: bytes) -> list[str]:
    xml = workbook_xml(body)
    names = []
    for part in xml.split("<sheet ")[1:]:
        names.append(part.split('name="', 1)[1].split('"', 1)[0])
    return names


def workbook_xml_text(body: bytes) -> str:
    with zipfile.ZipFile(io.BytesIO(body)) as archive:
        return "\n".join(
            archive.read(name).decode("utf-8")
            for name in sorted(archive.namelist())
            if name.endswith(".xml")
        )


def create_test_archive(tmp_path, monkeypatch, *, include_special_messages=False):
    db_path = tmp_path / "archive.sqlite3"
    monkeypatch.setenv("MESSAGE_ARCHIVE_DB_PATH", str(db_path))
    main.initialize_database()
    with main.get_connection() as conn:
        insert_sample_archive(conn, include_special_messages=include_special_messages)


def insert_sample_archive(conn: sqlite3.Connection, *, include_special_messages=False):
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
        first_conversation_id,
        grace_id,
        "2",
        "2026-02-10T12:00:00+00:00",
        "Greenland and greenland again",
    )
    insert_message(
        conn,
        second_conversation_id,
        grace_id,
        "3",
        "2026-02-20T12:00:00+00:00",
        "Iceland follow up",
    )
    if include_special_messages:
        insert_message(
            conn,
            second_conversation_id,
            ada_id,
            "4",
            "2026-03-01T12:00:00+00:00",
            "Emoji 😀 search with line breaks\nLine one\nLine two",
        )
        insert_message(
            conn,
            second_conversation_id,
            grace_id,
            "5",
            "2026-03-02T12:00:00+00:00",
            "",
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
