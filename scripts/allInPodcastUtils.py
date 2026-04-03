#!/usr/bin/env python3

from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any
from urllib.parse import urlparse


REPO_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_AUDIO_METADATA_PATH = (
    REPO_ROOT / "scripts" / "podcasts" / "all-in" / "raw" / "audio" / "metadata.json"
)


def normalize_whitespace(value: Any) -> str:
    return " ".join(str(value or "").split()).strip()


def slugify(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", normalize_whitespace(value).lower()).strip("-")


def extract_episode_number(title: str) -> int | None:
    patterns = [
        re.compile(r"\bEpisode\s*#\s*(\d+)\b", re.IGNORECASE),
        re.compile(r"\bE(\d+)\b", re.IGNORECASE),
    ]

    for pattern in patterns:
        match = pattern.search(str(title))
        if match:
            return int(match.group(1))

    return None


def derive_episode_identity(title: str, link: str) -> dict[str, Any]:
    normalized_title = normalize_whitespace(title)
    normalized_link = normalize_whitespace(link)
    parsed_link = urlparse(normalized_link) if normalized_link else None
    raw_slug = ""

    if parsed_link:
        raw_slug = (
            parsed_link.path.replace("/website/", "/", 1).strip("/").strip()
        )

    fallback_slug = slugify(normalized_title)
    slug = slugify(raw_slug or fallback_slug)
    episode_number = extract_episode_number(normalized_title)
    episode_id = f"all-in-e{episode_number}" if episode_number is not None else f"all-in-{slug}"

    return {
        "id": episode_id,
        "slug": slug,
        "episodeNumber": episode_number,
    }


def load_downloaded_audio_index(
    metadata_path: Path | None = None,
) -> tuple[dict[str, dict[str, Any]], Path]:
    resolved_path = (metadata_path or DEFAULT_AUDIO_METADATA_PATH).resolve()

    if not resolved_path.exists():
        return {}, resolved_path

    with resolved_path.open("r", encoding="utf-8") as handle:
        payload = json.load(handle)

    episodes = payload.get("episodes") or []
    by_episode_id: dict[str, dict[str, Any]] = {}

    for episode in episodes:
        episode_id = normalize_whitespace(episode.get("id", ""))
        file_path = normalize_whitespace(episode.get("filePath", ""))
        if not episode_id or not file_path:
            continue

        candidate_path = Path(file_path)
        if not candidate_path.is_absolute():
            candidate_path = (resolved_path.parent / candidate_path).resolve()

        if not candidate_path.exists():
            continue

        by_episode_id[episode_id] = {
            **episode,
            "resolvedFilePath": str(candidate_path),
        }

    return by_episode_id, resolved_path
