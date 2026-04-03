#!/usr/bin/env python3

from __future__ import annotations

import argparse
import json
import math
import os
import signal
import sys
import tempfile
import time
from pathlib import Path
from typing import Any

import requests

from allInPodcastUtils import load_downloaded_audio_index, normalize_whitespace

try:
    from faster_whisper import WhisperModel
except ImportError as exc:  # pragma: no cover - surfaced as CLI guidance
    raise SystemExit(
        "faster-whisper is required for offline ASR. Install requirements.txt or run the ASR wrapper."
    ) from exc


REPO_ROOT = Path(__file__).resolve().parent.parent
EPISODES_INDEX_PATH = REPO_ROOT / "data" / "all-in-podcast-search" / "episodes" / "index.json"
TRANSCRIPT_ROOT = REPO_ROOT / "scripts" / "podcasts" / "all-in" / "raw" / "transcripts"
DEFAULT_REPORTS_DIR = TRANSCRIPT_ROOT / "_reports"
DEFAULT_MODEL = os.environ.get("ALL_IN_ASR_MODEL", "small")
DEFAULT_LANGUAGE = os.environ.get("ALL_IN_ASR_LANGUAGE", "en")
DEFAULT_DEVICE = os.environ.get("ALL_IN_ASR_DEVICE", "cpu")
DEFAULT_COMPUTE_TYPE = os.environ.get("ALL_IN_ASR_COMPUTE_TYPE", "int8")
DEFAULT_BEAM_SIZE = int(os.environ.get("ALL_IN_ASR_BEAM_SIZE", "5"))
DEFAULT_DOWNLOAD_DIR = REPO_ROOT / ".cache" / "all-in-podcast-audio"
DEFAULT_MODEL_CACHE_DIR = REPO_ROOT / ".cache" / "all-in-whisper"
MAX_CHUNK_CHARACTERS = 320
MAX_GAP_SECONDS = 2.5

def to_timestamp(total_seconds: int) -> str:
    safe_seconds = max(int(total_seconds or 0), 0)
    hours = safe_seconds // 3600
    minutes = (safe_seconds % 3600) // 60
    seconds = safe_seconds % 60

    if hours > 0:
        return f"{hours:02d}:{minutes:02d}:{seconds:02d}"

    return f"{minutes:02d}:{seconds:02d}"


def load_json_if_exists(path: Path) -> dict[str, Any] | None:
    if not path.exists():
        return None

    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def parse_arguments() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Offline ASR fallback for All-In podcast episodes."
    )
    parser.add_argument("--episode", "--id", dest="episode_ids", action="append", default=[])
    parser.add_argument("--limit", type=int, default=None)
    parser.add_argument("--overwrite", action="store_true")
    parser.add_argument("--replace-outline", action="store_true")
    parser.add_argument("--missing-only", action="store_true")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--verbose", action="store_true")
    parser.add_argument("--model", default=DEFAULT_MODEL)
    parser.add_argument("--language", default=DEFAULT_LANGUAGE)
    parser.add_argument("--device", default=DEFAULT_DEVICE)
    parser.add_argument("--compute-type", default=DEFAULT_COMPUTE_TYPE)
    parser.add_argument("--beam-size", type=int, default=DEFAULT_BEAM_SIZE)
    parser.add_argument("--download-dir", default=str(DEFAULT_DOWNLOAD_DIR))
    parser.add_argument("--model-cache-dir", default=str(DEFAULT_MODEL_CACHE_DIR))
    parser.add_argument(
        "--report-path",
        type=Path,
        default=None,
        help="Optional JSON report path for the current ASR run. Defaults to scripts/podcasts/all-in/raw/transcripts/_reports/offline-asr-last-run.json",
    )
    parser.add_argument(
        "--audio-metadata-path",
        type=Path,
        default=None,
        help="Optional path to downloaded RSS audio metadata. Defaults to scripts/podcasts/all-in/raw/audio/metadata.json",
    )
    return parser.parse_args()


def should_target_episode(episode: dict[str, Any], args: argparse.Namespace) -> bool:
    episode_ids = set(args.episode_ids or [])

    if episode_ids:
        return episode.get("id") in episode_ids

    if args.missing_only:
        return not episode.get("transcriptAvailable")

    if args.replace_outline:
        return episode.get("transcriptSourceType") not in {
            "structured-json",
            "legacy-timestamped-text",
        }

    return not episode.get("transcriptAvailable")


def load_episodes(
    args: argparse.Namespace,
    downloaded_audio_index: dict[str, dict[str, Any]],
) -> list[dict[str, Any]]:
    with EPISODES_INDEX_PATH.open("r", encoding="utf-8") as handle:
        payload = json.load(handle)

    episodes = payload.get("episodes") or []
    filtered = [episode for episode in episodes if should_target_episode(episode, args)]
    explicit_episode_ids = set(args.episode_ids or [])
    local_audio_priority = {
        episode_id: position
        for position, episode_id in enumerate(downloaded_audio_index.keys())
    }

    if explicit_episode_ids:
        filtered.sort(key=lambda episode: (episode.get("publishDate") or "", episode.get("id") or ""))
    elif local_audio_priority:
        filtered.sort(
            key=lambda episode: (
                0 if episode.get("id", "") in local_audio_priority else 1,
                local_audio_priority.get(episode.get("id", ""), sys.maxsize),
                episode.get("publishDate") or "",
                episode.get("id") or "",
            )
        )
    else:
        filtered.sort(key=lambda episode: (episode.get("publishDate") or "", episode.get("id") or ""))

    if args.limit and args.limit > 0:
        return filtered[: args.limit]

    return filtered


def get_audio_source_label(
    episode: dict[str, Any],
    downloaded_audio_index: dict[str, dict[str, Any]],
) -> str:
    if episode.get("id", "") in downloaded_audio_index:
        return "local archive audio"

    return "remote audio fallback"


def resolve_report_path(report_path: Path | None) -> Path:
    if report_path is not None:
        return report_path.resolve()

    return (DEFAULT_REPORTS_DIR / "offline-asr-last-run.json").resolve()


def utc_now() -> str:
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())


def format_indexed_prefix(position: int, total: int) -> str:
    return f"[{position}/{total}]"


def build_episode_run_state(
    episode: dict[str, Any],
    *,
    position: int,
    total: int,
    downloaded_audio_index: dict[str, dict[str, Any]],
) -> dict[str, Any]:
    episode_id = normalize_whitespace(episode.get("id", ""))
    transcript_path = TRANSCRIPT_ROOT / episode_id / "transcript.json"
    metadata_path = TRANSCRIPT_ROOT / episode_id / "metadata.json"
    local_audio_available = episode_id in downloaded_audio_index
    return {
        "position": position,
        "total": total,
        "episodeId": episode_id,
        "title": normalize_whitespace(episode.get("title", "")),
        "publishDate": normalize_whitespace(episode.get("publishDate", "")),
        "durationLabel": normalize_whitespace(episode.get("durationLabel", "")),
        "transcriptSourceType": normalize_whitespace(episode.get("transcriptSourceType", "")),
        "status": "queued",
        "startedAt": None,
        "finishedAt": None,
        "reason": "",
        "chunkCount": None,
        "languageCode": "",
        "usedLocalAudio": False,
        "localAudioAvailable": local_audio_available,
        "audioSourcePreference": "local archive audio" if local_audio_available else "remote audio fallback",
        "transcriptPath": str(transcript_path),
        "metadataPath": str(metadata_path),
    }


def summarize_episode_states(episode_states: list[dict[str, Any]]) -> dict[str, int]:
    counts = {
        "queuedCount": 0,
        "startedCount": 0,
        "completedCount": 0,
        "skippedCount": 0,
        "failedCount": 0,
    }

    for episode_state in episode_states:
        status = episode_state.get("status")
        if status == "queued":
            counts["queuedCount"] += 1
        elif status == "started":
            counts["startedCount"] += 1
        elif status == "completed":
            counts["completedCount"] += 1
        elif status == "skipped":
            counts["skippedCount"] += 1
        elif status == "failed":
            counts["failedCount"] += 1

    return counts


def build_run_report(
    *,
    args: argparse.Namespace,
    episodes: list[dict[str, Any]],
    audio_metadata_path: Path,
    report_path: Path,
    episode_states: list[dict[str, Any]],
    run_status: str,
    started_at: str,
    current_episode_id: str = "",
    failure_reason: str = "",
) -> dict[str, Any]:
    counts = summarize_episode_states(episode_states)
    results = [
        episode_state
        for episode_state in episode_states
        if episode_state.get("status") in {"completed", "skipped", "failed"}
    ]

    return {
        "generatedAt": utc_now(),
        "mode": "offline-asr",
        "runStatus": run_status,
        "startedAt": started_at,
        "updatedAt": utc_now(),
        "finishedAt": utc_now() if run_status in {"completed", "failed", "interrupted"} else None,
        "currentEpisodeId": current_episode_id or "",
        "failureReason": failure_reason or "",
        "reportPath": str(report_path),
        "episodeCount": len(episodes),
        **counts,
        "args": {
            "episodeIds": list(args.episode_ids or []),
            "limit": args.limit,
            "overwrite": bool(args.overwrite),
            "replaceOutline": bool(args.replace_outline),
            "missingOnly": bool(args.missing_only),
            "dryRun": bool(args.dry_run),
            "model": args.model,
            "language": args.language,
            "device": args.device,
            "computeType": args.compute_type,
            "beamSize": args.beam_size,
            "downloadDir": str(Path(args.download_dir).resolve()),
            "modelCacheDir": str(Path(args.model_cache_dir).resolve()),
            "audioMetadataPath": str(audio_metadata_path),
        },
        "episodes": episode_states,
        "results": results,
    }


def write_run_report(report_path: Path, payload: dict[str, Any]) -> None:
    report_path.parent.mkdir(parents=True, exist_ok=True)
    temp_path = report_path.with_suffix(f"{report_path.suffix}.tmp")
    temp_path.write_text(f"{json.dumps(payload, indent=2)}\n", encoding="utf-8")
    temp_path.replace(report_path)


def update_episode_run_state(
    episode_state_map: dict[str, dict[str, Any]],
    episode_id: str,
    **updates: Any,
) -> None:
    episode_state = episode_state_map.get(episode_id)
    if not episode_state:
        return

    episode_state.update(updates)


def download_audio(audio_url: str, download_directory: Path, episode_id: str) -> Path:
    download_directory.mkdir(parents=True, exist_ok=True)
    suffix = Path(audio_url.split("?")[0]).suffix or ".mp3"

    with tempfile.NamedTemporaryFile(
        prefix=f"{episode_id}-",
        suffix=suffix,
        dir=download_directory,
        delete=False,
    ) as temp_file:
        temp_path = Path(temp_file.name)

    response = requests.get(audio_url, stream=True, timeout=(30, 300))
    response.raise_for_status()

    with temp_path.open("wb") as handle:
        for chunk in response.iter_content(chunk_size=1024 * 1024):
            if chunk:
                handle.write(chunk)

    return temp_path


def resolve_audio_input(
    episode: dict[str, Any],
    downloaded_audio_index: dict[str, dict[str, Any]],
    download_directory: Path,
) -> tuple[Path | None, bool]:
    downloaded_audio = downloaded_audio_index.get(episode.get("id", ""))
    if downloaded_audio:
        return Path(downloaded_audio["resolvedFilePath"]), False

    audio_url = normalize_whitespace(episode.get("audioUrl", ""))
    if not audio_url:
        return None, False

    return download_audio(audio_url, download_directory, episode.get("id", "")), True


def build_chunks_from_segments(raw_segments: list[dict[str, Any]]) -> list[dict[str, Any]]:
    chunks: list[dict[str, Any]] = []
    current: dict[str, Any] | None = None
    last_chunk_end_seconds = 0

    def flush_current() -> None:
        nonlocal current, last_chunk_end_seconds

        if not current or not current.get("text"):
            current = None
            return

        start_seconds = max(int(math.floor(current["start"])), last_chunk_end_seconds, 0)
        end_seconds = max(int(math.ceil(current["end"])), start_seconds)
        text = normalize_whitespace(current["text"])

        if not text:
            current = None
            return

        chunks.append(
            {
                "startSeconds": start_seconds,
                "endSeconds": end_seconds,
                "startTimestamp": to_timestamp(start_seconds),
                "endTimestamp": to_timestamp(end_seconds),
                "text": text,
            }
        )
        last_chunk_end_seconds = end_seconds
        current = None

    for segment in raw_segments:
        text = normalize_whitespace(segment.get("text", ""))
        if not text:
            continue

        start_seconds = max(float(segment.get("start", 0) or 0), 0.0)
        end_seconds = max(float(segment.get("end", start_seconds) or start_seconds), start_seconds)

        if current is None:
            current = {
                "start": start_seconds,
                "end": end_seconds,
                "text": text,
            }
            continue

        gap = start_seconds - float(current["end"])
        merged_text = normalize_whitespace(f"{current['text']} {text}")
        should_flush = (
            gap > MAX_GAP_SECONDS
            or len(merged_text) > MAX_CHUNK_CHARACTERS
            or current["text"].endswith((".", "!", "?"))
        )

        if should_flush:
            flush_current()
            current = {
                "start": start_seconds,
                "end": end_seconds,
                "text": text,
            }
            continue

        current["text"] = merged_text
        current["end"] = max(float(current["end"]), end_seconds)

    flush_current()
    return chunks


def build_metadata_payload(
    episode: dict[str, Any], existing_metadata: dict[str, Any] | None
) -> dict[str, Any]:
    existing_metadata = existing_metadata or {}
    return {
        **existing_metadata,
        "id": normalize_whitespace(existing_metadata.get("id") or episode.get("id", "")),
        "title": normalize_whitespace(existing_metadata.get("title") or episode.get("title", "")),
        "publishDate": normalize_whitespace(
            existing_metadata.get("publishDate") or episode.get("publishDate", "")
        ),
        "description": normalize_whitespace(
            existing_metadata.get("description") or episode.get("description", "")
        ),
        "summary": normalize_whitespace(existing_metadata.get("summary") or episode.get("summary", "")),
        "durationSeconds": existing_metadata.get("durationSeconds", episode.get("durationSeconds")),
        "durationLabel": normalize_whitespace(
            existing_metadata.get("durationLabel") or episode.get("durationLabel", "")
        ),
        "guests": existing_metadata.get("guests")
        if existing_metadata.get("guests")
        else episode.get("guests", []),
        "topicTags": existing_metadata.get("topicTags")
        if existing_metadata.get("topicTags")
        else episode.get("topicTags", []),
        "youtubeId": normalize_whitespace(existing_metadata.get("youtubeId") or episode.get("youtubeId", "")),
        "officialPageUrl": normalize_whitespace(
            existing_metadata.get("officialPageUrl") or episode.get("officialPageUrl", "")
        ),
        "fullEpisodeUrl": normalize_whitespace(
            existing_metadata.get("fullEpisodeUrl") or episode.get("fullEpisodeUrl", "")
        ),
        "audioUrl": normalize_whitespace(existing_metadata.get("audioUrl") or episode.get("audioUrl", "")),
        "imageUrl": normalize_whitespace(existing_metadata.get("imageUrl") or episode.get("imageUrl", "")),
    }


def transcribe_episode(
    episode: dict[str, Any],
    model: WhisperModel,
    args: argparse.Namespace,
    downloaded_audio_index: dict[str, dict[str, Any]],
) -> dict[str, Any]:
    episode_id = episode.get("id", "")
    transcript_directory = TRANSCRIPT_ROOT / episode_id
    transcript_path = transcript_directory / "transcript.json"
    metadata_path = transcript_directory / "metadata.json"
    local_audio_record = downloaded_audio_index.get(episode_id)

    if transcript_path.exists() and not args.overwrite:
        return {
            "status": "skipped",
            "episodeId": episode_id,
            "reason": "Transcript override already exists.",
            "transcriptPath": str(transcript_path),
        }

    audio_path: Path | None = None
    should_delete_audio = False

    try:
        audio_path, should_delete_audio = resolve_audio_input(
            episode,
            downloaded_audio_index,
            Path(args.download_dir),
        )
    except Exception as error:  # noqa: BLE001
        return {
            "status": "failed",
            "episodeId": episode_id,
            "reason": normalize_whitespace(str(error)),
        }

    if audio_path is None:
        return {
            "status": "skipped",
            "episodeId": episode_id,
            "reason": "Episode has no local audio file and no audioUrl for offline ASR.",
        }

    try:
        segments_iterator, info = model.transcribe(
            str(audio_path),
            language=args.language or None,
            beam_size=args.beam_size,
            vad_filter=True,
        )
        segments = [
            {
                "start": segment.start,
                "end": segment.end,
                "text": segment.text,
            }
            for segment in segments_iterator
        ]
        chunks = build_chunks_from_segments(segments)

        if not chunks:
            return {
                "status": "failed",
                "episodeId": episode_id,
                "reason": "Offline ASR returned no usable transcript chunks.",
            }

        existing_metadata = load_json_if_exists(metadata_path)
        metadata_payload = build_metadata_payload(episode, existing_metadata)
        transcript_payload = {
            "schemaVersion": 1,
            "episodeId": episode_id,
            "source": f"Offline ASR (faster-whisper {args.model})",
            "languageCode": getattr(info, "language", None) or args.language or "en",
            "chunks": chunks,
        }

        if not args.dry_run:
            transcript_directory.mkdir(parents=True, exist_ok=True)
            with metadata_path.open("w", encoding="utf-8") as handle:
                json.dump(metadata_payload, handle, indent=2)
                handle.write("\n")
            with transcript_path.open("w", encoding="utf-8") as handle:
                json.dump(transcript_payload, handle, indent=2)
                handle.write("\n")

        return {
            "status": "written",
            "episodeId": episode_id,
            "chunkCount": len(chunks),
            "languageCode": transcript_payload["languageCode"],
            "transcriptPath": str(transcript_path),
            "usedLocalAudio": bool(local_audio_record),
            "audioPath": str(audio_path),
        }
    except Exception as error:  # noqa: BLE001 - surface the upstream ASR error
        return {
            "status": "failed",
            "episodeId": episode_id,
            "reason": normalize_whitespace(str(error)),
        }
    finally:
        if should_delete_audio and audio_path and audio_path.exists():
            audio_path.unlink()


def main() -> int:
    args = parse_arguments()
    downloaded_audio_index, audio_metadata_path = load_downloaded_audio_index(args.audio_metadata_path)
    episodes = load_episodes(args, downloaded_audio_index)
    report_path = resolve_report_path(args.report_path)

    if not episodes:
        print("No All-In episodes matched the current offline ASR filters.")
        return 0

    print(
        f"Checking {len(episodes)} All-In episode{'s' if len(episodes) != 1 else ''} for offline ASR backfill..."
    )
    if args.limit and args.limit > 0:
        print(f"Limiting this run to the first {args.limit} matched episode{'s' if args.limit != 1 else ''}.")
    print(
        f"Loading faster-whisper model '{args.model}' on device '{args.device}' with compute type '{args.compute_type}'."
    )
    if downloaded_audio_index:
        print(
            f"Loaded {len(downloaded_audio_index)} local downloaded audio records from {audio_metadata_path}."
        )
        if not args.episode_ids:
            local_selected_count = len(
                [episode for episode in episodes if episode.get("id", "") in downloaded_audio_index]
            )
            print(
                f"Prioritizing locally downloaded archive audio first: {local_selected_count} of the current {len(episodes)} selected episode(s) already exist in raw/audio."
            )
    print(f"Writing ASR run report to {report_path}.")

    started_at = utc_now()
    episode_states = [
        build_episode_run_state(
            episode,
            position=index,
            total=len(episodes),
            downloaded_audio_index=downloaded_audio_index,
        )
        for index, episode in enumerate(episodes, start=1)
    ]
    episode_state_map = {
        episode_state["episodeId"]: episode_state for episode_state in episode_states
    }
    current_episode_id = ""
    run_status = "running"
    failure_reason = ""

    def persist_report() -> None:
        write_run_report(
            report_path,
            build_run_report(
                args=args,
                episodes=episodes,
                audio_metadata_path=audio_metadata_path,
                report_path=report_path,
                episode_states=episode_states,
                run_status=run_status,
                started_at=started_at,
                current_episode_id=current_episode_id,
                failure_reason=failure_reason,
            ),
        )

    persist_report()

    def handle_interruption(signum: int, _frame: Any) -> None:
        nonlocal run_status, failure_reason
        signal_name = signal.Signals(signum).name
        run_status = "interrupted"
        failure_reason = f"Interrupted by {signal_name}."
        persist_report()
        raise SystemExit(128 + signum)

    previous_sigint = signal.getsignal(signal.SIGINT)
    previous_sigterm = signal.getsignal(signal.SIGTERM)
    signal.signal(signal.SIGINT, handle_interruption)
    signal.signal(signal.SIGTERM, handle_interruption)

    try:
        model = WhisperModel(
            args.model,
            device=args.device,
            compute_type=args.compute_type,
            download_root=args.model_cache_dir,
        )

        for index, episode in enumerate(episodes, start=1):
            episode_id = episode["id"]
            prefix = format_indexed_prefix(index, len(episodes))
            audio_source_label = get_audio_source_label(episode, downloaded_audio_index)
            current_episode_id = episode_id
            update_episode_run_state(
                episode_state_map,
                episode_id,
                status="started",
                startedAt=utc_now(),
                finishedAt=None,
                reason="",
            )
            persist_report()

            print(f"{prefix} START {episode_id} :: {episode['title']} [{audio_source_label}]")
            result = transcribe_episode(episode, model, args, downloaded_audio_index)

            if result["status"] == "written":
                source_label = "local audio" if result.get("usedLocalAudio") else "downloaded audio"
                update_episode_run_state(
                    episode_state_map,
                    episode_id,
                    status="completed",
                    finishedAt=utc_now(),
                    reason="",
                    chunkCount=result.get("chunkCount"),
                    languageCode=result.get("languageCode", ""),
                    usedLocalAudio=bool(result.get("usedLocalAudio")),
                    transcriptPath=result.get("transcriptPath", episode_state_map[episode_id]["transcriptPath"]),
                )
                persist_report()
                print(
                    f"{prefix} DONE {result['episodeId']} :: wrote {result['chunkCount']} ASR chunk{'s' if result['chunkCount'] != 1 else ''} from {source_label}."
                )
            elif result["status"] == "failed":
                update_episode_run_state(
                    episode_state_map,
                    episode_id,
                    status="failed",
                    finishedAt=utc_now(),
                    reason=result.get("reason", ""),
                )
                persist_report()
                print(f"{prefix} FAIL {result['episodeId']} :: {result['reason']}")
            else:
                update_episode_run_state(
                    episode_state_map,
                    episode_id,
                    status="skipped",
                    finishedAt=utc_now(),
                    reason=result.get("reason", ""),
                    transcriptPath=result.get("transcriptPath", episode_state_map[episode_id]["transcriptPath"]),
                )
                persist_report()
                print(f"{prefix} SKIP {result['episodeId']} :: {result['reason']}")

            current_episode_id = ""

        run_status = "completed"
        failure_reason = ""
        persist_report()
    except KeyboardInterrupt:
        run_status = "interrupted"
        failure_reason = "Interrupted by KeyboardInterrupt."
        persist_report()
        raise
    except SystemExit:
        persist_report()
        raise
    except Exception as error:  # noqa: BLE001 - preserve partial progress on unexpected failure
        run_status = "failed"
        failure_reason = normalize_whitespace(str(error))
        if current_episode_id:
            update_episode_run_state(
                episode_state_map,
                current_episode_id,
                status="failed",
                finishedAt=utc_now(),
                reason=failure_reason,
            )
        persist_report()
        raise
    finally:
        signal.signal(signal.SIGINT, previous_sigint)
        signal.signal(signal.SIGTERM, previous_sigterm)

    counts = summarize_episode_states(episode_states)
    print("Offline ASR backfill complete.")
    print(f"Completed: {counts['completedCount']}")
    print(f"Skipped: {counts['skippedCount']}")
    print(f"Failed: {counts['failedCount']}")
    print(f"Report: {report_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
