from __future__ import annotations

from collections import Counter, defaultdict
from dataclasses import dataclass
from datetime import datetime
from io import BytesIO
import re
import sqlite3
from xml.sax.saxutils import escape
from zipfile import ZIP_DEFLATED, ZipFile
from zoneinfo import ZoneInfo

from server.services.export_pdf import (
    ATTACHMENT_NOTE,
    PRIVACY_NOTE,
    build_scope_description,
    fetch_export_messages,
    format_sender,
    parse_datetime,
    safe_filename_part,
)
from server.services.search import build_search_summary, count_keyword_occurrences

EXCEL_MEDIA_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
MAX_CELL_LENGTH = 32767
INVALID_XML_CHARACTERS = re.compile(r"[\x00-\x08\x0B\x0C\x0E-\x1F]")


@dataclass
class XlsxExport:
    content: bytes
    filename: str


@dataclass
class Worksheet:
    name: str
    rows: list[list[object]]
    widths: list[float]


def export_messages_xlsx(
    conn: sqlite3.Connection,
    *,
    conversation_id: int | None = None,
    q: str | None = None,
    start_date: str | None = None,
    end_date: str | None = None,
    contact_id: int | None = None,
    summary_only: bool = False,
) -> XlsxExport:
    message_rows = fetch_export_messages(
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
    sheets = build_workbook_sheets(
        conn,
        message_rows,
        scope=scope,
        q=q,
        start_date=start_date,
        end_date=end_date,
        summary_only=summary_only,
    )
    filename = "search-summary.xlsx" if summary_only else f"{safe_filename_part(scope['filename_label'])}.xlsx"
    return XlsxExport(content=SimpleXlsxWorkbook(sheets).render(), filename=filename)


def export_search_summary_xlsx(conn: sqlite3.Connection, *, q: str) -> XlsxExport:
    return export_messages_xlsx(conn, q=q, summary_only=True)


def build_workbook_sheets(
    conn: sqlite3.Connection,
    rows: list[dict],
    *,
    scope: dict,
    q: str | None,
    start_date: str | None,
    end_date: str | None,
    summary_only: bool,
) -> list[Worksheet]:
    export_time = format_export_datetime()
    search_term = q.strip() if q and q.strip() else ""
    summary = build_search_summary(conn, search_term) if search_term else None
    message_rows = [] if summary_only else rows

    return [
        build_messages_sheet(message_rows, include_empty_notice=not summary_only),
        build_conversations_sheet(rows, summary=summary),
        build_contacts_sheet(rows),
        build_search_stats_sheet(summary, search_term=search_term),
        build_speaker_counts_sheet(rows, search_term=search_term, summary=summary),
        build_monthly_counts_sheet(rows, search_term=search_term, summary=summary),
        build_export_notes_sheet(
            rows,
            scope=scope,
            export_time=export_time,
            search_term=search_term,
            start_date=start_date,
            end_date=end_date,
            summary_only=summary_only,
        ),
        build_filters_sheet(
            scope=scope,
            search_term=search_term,
            start_date=start_date,
            end_date=end_date,
            summary_only=summary_only,
        ),
    ]


def build_messages_sheet(rows: list[dict], *, include_empty_notice: bool) -> Worksheet:
    sheet_rows = [[
        "Date/Time",
        "Sender",
        "Conversation",
        "Message",
        "Direction",
        "Attachment Indicator",
        "Source Handle",
        "Message ID",
    ]]
    for row in rows:
        sheet_rows.append([
            format_cell_datetime(row.get("sent_at")),
            format_sender(row),
            row.get("conversation_title") or "Untitled conversation",
            row.get("body") or "No text body",
            format_direction(row.get("direction")),
            "Yes" if int(row.get("attachment_count") or 0) > 0 else "No",
            row.get("sender_handle") or "",
            row.get("id") or "",
        ])
    if not rows and include_empty_notice:
        sheet_rows.append(["", "", "", "No messages matched this export.", "", "", "", ""])
    return Worksheet("Messages", sheet_rows, [20, 24, 28, 64, 14, 22, 24, 12])


def build_conversations_sheet(rows: list[dict], *, summary: dict | None) -> Worksheet:
    sheet_rows = [["Conversation", "Messages Included", "First Message", "Most Recent Message", "People"]]
    grouped: dict[int, list[dict]] = defaultdict(list)
    for row in rows:
        grouped[row["conversation_id"]].append(row)

    for conversation_rows in sorted(grouped.values(), key=lambda items: (items[0].get("conversation_title") or "").casefold()):
        people = sorted({format_sender(row) for row in conversation_rows}, key=str.casefold)
        sheet_rows.append([
            conversation_rows[0].get("conversation_title") or "Untitled conversation",
            len(conversation_rows),
            format_cell_datetime(conversation_rows[0].get("sent_at")),
            format_cell_datetime(conversation_rows[-1].get("sent_at")),
            ", ".join(people),
        ])

    if summary and not grouped:
        for item in summary["conversations"]:
            sheet_rows.append([item["title"], item["matching_messages"], "", "", ""])

    return Worksheet("Conversations", sheet_rows, [30, 18, 20, 20, 42])


def build_contacts_sheet(rows: list[dict]) -> Worksheet:
    sheet_rows = [["Person", "Source Handle", "Messages Included", "First Message", "Most Recent Message"]]
    grouped: dict[str, list[dict]] = defaultdict(list)
    for row in rows:
        grouped[format_sender(row)].append(row)

    for person, person_rows in sorted(grouped.items(), key=lambda item: item[0].casefold()):
        handles = sorted({row.get("sender_handle") or "" for row in person_rows if row.get("sender_handle")})
        sheet_rows.append([
            person,
            ", ".join(handles),
            len(person_rows),
            format_cell_datetime(person_rows[0].get("sent_at")),
            format_cell_datetime(person_rows[-1].get("sent_at")),
        ])
    return Worksheet("Contacts", sheet_rows, [28, 28, 18, 20, 20])


def build_search_stats_sheet(summary: dict | None, *, search_term: str) -> Worksheet:
    sheet_rows = [["Item", "Value"]]
    if summary:
        sheet_rows.extend([
            ["Search term used", search_term],
            ["Total matching messages", summary["total_matching_messages"]],
            ["Total keyword occurrences", summary["total_keyword_occurrences"]],
            ["First mention", format_cell_datetime(summary["first_mention_at"])],
            ["Most recent mention", format_cell_datetime(summary["most_recent_mention_at"])],
        ])
    else:
        sheet_rows.append(["Search term used", "No search term used"])
    return Worksheet("Search Stats", sheet_rows, [28, 32])


def build_speaker_counts_sheet(rows: list[dict], *, search_term: str, summary: dict | None) -> Worksheet:
    sheet_rows = [["Sender/Person", "Matching Message Count", "Keyword Occurrence Count"]]
    message_counts = Counter(format_sender(row) for row in rows)
    occurrence_counts = Counter()
    if search_term:
        for row in rows:
            occurrences = count_keyword_occurrences(row.get("body"), search_term)
            if occurrences:
                occurrence_counts[format_sender(row)] += occurrences

    if summary and not message_counts:
        for item in summary["people"]:
            sheet_rows.append([item["name"], "", item["mentions"]])
    else:
        for person, count in sorted(message_counts.items(), key=lambda item: (-item[1], item[0].casefold())):
            sheet_rows.append([person, count, occurrence_counts[person] if search_term else ""])
    return Worksheet("Speaker Counts", sheet_rows, [30, 24, 26])


def build_monthly_counts_sheet(rows: list[dict], *, search_term: str, summary: dict | None) -> Worksheet:
    sheet_rows = [["Month/Year", "Message Count", "Keyword Occurrence Count"]]
    message_counts = Counter(format_month_key(row.get("sent_at")) for row in rows)
    occurrence_counts = Counter()
    if search_term:
        for row in rows:
            month = format_month_key(row.get("sent_at"))
            occurrences = count_keyword_occurrences(row.get("body"), search_term)
            if month and occurrences:
                occurrence_counts[month] += occurrences

    if summary and not message_counts:
        for item in summary["mentions_by_month"]:
            sheet_rows.append([format_month_label(item["month"]), "", item["mentions"]])
    else:
        for month, count in sorted((item for item in message_counts.items() if item[0]), key=lambda item: item[0]):
            sheet_rows.append([format_month_label(month), count, occurrence_counts[month] if search_term else ""])
    return Worksheet("Monthly Counts", sheet_rows, [18, 18, 26])


def build_export_notes_sheet(
    rows: list[dict],
    *,
    scope: dict,
    export_time: str,
    search_term: str,
    start_date: str | None,
    end_date: str | None,
    summary_only: bool,
) -> Worksheet:
    selected_filters = build_filter_summary(scope, search_term=search_term, start_date=start_date, end_date=end_date)
    sheet_rows = [
        ["Item", "Details"],
        ["What was exported", "Summary report only" if summary_only else "Message archive workbook"],
        ["When it was exported", export_time],
        ["Export scope", scope["label"]],
        ["Selected filters", selected_filters],
        ["Message count", len(rows)],
        ["Privacy note", PRIVACY_NOTE],
        ["Attachment limitation", ATTACHMENT_NOTE],
    ]
    return Worksheet("Export Notes", sheet_rows, [28, 64])


def build_filters_sheet(
    *,
    scope: dict,
    search_term: str,
    start_date: str | None,
    end_date: str | None,
    summary_only: bool,
) -> Worksheet:
    sheet_rows = [
        ["Field", "Selected Value"],
        ["Export type", "Summary report only" if summary_only else "Full analysis workbook"],
        ["Format", "Excel workbook"],
        ["Selected conversation", find_detail(scope, "Selected conversation")],
        ["Search term", search_term or "None"],
        ["Start date", start_date or "None"],
        ["End date", end_date or "None"],
        ["Limitations", ATTACHMENT_NOTE],
    ]
    return Worksheet("Filters Criteria", sheet_rows, [28, 52])


def build_filter_summary(scope: dict, *, search_term: str, start_date: str | None, end_date: str | None) -> str:
    details = list(scope["details"])
    if search_term and not any(detail.startswith("Search term:") for detail in details):
        details.append(f"Search term: {search_term}")
    if (start_date or end_date) and not any(detail.startswith("Date range:") for detail in details):
        details.append(f"Date range: {start_date or 'start'} to {end_date or 'today'}")
    return "; ".join(details) if details else "Full archive"


def find_detail(scope: dict, prefix: str) -> str:
    for detail in scope["details"]:
        if detail.startswith(f"{prefix}:"):
            return detail.split(":", 1)[1].strip()
    return "None"


def format_direction(value: str | None) -> str:
    if value == "incoming":
        return "Incoming"
    if value == "outgoing":
        return "Outgoing"
    return value or ""


def format_export_datetime() -> str:
    return datetime.now(ZoneInfo("America/New_York")).strftime("%b %-d, %Y at %-I:%M %p")


def format_cell_datetime(value: str | None) -> str:
    parsed = parse_datetime(value)
    if parsed is None:
        return value or ""
    return parsed.astimezone(ZoneInfo("America/New_York")).strftime("%b %-d, %Y %-I:%M %p")


def format_month_label(value: str | None) -> str:
    if not value:
        return ""
    month_key = value[:7]
    try:
        parsed = datetime.strptime(month_key, "%Y-%m")
    except ValueError:
        return month_key
    return parsed.strftime("%B %Y")


def format_month_key(value: str | None) -> str:
    if not value or len(value) < 7:
        return ""
    return value[:7]


class SimpleXlsxWorkbook:
    def __init__(self, sheets: list[Worksheet]):
        self.sheets = sheets

    def render(self) -> bytes:
        output = BytesIO()
        with ZipFile(output, "w", ZIP_DEFLATED) as archive:
            archive.writestr("[Content_Types].xml", self.content_types_xml())
            archive.writestr("_rels/.rels", ROOT_RELS_XML)
            archive.writestr("docProps/core.xml", CORE_XML)
            archive.writestr("docProps/app.xml", self.app_xml())
            archive.writestr("xl/workbook.xml", self.workbook_xml())
            archive.writestr("xl/_rels/workbook.xml.rels", self.workbook_rels_xml())
            archive.writestr("xl/styles.xml", STYLES_XML)
            for index, sheet in enumerate(self.sheets, start=1):
                archive.writestr(f"xl/worksheets/sheet{index}.xml", self.sheet_xml(sheet))
        return output.getvalue()

    def content_types_xml(self) -> str:
        sheet_overrides = "".join(
            f'<Override PartName="/xl/worksheets/sheet{index}.xml" '
            'ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'
            for index, _sheet in enumerate(self.sheets, start=1)
        )
        return (
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
            '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
            '<Default Extension="xml" ContentType="application/xml"/>'
            '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
            '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'
            '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>'
            '<Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>'
            f"{sheet_overrides}</Types>"
        )

    def app_xml(self) -> str:
        titles = "".join(f"<vt:lpstr>{escape_xml(sheet.name)}</vt:lpstr>" for sheet in self.sheets)
        return (
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            '<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" '
            'xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">'
            "<Application>Message Archive Utility</Application>"
            f"<HeadingPairs><vt:vector size=\"2\" baseType=\"variant\"><vt:variant><vt:lpstr>Worksheets</vt:lpstr></vt:variant><vt:variant><vt:i4>{len(self.sheets)}</vt:i4></vt:variant></vt:vector></HeadingPairs>"
            f"<TitlesOfParts><vt:vector size=\"{len(self.sheets)}\" baseType=\"lpstr\">{titles}</vt:vector></TitlesOfParts>"
            "</Properties>"
        )

    def workbook_xml(self) -> str:
        sheets_xml = "".join(
            f'<sheet name="{escape_attribute(sheet.name)}" sheetId="{index}" r:id="rId{index}"/>'
            for index, sheet in enumerate(self.sheets, start=1)
        )
        return (
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" '
            'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
            f"<sheets>{sheets_xml}</sheets></workbook>"
        )

    def workbook_rels_xml(self) -> str:
        relationships = "".join(
            f'<Relationship Id="rId{index}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet{index}.xml"/>'
            for index, _sheet in enumerate(self.sheets, start=1)
        )
        styles_id = len(self.sheets) + 1
        return (
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
            f"{relationships}"
            f'<Relationship Id="rId{styles_id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>'
            "</Relationships>"
        )

    def sheet_xml(self, sheet: Worksheet) -> str:
        row_count = max(1, len(sheet.rows))
        col_count = max(1, max((len(row) for row in sheet.rows), default=1))
        refs = f"A1:{column_name(col_count)}{row_count}"
        cols = "".join(
            f'<col min="{index}" max="{index}" width="{width}" customWidth="1"/>'
            for index, width in enumerate(sheet.widths, start=1)
        )
        rows_xml = "".join(self.row_xml(row, row_index) for row_index, row in enumerate(sheet.rows, start=1))
        return (
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" '
            'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
            '<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>'
            f"<cols>{cols}</cols>"
            f'<sheetData>{rows_xml}</sheetData>'
            f'<autoFilter ref="{refs}"/>'
            "</worksheet>"
        )

    def row_xml(self, row: list[object], row_index: int) -> str:
        cells = "".join(self.cell_xml(value, row_index, col_index, row_index == 1) for col_index, value in enumerate(row, start=1))
        return f'<row r="{row_index}">{cells}</row>'

    def cell_xml(self, value: object, row_index: int, col_index: int, is_header: bool) -> str:
        style = ' s="1"' if is_header else ""
        cell_ref = f"{column_name(col_index)}{row_index}"
        if isinstance(value, bool):
            return f'<c r="{cell_ref}" t="b"{style}><v>{1 if value else 0}</v></c>'
        if isinstance(value, (int, float)) and not isinstance(value, bool):
            return f'<c r="{cell_ref}"{style}><v>{value}</v></c>'
        text = normalize_cell_text(value)
        return f'<c r="{cell_ref}" t="inlineStr"{style}><is><t xml:space="preserve">{escape_xml(text)}</t></is></c>'


def normalize_cell_text(value: object) -> str:
    text = "" if value is None else str(value)
    text = INVALID_XML_CHARACTERS.sub("", text)
    if len(text) > MAX_CELL_LENGTH:
        return f"{text[:MAX_CELL_LENGTH - 3]}..."
    return text


def column_name(index: int) -> str:
    result = ""
    while index:
        index, remainder = divmod(index - 1, 26)
        result = chr(65 + remainder) + result
    return result or "A"


def escape_xml(value: str) -> str:
    return escape(value, {'"': "&quot;", "'": "&apos;"})


def escape_attribute(value: str) -> str:
    return escape_xml(normalize_cell_text(value))


ROOT_RELS_XML = (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>'
    '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>'
    '<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>'
    "</Relationships>"
)

CORE_XML = (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    '<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" '
    'xmlns:dc="http://purl.org/dc/elements/1.1/" '
    'xmlns:dcterms="http://purl.org/dc/terms/" '
    'xmlns:dcmitype="http://purl.org/dc/dcmitype/" '
    'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">'
    "<dc:title>Message Archive Export</dc:title>"
    "<dc:creator>Message Archive Utility</dc:creator>"
    "</cp:coreProperties>"
)

STYLES_XML = (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
    '<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>'
    '<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>'
    '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>'
    '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>'
    '<cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs>'
    '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>'
    "</styleSheet>"
)
