import json
import re
import sys
from datetime import datetime

import pdfplumber


def to_iso(month: int, day: int, year: int) -> str:
    return f"{year:04d}-{month:02d}-{day:02d}"


def extract_report_date(text: str):
    numeric = re.search(r"Report Date:\s*(\d{1,2})/(\d{1,2})/(\d{4})", text, re.IGNORECASE)
    if numeric:
        month, day, year = map(int, numeric.groups())
        return to_iso(month, day, year)

    long_form = re.search(
        r"Report Date:\s*([A-Za-z]+)\s+(\d{1,2}),\s*(\d{4})",
        text,
        re.IGNORECASE
    )
    if long_form:
        month_name, day, year = long_form.groups()
        parsed = datetime.strptime(f"{month_name} {day} {year}", "%B %d %Y")
        return parsed.strftime("%Y-%m-%d")

    return None


def main():
    if len(sys.argv) < 2:
        print(json.dumps({"error": "missing pdf path"}))
        sys.exit(1)

    pdf_path = sys.argv[1]

    with pdfplumber.open(pdf_path) as pdf:
        first_page = pdf.pages[0]
        text = first_page.extract_text() or ""

    report_date = extract_report_date(text)
    print(json.dumps({
        "reportDate": report_date,
        "textSample": text[:200]
    }))


if __name__ == "__main__":
    main()
