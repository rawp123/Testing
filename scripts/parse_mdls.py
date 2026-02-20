import sys
import pdfplumber
import json
import re
import os

def normalize_district(name):
    name = re.sub(r"[^A-Za-z0-9]", "", str(name))
    return name.upper()

def extract_lines(pdf_path):
    lines = []
    with pdfplumber.open(pdf_path) as pdf:
        for page in pdf.pages:
            text = page.extract_text()
            if text:
                lines.extend(text.splitlines())
    return lines

def parse_lines(lines):
    # District at start of line
    district_pat = re.compile(r"^([A-Z]{2,4})\b")
    # More robust MDL line: judge, MDL-xxxx, title, pending, total (allow spaces, dashes, commas)
    mdl_pat = re.compile(r"(.+?)MDL\s*[-–—]?\s*(\d+)\s+(.+?)\s+([\d,]+)\s+([\d,]+)$")
    data = []
    current_district = None
    for line in lines:
        line = line.rstrip()
        m = district_pat.match(line)
        if m:
            current_district = m.group(1)
            # Remove district from line for MDL parsing
            line = line[m.end():].lstrip()
        if not current_district:
            continue
        mdl_match = mdl_pat.match(line)
        if mdl_match:
            judge = mdl_match.group(1).strip()
            mdl_number = f"MDL-{mdl_match.group(2)}"
            title = mdl_match.group(3).strip()
            pending = int(mdl_match.group(4).replace(',', ''))
            total = int(mdl_match.group(5).replace(',', ''))
            data.append({
                "District": normalize_district(current_district),
                "Judge": judge,
                "MDL": mdl_number,
                "Title": title,
                "Pending": pending,
                "Total": total,
                "MDL Count": pending
            })
    return data

def update_pdfs_index(pdf_path):
    """Add the source PDF filename to data/pdfs/index.json if not already present."""
    out_dir = os.path.dirname(os.path.abspath(pdf_path))
    # data/pdfs/ lives alongside data/mdl/ — go up one level if we're in mdl/
    # But pdf_path is passed in directly, so use its directory
    index_path = os.path.join(out_dir, "index.json")
    fname = os.path.basename(pdf_path)
    if os.path.exists(index_path):
        with open(index_path) as f:
            files = json.load(f)
    else:
        files = []
    if fname not in files:
        files.append(fname)
        files.sort()
        with open(index_path, "w") as f:
            json.dump(files, f, indent=2)
        print(f"Updated {index_path}: added {fname}")


def update_index(out_path):
    """Add the output file's key (stem) to data/mdl/index.json if not already present."""
    # Derive index.json path relative to the output file's directory
    out_dir = os.path.dirname(os.path.abspath(out_path))
    index_path = os.path.join(out_dir, "index.json")
    key = os.path.splitext(os.path.basename(out_path))[0]  # e.g. "2026-03-03"

    if os.path.exists(index_path):
        with open(index_path, "r") as f:
            index = json.load(f)
    else:
        index = []

    if key not in index:
        index.append(key)
        index.sort()
        with open(index_path, "w") as f:
            json.dump(index, f, indent=2)
        print(f"Updated {index_path}: added '{key}' ({len(index)} total entries)")
    else:
        print(f"index.json already contains '{key}', no update needed")

def main():
    if len(sys.argv) < 3:
        print("Usage: python scripts/parse_mdls.py <input.pdf> <output.json>")
        sys.exit(1)
    pdf_path = sys.argv[1]
    out_path = sys.argv[2]
    lines = extract_lines(pdf_path)
    mdl_data = parse_lines(lines)
    with open(out_path, "w") as f:
        json.dump(mdl_data, f, indent=2)
    print(f"Wrote {len(mdl_data)} MDL records to {out_path}")
    update_index(out_path)
    update_pdfs_index(pdf_path)

if __name__ == "__main__":
    main()