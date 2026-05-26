from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
import re
import sqlite3
import textwrap
from zoneinfo import ZoneInfo

from app.services.search import build_search_summary

PRIVACY_NOTE = "Created locally from messages stored on this computer."
ATTACHMENT_NOTE = "Attachments are not included in this export."
SUPPORTED_PDF_STYLES = {"conversation", "transcript", "summary"}


@dataclass
class PdfExport:
    content: bytes
    filename: str


def export_messages_pdf(
    conn: sqlite3.Connection,
    *,
    conversation_id: int | None = None,
    q: str | None = None,
    start_date: str | None = None,
    end_date: str | None = None,
    contact_id: int | None = None,
    style: str = "conversation",
) -> PdfExport:
    normalized_style = normalize_pdf_style(style)
    rows = fetch_export_messages(
        conn,
        conversation_id=conversation_id,
        q=q,
        start_date=start_date,
        end_date=end_date,
        contact_id=contact_id,
    )
    scope = build_scope_description(
        conn,
        conversation_id=conversation_id,
        q=q,
        start_date=start_date,
        end_date=end_date,
        contact_id=contact_id,
    )
    title = build_export_title(scope, normalized_style)
    lines = build_message_pdf_lines(
        conn,
        rows,
        title=title,
        scope=scope,
        style=normalized_style,
        q=q,
    )
    filename = build_messages_pdf_filename(scope)
    return PdfExport(content=SimplePdfDocument(title, lines).render(), filename=filename)


def export_search_summary_pdf(conn: sqlite3.Connection, *, q: str, style: str = "summary") -> PdfExport:
    normalized_query = q.strip()
    summary = build_search_summary(conn, normalized_query)
    title = "Search Summary Report"
    scope = {
        "label": "Summary report only",
        "filename_label": "search-summary",
        "details": [f"Search term: {normalized_query or 'No search term'}"],
    }
    lines = [
        title,
        f"Export date: {format_export_datetime()}",
        f"Export scope: {scope['label']}",
        *scope["details"],
        f"Matching messages: {summary['total_matching_messages']}",
        f"Total mentions: {summary['total_keyword_occurrences']}",
        f"First mention: {format_pdf_date(summary['first_mention_at'])}",
        f"Most recent mention: {format_pdf_date(summary['most_recent_mention_at'])}",
        "",
        "Who mentioned this?",
        *format_count_lines(summary["people"], "name", "mentions", "mentions"),
        "",
        "Where it appeared",
        *format_count_lines(summary["conversations"], "title", "matching_messages", "matching messages"),
        "",
        "Mentions over time",
        *format_month_lines(summary["mentions_by_month"]),
        "",
        PRIVACY_NOTE,
        ATTACHMENT_NOTE,
    ]
    filename = f"{safe_filename_part(scope['filename_label'])}.pdf"
    return PdfExport(content=SimplePdfDocument(title, lines).render(), filename=filename)


def fetch_export_messages(
    conn: sqlite3.Connection,
    *,
    conversation_id: int | None = None,
    q: str | None = None,
    start_date: str | None = None,
    end_date: str | None = None,
    contact_id: int | None = None,
) -> list[dict]:
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
          messages.id,
          messages.sent_at,
          messages.direction,
          messages.body,
          messages.service,
          conversations.id AS conversation_id,
          conversations.title AS conversation_title,
          contacts.display_name AS sender_name,
          contacts.handle AS sender_handle,
          COALESCE(attachment_counts.attachment_count, 0) AS attachment_count
        FROM messages
        JOIN conversations ON conversations.id = messages.conversation_id
        LEFT JOIN contacts ON contacts.id = messages.sender_contact_id
        LEFT JOIN (
          SELECT message_id, COUNT(*) AS attachment_count
          FROM message_attachments
          GROUP BY message_id
        ) attachment_counts ON attachment_counts.message_id = messages.id
        {where_clause}
        ORDER BY messages.sent_at ASC, messages.id ASC
        """,
        tuple(params),
    ).fetchall()
    return [dict(row) for row in rows]


def build_message_pdf_lines(
    conn: sqlite3.Connection,
    rows: list[dict],
    *,
    title: str,
    scope: dict,
    style: str,
    q: str | None,
) -> list[str]:
    lines = [
        title,
        f"Export date: {format_export_datetime()}",
        f"Export scope: {scope['label']}",
        *scope["details"],
        f"Total messages: {len(rows)}",
        PRIVACY_NOTE,
        ATTACHMENT_NOTE,
        "",
    ]

    if style == "summary":
        lines.extend(build_summary_intro(conn, q=q, rows=rows))
        lines.append("")

    if not rows:
        lines.append("No messages matched this export.")
        return lines

    current_date = ""
    for row in rows:
        if style == "conversation":
            date_key = format_pdf_date(row["sent_at"])
            if date_key != current_date:
                current_date = date_key
                lines.extend(["", current_date])
            sender = format_sender(row)
            body = row["body"] or "No text body"
            lines.append(f"{format_pdf_time(row['sent_at'])} - {sender}")
            lines.extend(wrap_body(body, width=88))
        elif style == "transcript":
            sender = format_sender(row)
            body = row["body"] or "No text body"
            lines.append(f"{format_pdf_datetime(row['sent_at'])} | {sender} | {row['conversation_title'] or 'Untitled conversation'}")
            lines.extend(wrap_body(body, width=92))
        else:
            sender = format_sender(row)
            body = row["body"] or "No text body"
            lines.append(f"{format_pdf_datetime(row['sent_at'])} - {sender}")
            lines.extend(wrap_body(body, width=88))
        lines.append("")

    return lines


def build_summary_intro(conn: sqlite3.Connection, *, q: str | None, rows: list[dict]) -> list[str]:
    if q and q.strip():
        summary = build_search_summary(conn, q)
        return [
            "Summary",
            f"Matching messages: {summary['total_matching_messages']}",
            f"Total mentions: {summary['total_keyword_occurrences']}",
            f"First mention: {format_pdf_date(summary['first_mention_at'])}",
            f"Most recent mention: {format_pdf_date(summary['most_recent_mention_at'])}",
        ]

    conversations = {row["conversation_id"] for row in rows}
    senders = {format_sender(row) for row in rows}
    return [
        "Summary",
        f"Conversations included: {len(conversations)}",
        f"People included: {len(senders)}",
    ]


def build_scope_description(
    conn: sqlite3.Connection,
    *,
    conversation_id: int | None,
    q: str | None,
    start_date: str | None,
    end_date: str | None,
    contact_id: int | None,
) -> dict:
    details = []
    filename_parts = []
    if conversation_id is not None:
        row = conn.execute("SELECT title FROM conversations WHERE id = ?", (conversation_id,)).fetchone()
        title = row["title"] if row and row["title"] else f"Conversation {conversation_id}"
        details.append(f"Selected conversation: {title}")
        filename_parts.append(f"conversation-{conversation_id}")
    if q and q.strip():
        details.append(f"Search term: {q.strip()}")
        filename_parts.append("search-results")
    if start_date or end_date:
        range_text = f"{start_date or 'start'} to {end_date or 'today'}"
        details.append(f"Date range: {range_text}")
        filename_parts.append("date-range")
    if contact_id is not None:
        row = conn.execute("SELECT display_name, handle FROM contacts WHERE id = ?", (contact_id,)).fetchone()
        contact = (row["display_name"] or row["handle"]) if row else f"Contact {contact_id}"
        details.append(f"Contact or person: {contact}")
        filename_parts.append(f"messages-with-{contact}")

    if not details:
        details.append("Full archive")
        filename_parts.append("full-archive")

    return {
        "label": "Message export",
        "details": details,
        "filename_label": "-".join(filename_parts),
    }


def build_export_title(scope: dict, style: str) -> str:
    if style == "transcript":
        return "Message Transcript"
    if style == "summary":
        return "Message Summary Report"
    if scope["filename_label"].startswith("conversation-"):
        return "Conversation Export"
    return "Message Archive Export"


def build_messages_pdf_filename(scope: dict) -> str:
    return f"{safe_filename_part(scope['filename_label'])}.pdf"


def normalize_pdf_style(style: str) -> str:
    normalized = (style or "conversation").strip().lower()
    return normalized if normalized in SUPPORTED_PDF_STYLES else "conversation"


def safe_filename_part(value: str) -> str:
    cleaned = re.sub(r"[^A-Za-z0-9._-]+", "-", value.strip()).strip("-._")
    return cleaned[:80] or "messages"


def format_count_lines(items: list[dict], label_key: str, count_key: str, count_label: str) -> list[str]:
    if not items:
        return ["None found."]
    return [f"{item[label_key]}: {item[count_key]} {count_label}" for item in items]


def format_month_lines(items: list[dict]) -> list[str]:
    if not items:
        return ["None found."]
    return [f"{item['month']}: {item['mentions']} mentions" for item in items]


def format_sender(row: dict) -> str:
    return row.get("sender_name") or row.get("sender_handle") or "Unknown sender"


def wrap_body(value: str, width: int) -> list[str]:
    paragraphs = str(value).splitlines() or [""]
    wrapped = []
    for paragraph in paragraphs:
        wrapped.extend(textwrap.wrap(paragraph, width=width) or [""])
    return wrapped


def format_export_datetime() -> str:
    return datetime.now(ZoneInfo("America/New_York")).strftime("%b %-d, %Y at %-I:%M %p")


def format_pdf_datetime(value: str | None) -> str:
    parsed = parse_datetime(value)
    if parsed is None:
        return value or "Unknown date"
    return parsed.astimezone(ZoneInfo("America/New_York")).strftime("%b %-d, %Y %-I:%M %p")


def format_pdf_date(value: str | None) -> str:
    parsed = parse_datetime(value)
    if parsed is None:
        return value or "No messages"
    return parsed.astimezone(ZoneInfo("America/New_York")).strftime("%b %-d, %Y")


def format_pdf_time(value: str | None) -> str:
    parsed = parse_datetime(value)
    if parsed is None:
        return value or ""
    return parsed.astimezone(ZoneInfo("America/New_York")).strftime("%-I:%M %p")


def parse_datetime(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        normalized = value.replace("Z", "+00:00")
        return datetime.fromisoformat(normalized)
    except ValueError:
        return None


class SimplePdfDocument:
    def __init__(self, title: str, lines: list[str]):
        self.title = title
        self.lines = lines

    def render(self) -> bytes:
        pages = self.paginate()
        objects: list[bytes] = []
        objects.append(b"<< /Type /Catalog /Pages 2 0 R >>")
        page_object_ids = [3 + index * 2 for index in range(len(pages))]
        kids = " ".join(f"{object_id} 0 R" for object_id in page_object_ids)
        objects.append(f"<< /Type /Pages /Kids [{kids}] /Count {len(pages)} >>".encode("latin-1"))

        for page_index, page_lines in enumerate(pages, start=1):
            page_object_id = 3 + (page_index - 1) * 2
            content_object_id = page_object_id + 1
            stream = self.build_page_stream(page_lines, page_index, len(pages))
            objects.append(
                (
                    f"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] "
                    f"/Resources << /Font << /F1 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> "
                    f"/F2 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >> >> >> "
                    f"/Contents {content_object_id} 0 R >>"
                ).encode("latin-1")
            )
            objects.append(b"<< /Length " + str(len(stream)).encode("latin-1") + b" >>\nstream\n" + stream + b"\nendstream")

        return self.build_pdf(objects)

    def paginate(self) -> list[list[str]]:
        lines_per_page = 46
        pages = [self.lines[index:index + lines_per_page] for index in range(0, len(self.lines), lines_per_page)]
        return pages or [["No messages matched this export."]]

    def build_page_stream(self, lines: list[str], page_number: int, page_count: int) -> bytes:
        commands = ["BT", "/F1 10 Tf", "14 TL", "50 742 Td"]
        first_line = True
        for raw_line in lines:
            line = raw_line[:130]
            if not first_line:
                commands.append("T*")
            font = "/F2 14 Tf" if raw_line == self.title else "/F1 10 Tf"
            commands.append(font)
            commands.append(f"({escape_pdf_text(line)}) Tj")
            first_line = False
        commands.extend([
            "ET",
            "BT",
            "/F1 9 Tf",
            f"50 36 Td ({escape_pdf_text(f'Page {page_number} of {page_count}')}) Tj",
            "ET",
        ])
        return "\n".join(commands).encode("latin-1", errors="replace")

    def build_pdf(self, objects: list[bytes]) -> bytes:
        output = bytearray(b"%PDF-1.4\n%\xe2\xe3\xcf\xd3\n")
        offsets = [0]
        for index, obj in enumerate(objects, start=1):
            offsets.append(len(output))
            output.extend(f"{index} 0 obj\n".encode("latin-1"))
            output.extend(obj)
            output.extend(b"\nendobj\n")
        xref_offset = len(output)
        output.extend(f"xref\n0 {len(objects) + 1}\n".encode("latin-1"))
        output.extend(b"0000000000 65535 f \n")
        for offset in offsets[1:]:
            output.extend(f"{offset:010d} 00000 n \n".encode("latin-1"))
        output.extend(
            (
                f"trailer\n<< /Size {len(objects) + 1} /Root 1 0 R >>\n"
                f"startxref\n{xref_offset}\n%%EOF\n"
            ).encode("latin-1")
        )
        return bytes(output)


def escape_pdf_text(value: str) -> str:
    return str(value).replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")
