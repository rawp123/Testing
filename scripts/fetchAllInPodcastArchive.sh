#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RAW_DIR="$ROOT_DIR/scripts/podcasts/all-in/raw/archive"
FEED_URL="https://rss.libsyn.com/shows/254861/destinations/1928300.xml"
OUTPUT_PATH="$RAW_DIR/feed.xml"
USER_AGENT="Mozilla/5.0"

mkdir -p "$RAW_DIR"
curl -s -A "$USER_AGENT" "$FEED_URL" > "$OUTPUT_PATH"

ITEM_COUNT="$(grep -c '<item>' "$OUTPUT_PATH" || true)"
echo "Fetched All-In archive feed to $OUTPUT_PATH ($ITEM_COUNT items)."
