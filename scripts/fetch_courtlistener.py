"""
fetch_courtlistener.py
──────────────────────
Fetches free docket-level metadata from the CourtListener public search API
(https://www.courtlistener.com/api/rest/v4/search/) for every MDL tracked
in this project.  No API key or account required.

Output: ../data/courtlistener.json

Run from the scripts/ directory:
    python fetch_courtlistener.py

Optional flags:
    --top N       Only enrich the top N MDLs by current pending count (default: all)
    --delay N     Seconds to sleep between API calls (default: 0.3)
    --force       Re-fetch even if courtlistener.json already exists
    --firms N     Max number of law firms to store per MDL (default: 5)
"""

import json
import re
import time
import argparse
from datetime import datetime, timezone
from pathlib import Path

try:
    import requests
except ImportError:
    raise SystemExit("requests is not installed.  Run: pip install requests")

SCRIPT_DIR = Path(__file__).parent
DATA_DIR   = SCRIPT_DIR.parent / "data"
MDL_DIR    = DATA_DIR / "mdl"
OUT_FILE   = DATA_DIR / "courtlistener.json"

CL_SEARCH  = "https://www.courtlistener.com/api/rest/v4/search/"
CL_SITE    = "https://www.courtlistener.com"
HEADERS    = {
    "User-Agent": "jpml-dashboard-enrichment/1.0 (educational, non-commercial)",
    "Accept": "application/json",
}


def latest_mdl_file():
    files = sorted(MDL_DIR.glob("????-??-??.json"))
    if not files:
        raise FileNotFoundError(f"No MDL data files in {MDL_DIR}")
    return files[-1]


def load_mdl_numbers(top):
    path = latest_mdl_file()
    print(f"Reading MDL data from: {path.name}")
    with open(path) as f:
        rows = json.load(f)
    seen = {}
    for r in rows:
        mdl = r.get("MDL", "").strip()
        if not mdl:
            continue
        pending = r.get("Pending") or 0
        if mdl not in seen or pending > seen[mdl]["pending"]:
            seen[mdl] = {"mdl": mdl, "title": r.get("Title", ""), "pending": pending}
    result = sorted(seen.values(), key=lambda x: x["pending"], reverse=True)
    return result[:top] if top else result


def mdl_num(mdl_str):
    m = re.search(r"\d+", mdl_str)
    return m.group() if m else mdl_str


def search_courtlistener(mdl_str, max_firms, delay):
    num = mdl_num(mdl_str)
    params = {
        "type":          "d",
        "court":         "jpml",
        "docket_number": f"MDL No. {num}",
        "order_by":      "score desc",
        "page_size":     5,
        "format":        "json",
    }
    try:
        resp = requests.get(CL_SEARCH, params=params, headers=HEADERS, timeout=15)
        resp.raise_for_status()
        results = resp.json().get("results", [])
        time.sleep(delay)
        hit = None
        for r in results:
            dn = (r.get("docketNumber") or "").replace(" ", "").lower()
            if num in dn:
                hit = r
                break
        if not hit and results:
            hit = results[0]
        if hit:
            return _parse_hit(mdl_str, hit, max_firms)
    except Exception as e:
        print(f"  WARNING  {mdl_str}: {e}")
    return None


def _parse_hit(mdl_str, hit, max_firms):
    abs_url = hit.get("docket_absolute_url", "")
    firms   = (hit.get("firm") or [])[:max_firms]
    seen_f  = set()
    unique_firms = []
    for f in firms:
        key = f.strip()
        if key and key not in seen_f:
            seen_f.add(key)
            unique_firms.append(key)
    return {
        "mdl":             mdl_str,
        "cl_case_name":    hit.get("caseName") or "",
        "cl_url":          f"{CL_SITE}{abs_url}" if abs_url else "",
        "docket_id":       hit.get("docket_id"),
        "judge":           hit.get("assignedTo") or "",
        "date_filed":      hit.get("dateFiled") or None,
        "date_terminated": hit.get("dateTerminated") or None,
        "status":          "Active" if not hit.get("dateTerminated") else "Terminated",
        "firms":           unique_firms,
        "indexed_at":      (hit.get("meta") or {}).get("timestamp", ""),
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--top",   type=int,   default=None)
    parser.add_argument("--delay", type=float, default=0.3)
    parser.add_argument("--force", action="store_true")
    parser.add_argument("--firms", type=int,   default=5)
    args = parser.parse_args()

    if OUT_FILE.exists() and not args.force:
        print(f"Output already exists: {OUT_FILE}\nUse --force to re-fetch.")
        return

    mdls = load_mdl_numbers(args.top)
    print(f"Querying CourtListener for {len(mdls)} MDLs (delay={args.delay}s)...\n")

    records   = []
    not_found = []

    for i, info in enumerate(mdls, 1):
        print(f"[{i:>3}/{len(mdls)}]  {info['mdl']}  ({info['pending']:,} pending)  ", end="", flush=True)
        hit = search_courtlistener(info["mdl"], args.firms, args.delay)
        if hit:
            hit["pending"] = info["pending"]
            records.append(hit)
            firms_str = ", ".join(hit["firms"][:2]) + ("..." if len(hit["firms"]) > 2 else "")
            print(f"OK  {hit['status']}  judge: {hit['judge'] or '-'}  firms: {firms_str or '-'}")
        else:
            not_found.append(info["mdl"])
            records.append({
                "mdl": info["mdl"], "cl_case_name": info["title"],
                "cl_url": "", "docket_id": None, "judge": "",
                "date_filed": None, "date_terminated": None,
                "status": "Unknown", "firms": [], "indexed_at": "",
                "pending": info["pending"],
            })
            print("not found")

    output = {
        "generated":   datetime.now(tz=timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "source_file": latest_mdl_file().name,
        "total":       len(records),
        "not_found":   not_found,
        "records":     records,
    }

    with open(OUT_FILE, "w") as f:
        json.dump(output, f, indent=2)

    found = len(records) - len(not_found)
    print(f"\nWrote {len(records)} records ({found} matched, {len(not_found)} not found) -> {OUT_FILE}")


if __name__ == "__main__":
    main()
