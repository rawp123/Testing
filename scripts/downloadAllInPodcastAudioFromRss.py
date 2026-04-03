#!/usr/bin/env python3

from __future__ import annotations

import argparse
from email.utils import parsedate_to_datetime
import hashlib
import json
import re
import sys
import time
import xml.etree.ElementTree as ET
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

import requests

from allInPodcastUtils import derive_episode_identity, normalize_whitespace


DEFAULT_FEED_URL = "https://allinchamathjason.libsyn.com/rss"
DEFAULT_TIMEOUT_SECONDS = 60
DEFAULT_RETRIES = 3
USER_AGENT = "Mozilla/5.0"

def make_safe_filename(value: str, max_length: int = 120) -> str:
    normalized = normalize_whitespace(value).lower()
    slug = re.sub(r"[^a-z0-9]+", "-", normalized).strip("-")
    if not slug:
        return "episode"
    return slug[:max_length].rstrip("-")


def get_file_extension(audio_url: str) -> str:
    parsed = urlparse(audio_url)
    suffix = Path(parsed.path).suffix.lower()
    return suffix if suffix else ".mp3"


def normalize_publication_date(value: str) -> str:
    normalized = normalize_whitespace(value)
    if not normalized:
        return ""

    try:
        return parsedate_to_datetime(normalized).date().isoformat()
    except Exception:  # noqa: BLE001 - retain original value if parsing fails
        return normalized[:10]


def build_filename(
    title: str,
    publication_date: str,
    guid: str,
    audio_url: str,
) -> str:
    date_prefix = normalize_publication_date(publication_date) or "unknown-date"
    title_slug = make_safe_filename(title)
    guid_hash = hashlib.sha1(guid.encode("utf-8")).hexdigest()[:10]
    extension = get_file_extension(audio_url)
    return f"{date_prefix}-{title_slug}-{guid_hash}{extension}"


def request_with_retries(
    session: requests.Session,
    method: str,
    url: str,
    *,
    retries: int,
    timeout_seconds: int,
    stream: bool = False,
) -> requests.Response:
    last_error: Exception | None = None

    for attempt in range(1, retries + 1):
        try:
            response = session.request(
                method,
                url,
                timeout=timeout_seconds,
                stream=stream,
            )
            response.raise_for_status()
            return response
        except Exception as error:  # noqa: BLE001 - surface final network failure
            last_error = error
            if attempt == retries:
                break
            time.sleep(min(2 ** (attempt - 1), 5))

    raise RuntimeError(f"Request failed for {url}: {last_error}") from last_error


def fetch_feed_xml(
    session: requests.Session,
    *,
    feed_url: str,
    feed_file: Path | None,
    retries: int,
    timeout_seconds: int,
) -> str:
    if feed_file:
        return feed_file.read_text(encoding="utf-8")

    response = request_with_retries(
        session,
        "GET",
        feed_url,
        retries=retries,
        timeout_seconds=timeout_seconds,
    )
    return response.text


def extract_episode_fields(item: ET.Element) -> dict[str, Any]:
    title = normalize_whitespace(item.findtext("title", default=""))
    publication_date = normalize_whitespace(item.findtext("pubDate", default=""))
    guid = normalize_whitespace(item.findtext("guid", default=""))
    link = normalize_whitespace(item.findtext("link", default=""))

    enclosure = item.find("enclosure")
    audio_url = normalize_whitespace(enclosure.get("url", "") if enclosure is not None else "")

    if not guid:
        guid = audio_url or title

    identity = derive_episode_identity(title, link)

    return {
        **identity,
        "title": title,
        "publicationDate": publication_date,
        "publicationDateIso": normalize_publication_date(publication_date),
        "guid": guid,
        "link": link,
        "audioUrl": audio_url,
    }


def parse_rss_feed(feed_xml: str) -> list[dict[str, str]]:
    root = ET.fromstring(feed_xml)
    channel = root.find("channel")
    if channel is None:
        raise RuntimeError("RSS feed is missing a channel element.")

    episodes = []
    for item in channel.findall("item"):
        episode = extract_episode_fields(item)
        if not episode["audioUrl"]:
            continue
        episodes.append(episode)

    return episodes


def download_audio_file(
    session: requests.Session,
    episode: dict[str, str],
    destination_path: Path,
    *,
    retries: int,
    timeout_seconds: int,
) -> None:
    response = request_with_retries(
        session,
        "GET",
        episode["audioUrl"],
        retries=retries,
        timeout_seconds=timeout_seconds,
        stream=True,
    )

    try:
        with destination_path.open("wb") as handle:
            for chunk in response.iter_content(chunk_size=1024 * 1024):
                if chunk:
                    handle.write(chunk)
    except Exception:
        destination_path.unlink(missing_ok=True)
        raise
    finally:
        response.close()


def parse_arguments() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Download podcast audio files directly from an RSS feed."
    )
    parser.add_argument("--feed-url", default=DEFAULT_FEED_URL)
    parser.add_argument("--feed-file", type=Path, default=None)
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=Path("scripts/podcasts/all-in/raw/audio"),
    )
    parser.add_argument(
        "--metadata-path",
        type=Path,
        default=None,
        help="Path for the downloaded episode metadata JSON. Defaults to <output-dir>/metadata.json",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=None,
        help="Download only the first N episodes from the feed. The feed is processed in order, so this acts as a recent-episodes test mode. Omit to process the full archive.",
    )
    parser.add_argument("--retries", type=int, default=DEFAULT_RETRIES)
    parser.add_argument("--timeout-seconds", type=int, default=DEFAULT_TIMEOUT_SECONDS)
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Parse the feed and write metadata without downloading any audio files.",
    )
    parser.add_argument("--verbose", action="store_true")
    return parser.parse_args()


def main() -> int:
    args = parse_arguments()
    output_dir = args.output_dir.resolve()
    metadata_path = (
        args.metadata_path.resolve()
        if args.metadata_path is not None
        else output_dir / "metadata.json"
    )

    output_dir.mkdir(parents=True, exist_ok=True)
    metadata_path.parent.mkdir(parents=True, exist_ok=True)

    session = requests.Session()
    session.headers.update({"User-Agent": USER_AGENT})

    feed_xml = fetch_feed_xml(
        session,
        feed_url=args.feed_url,
        feed_file=args.feed_file.resolve() if args.feed_file else None,
        retries=max(args.retries, 1),
        timeout_seconds=max(args.timeout_seconds, 1),
    )
    episodes = parse_rss_feed(feed_xml)
    total_parsed_count = len(episodes)

    if args.limit and args.limit > 0:
        episodes = episodes[: args.limit]

    requested_limit = args.limit if args.limit and args.limit > 0 else None
    mode_label = "recent-test" if requested_limit is not None else "full-archive"

    print(
        f"Parsed {total_parsed_count} episodes from RSS feed. "
        f"Mode: {mode_label} ({len(episodes)} episode{'s' if len(episodes) != 1 else ''} selected)."
    )

    results: list[dict[str, Any]] = []

    for episode in episodes:
        filename = build_filename(
            episode["title"],
            episode["publicationDate"],
            episode["guid"],
            episode["audioUrl"],
        )
        destination_path = output_dir / filename

        episode_record: dict[str, Any] = {
            **episode,
            "filename": filename,
            "filePath": str(destination_path),
        }

        if destination_path.exists():
            episode_record["status"] = "skipped-existing"
            results.append(episode_record)
            if args.verbose:
                print(f"Skipping existing file: {filename}")
            continue

        if args.dry_run:
            episode_record["status"] = "dry-run"
            results.append(episode_record)
            if args.verbose:
                print(f"Dry run, not downloading: {filename}")
            continue

        try:
            download_audio_file(
                session,
                episode,
                destination_path,
                retries=max(args.retries, 1),
                timeout_seconds=max(args.timeout_seconds, 1),
            )
            episode_record["status"] = "downloaded"
            results.append(episode_record)
            print(f"Downloaded {filename}")
        except Exception as error:  # noqa: BLE001 - include failures in metadata output
            episode_record["status"] = "error"
            episode_record["error"] = normalize_whitespace(str(error))
            results.append(episode_record)
            print(f"Failed {filename}: {episode_record['error']}", file=sys.stderr)

    metadata_payload = {
        "generatedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "feedUrl": args.feed_url,
        "mode": mode_label,
        "requestedLimit": requested_limit,
        "dryRun": args.dry_run,
        "parsedEpisodeCount": total_parsed_count,
        "episodeCount": len(results),
        "downloadedCount": len([item for item in results if item["status"] == "downloaded"]),
        "skippedExistingCount": len(
            [item for item in results if item["status"] == "skipped-existing"]
        ),
        "dryRunCount": len([item for item in results if item["status"] == "dry-run"]),
        "errorCount": len([item for item in results if item["status"] == "error"]),
        "outputDirectory": str(output_dir),
        "episodes": results,
    }

    metadata_path.write_text(f"{json.dumps(metadata_payload, indent=2)}\n", encoding="utf-8")
    print(f"Saved metadata to {metadata_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
