#!/usr/bin/env python3

from __future__ import annotations

import argparse
import json
import math
import os
import signal
import sys
import time
from pathlib import Path
from typing import Any

import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

from allInPodcastUtils import load_downloaded_audio_index, normalize_whitespace


REPO_ROOT = Path(__file__).resolve().parent.parent
EPISODES_INDEX_PATH = REPO_ROOT / "data" / "all-in-podcast-search" / "episodes" / "index.json"
TRANSCRIPT_ROOT = REPO_ROOT / "scripts" / "podcasts" / "all-in" / "raw" / "transcripts"
DEFAULT_REPORTS_DIR = TRANSCRIPT_ROOT / "_reports"
DEFAULT_BASE_URL = os.environ.get("ASSEMBLYAI_BASE_URL", "https://api.assemblyai.com")
DEFAULT_SPEECH_MODEL = os.environ.get("ASSEMBLYAI_SPEECH_MODEL", "universal-3-pro")
DEFAULT_POLL_INTERVAL = int(os.environ.get("ASSEMBLYAI_POLL_INTERVAL_SECONDS", "6"))
DEFAULT_POLL_TIMEOUT = int(os.environ.get("ASSEMBLYAI_POLL_TIMEOUT_SECONDS", "7200"))
DEFAULT_HTTP_RETRIES = int(os.environ.get("ASSEMBLYAI_HTTP_RETRIES", "5"))

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
        description="AssemblyAI-backed transcript fallback for All-In podcast episodes."
    )
    parser.add_argument("--episode", "--id", dest="episode_ids", action="append", default=[])
    parser.add_argument("--limit", type=int, default=None)
    parser.add_argument("--overwrite", action="store_true")
    parser.add_argument("--replace-outline", action="store_true")
    parser.add_argument("--missing-only", action="store_true")
    parser.add_argument("--local-audio-only", action="store_true")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--verbose", action="store_true")
    parser.add_argument("--base-url", default=DEFAULT_BASE_URL)
    parser.add_argument("--speech-model", default=DEFAULT_SPEECH_MODEL)
    parser.add_argument("--poll-interval-seconds", type=int, default=DEFAULT_POLL_INTERVAL)
    parser.add_argument("--poll-timeout-seconds", type=int, default=DEFAULT_POLL_TIMEOUT)
    parser.add_argument("--http-retries", type=int, default=DEFAULT_HTTP_RETRIES)
    parser.add_argument("--no-speaker-labels", action="store_true")
    parser.add_argument("--speakers-expected", type=int, default=None)
    parser.add_argument("--min-speakers-expected", type=int, default=2)
    parser.add_argument("--max-speakers-expected", type=int, default=5)
    parser.add_argument(
        "--resume-report",
        action=argparse.BooleanOptionalAction,
        default=True,
        help="Reuse transcript ids from an existing AssemblyAI run report when possible (default: enabled).",
    )
    parser.add_argument(
        "--report-path",
        type=Path,
        default=None,
        help="Optional JSON report path for the current AssemblyAI run. Defaults to scripts/podcasts/all-in/raw/transcripts/_reports/assemblyai-last-run.json",
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
    if args.local_audio_only:
        filtered = [
            episode for episode in filtered if episode.get("id", "") in downloaded_audio_index
        ]
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


def resolve_report_path(report_path: Path | None) -> Path:
    if report_path is not None:
        return report_path.resolve()

    return (DEFAULT_REPORTS_DIR / "assemblyai-last-run.json").resolve()


def load_existing_run_report(report_path: Path) -> dict[str, Any] | None:
    if not report_path.exists():
        return None

    try:
        payload = load_json_if_exists(report_path)
    except Exception as error:  # noqa: BLE001 - malformed report should not block a new run
        print(f"Warning: ignoring unreadable AssemblyAI report at {report_path}: {error}", file=sys.stderr)
        return None

    if not payload:
        return None

    if normalize_whitespace(payload.get("mode", "")) != "assemblyai":
        print(
            f"Warning: ignoring non-AssemblyAI report at {report_path}.",
            file=sys.stderr,
        )
        return None

    return payload


def utc_now() -> str:
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())


def format_indexed_prefix(position: int, total: int) -> str:
    return f"[{position}/{total}]"


def get_audio_source_label(
    episode: dict[str, Any],
    downloaded_audio_index: dict[str, dict[str, Any]],
) -> str:
    if episode.get("id", "") in downloaded_audio_index:
        return "local archive audio"

    return "remote audio fallback"


def build_episode_run_state(
    episode: dict[str, Any],
    *,
    position: int,
    total: int,
    downloaded_audio_index: dict[str, dict[str, Any]],
    previous_state: dict[str, Any] | None = None,
) -> dict[str, Any]:
    episode_id = normalize_whitespace(episode.get("id", ""))
    transcript_path = TRANSCRIPT_ROOT / episode_id / "transcript.json"
    metadata_path = TRANSCRIPT_ROOT / episode_id / "metadata.json"
    local_audio_available = episode_id in downloaded_audio_index
    episode_state = {
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
        "assemblyAiTranscriptId": "",
        "transcriptPath": str(transcript_path),
        "metadataPath": str(metadata_path),
    }

    if previous_state:
        previous_transcript_id = normalize_whitespace(previous_state.get("assemblyAiTranscriptId", ""))
        if previous_transcript_id:
            episode_state["assemblyAiTranscriptId"] = previous_transcript_id

        if isinstance(previous_state.get("usedLocalAudio"), bool):
            episode_state["usedLocalAudio"] = previous_state["usedLocalAudio"]

    return episode_state


def build_previous_episode_state_map(
    report_payload: dict[str, Any] | None,
    episodes: list[dict[str, Any]],
) -> dict[str, dict[str, Any]]:
    if not report_payload:
        return {}

    episode_ids = {normalize_whitespace(episode.get("id", "")) for episode in episodes}
    previous_episode_states = report_payload.get("episodes") or []
    previous_state_map: dict[str, dict[str, Any]] = {}

    for episode_state in previous_episode_states:
        episode_id = normalize_whitespace(episode_state.get("episodeId", ""))
        if not episode_id or episode_id not in episode_ids:
            continue
        previous_state_map[episode_id] = episode_state

    return previous_state_map


def get_resume_transcript_id(previous_state: dict[str, Any] | None, args: argparse.Namespace) -> str:
    if not args.resume_report or args.overwrite or not previous_state:
        return ""

    return normalize_whitespace(previous_state.get("assemblyAiTranscriptId", ""))


def build_api_session(api_key: str, args: argparse.Namespace) -> requests.Session:
    session = requests.Session()
    session.headers.update(
        {
            "Authorization": api_key,
            "Content-Type": "application/json",
        }
    )

    retry_total = max(int(args.http_retries or 0), 0)
    if retry_total > 0:
        retry = Retry(
            total=retry_total,
            connect=retry_total,
            read=retry_total,
            status=retry_total,
            backoff_factor=1,
            status_forcelist=(408, 409, 425, 429, 500, 502, 503, 504),
            allowed_methods=frozenset({"GET", "POST"}),
            respect_retry_after_header=True,
        )
        adapter = HTTPAdapter(max_retries=retry)
        session.mount("https://", adapter)
        session.mount("http://", adapter)

    return session


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
        "mode": "assemblyai",
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
            "localAudioOnly": bool(args.local_audio_only),
            "dryRun": bool(args.dry_run),
            "baseUrl": args.base_url,
            "speechModel": args.speech_model,
            "pollIntervalSeconds": args.poll_interval_seconds,
            "pollTimeoutSeconds": args.poll_timeout_seconds,
            "httpRetries": args.http_retries,
            "noSpeakerLabels": bool(args.no_speaker_labels),
            "speakersExpected": args.speakers_expected,
            "minSpeakersExpected": args.min_speakers_expected,
            "maxSpeakersExpected": args.max_speakers_expected,
            "resumeReport": bool(args.resume_report),
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


def build_transcript_request(audio_source: str, args: argparse.Namespace) -> dict[str, Any]:
    payload: dict[str, Any] = {
        "audio_url": audio_source,
        "speech_model": args.speech_model,
        "language_detection": True,
        "format_text": True,
        "speaker_labels": not args.no_speaker_labels,
    }

    if args.speakers_expected:
        payload["speakers_expected"] = args.speakers_expected
    elif not args.no_speaker_labels:
        payload["speaker_options"] = {
            "min_speakers_expected": args.min_speakers_expected,
            "max_speakers_expected": args.max_speakers_expected,
        }

    return payload


def upload_local_audio(
    session: requests.Session,
    base_url: str,
    audio_path: Path,
) -> str:
    with audio_path.open("rb") as handle:
        response = session.post(
            f"{base_url}/v2/upload",
            data=handle,
            headers={"Content-Type": "application/octet-stream"},
            timeout=(30, 3600),
        )
    response.raise_for_status()
    payload = response.json()
    upload_url = normalize_whitespace(payload.get("upload_url", ""))
    if not upload_url:
        raise RuntimeError(f"AssemblyAI upload did not return an upload_url: {payload}")
    return upload_url


def submit_transcript(
    session: requests.Session,
    base_url: str,
    audio_source: str,
    args: argparse.Namespace,
) -> str:
    payload = build_transcript_request(audio_source, args)
    response = session.post(f"{base_url}/v2/transcript", json=payload, timeout=(30, 120))
    response.raise_for_status()
    body = response.json()
    transcript_id = body.get("id")

    if not transcript_id:
        raise RuntimeError(f"AssemblyAI did not return a transcript id: {body}")

    return transcript_id


def poll_transcript(
    session: requests.Session,
    base_url: str,
    transcript_id: str,
    args: argparse.Namespace,
) -> dict[str, Any]:
    deadline = time.time() + args.poll_timeout_seconds

    while True:
        response = session.get(
            f"{base_url}/v2/transcript/{transcript_id}",
            timeout=(30, 120),
        )
        response.raise_for_status()
        payload = response.json()
        status = payload.get("status")

        if status == "completed":
            return payload

        if status == "error":
            raise RuntimeError(payload.get("error") or "AssemblyAI transcription failed.")

        if time.time() >= deadline:
            raise TimeoutError(
                f"Timed out waiting for AssemblyAI transcript {transcript_id} to complete."
            )

        time.sleep(max(args.poll_interval_seconds, 1))


def build_chunks(payload: dict[str, Any]) -> list[dict[str, Any]]:
    utterances = payload.get("utterances") or []
    chunks: list[dict[str, Any]] = []

    for utterance in utterances:
        text = normalize_whitespace(utterance.get("text", ""))
        if not text:
            continue

        start_seconds = max(int(math.floor((utterance.get("start") or 0) / 1000)), 0)
        end_seconds = max(int(math.ceil((utterance.get("end") or 0) / 1000)), start_seconds)
        speaker = normalize_whitespace(utterance.get("speaker", ""))

        chunk = {
            "startSeconds": start_seconds,
            "endSeconds": end_seconds,
            "startTimestamp": to_timestamp(start_seconds),
            "endTimestamp": to_timestamp(end_seconds),
            "text": text,
        }
        if speaker:
            chunk["speaker"] = speaker

        chunks.append(chunk)

    if chunks:
        return chunks

    text = normalize_whitespace(payload.get("text", ""))
    if not text:
        return []

    return [
        {
            "startSeconds": 0,
            "startTimestamp": "00:00",
            "text": text,
        }
    ]


def transcribe_episode(
    episode: dict[str, Any],
    session: requests.Session,
    base_url: str,
    args: argparse.Namespace,
    downloaded_audio_index: dict[str, dict[str, Any]],
    resume_transcript_id: str = "",
    previous_state: dict[str, Any] | None = None,
    on_transcript_submitted: Any = None,
) -> dict[str, Any]:
    episode_id = episode.get("id", "")
    transcript_directory = TRANSCRIPT_ROOT / episode_id
    transcript_path = transcript_directory / "transcript.json"
    metadata_path = transcript_directory / "metadata.json"

    if transcript_path.exists() and not args.overwrite:
        return {
            "status": "skipped",
            "episodeId": episode_id,
            "reason": "Transcript override already exists.",
            "transcriptPath": str(transcript_path),
        }

    local_audio_record = downloaded_audio_index.get(episode_id)
    audio_url = normalize_whitespace(episode.get("audioUrl", ""))

    if not local_audio_record and not audio_url:
        return {
            "status": "skipped",
            "episodeId": episode_id,
            "reason": "Episode has no local audio file and no audioUrl for AssemblyAI transcription.",
        }

    prior_used_local_audio = bool(previous_state.get("usedLocalAudio")) if previous_state else False

    transcript_id = resume_transcript_id
    payload: dict[str, Any] | None = None
    resumed_existing_job = False

    if transcript_id:
        try:
            payload = poll_transcript(session, base_url, transcript_id, args)
            resumed_existing_job = True
        except Exception:
            payload = None
            transcript_id = ""

    if payload is None:
        if local_audio_record:
            audio_source = upload_local_audio(
                session,
                base_url,
                Path(local_audio_record["resolvedFilePath"]),
            )
        else:
            audio_source = audio_url

        transcript_id = submit_transcript(session, base_url, audio_source, args)
        if callable(on_transcript_submitted):
            on_transcript_submitted(transcript_id, bool(local_audio_record))
        payload = poll_transcript(session, base_url, transcript_id, args)

    chunks = build_chunks(payload)

    if not chunks:
        return {
            "status": "failed",
            "episodeId": episode_id,
            "reason": "AssemblyAI completed without usable transcript chunks.",
        }

    existing_metadata = load_json_if_exists(metadata_path)
    metadata_payload = build_metadata_payload(episode, existing_metadata)
    transcript_payload = {
        "schemaVersion": 1,
        "episodeId": episode_id,
        "source": f"AssemblyAI {args.speech_model}",
        "languageCode": normalize_whitespace(payload.get("language_code", "")),
        "assemblyAiTranscriptId": transcript_id,
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
        "transcriptId": transcript_id,
        "languageCode": transcript_payload["languageCode"],
        "usedLocalAudio": prior_used_local_audio if resumed_existing_job else bool(local_audio_record),
        "resumedExistingJob": resumed_existing_job,
        "transcriptPath": str(transcript_path),
    }


def main() -> int:
    args = parse_arguments()
    api_key = normalize_whitespace(os.environ.get("ASSEMBLYAI_API_KEY", ""))

    if not api_key:
        raise SystemExit("ASSEMBLYAI_API_KEY is required for the AssemblyAI transcript fallback.")

    downloaded_audio_index, audio_metadata_path = load_downloaded_audio_index(args.audio_metadata_path)
    episodes = load_episodes(args, downloaded_audio_index)
    report_path = resolve_report_path(args.report_path)
    previous_report = load_existing_run_report(report_path) if args.resume_report else None
    previous_episode_state_map = build_previous_episode_state_map(previous_report, episodes)
    if not episodes:
        print("No All-In episodes matched the current AssemblyAI fallback filters.")
        return 0

    session = build_api_session(api_key, args)

    base_url = args.base_url.rstrip("/")

    print(
        f"Checking {len(episodes)} All-In episode{'s' if len(episodes) != 1 else ''} for AssemblyAI transcript backfill..."
    )
    if args.limit and args.limit > 0:
        print(f"Limiting this run to the first {args.limit} matched episode{'s' if args.limit != 1 else ''}.")
    print(f"Using AssemblyAI endpoint {base_url} with speech model '{args.speech_model}'.")
    print(f"HTTP retries per request: {max(int(args.http_retries or 0), 0)}.")
    if downloaded_audio_index:
        print(
            f"Loaded {len(downloaded_audio_index)} local downloaded audio records from {audio_metadata_path}."
        )
        if args.local_audio_only:
            print("Restricting this run to episodes that already exist in the local audio archive.")
        if not args.episode_ids:
            local_selected_count = len(
                [episode for episode in episodes if episode.get("id", "") in downloaded_audio_index]
            )
            print(
                f"Prioritizing locally downloaded archive audio first: {local_selected_count} of the current {len(episodes)} selected episode(s) already exist in raw/audio."
            )
    resumable_episode_count = len(
        [
            episode_id
            for episode_id, previous_state in previous_episode_state_map.items()
            if get_resume_transcript_id(previous_state, args)
        ]
    )
    if resumable_episode_count:
        print(
            f"Found {resumable_episode_count} selected episode(s) with previously submitted AssemblyAI transcript ids in {report_path}; this run will resume those jobs before submitting new ones."
        )
    print(f"Writing AssemblyAI run report to {report_path}.")

    started_at = utc_now()
    episode_states = [
        build_episode_run_state(
            episode,
            position=index,
            total=len(episodes),
            downloaded_audio_index=downloaded_audio_index,
            previous_state=previous_episode_state_map.get(normalize_whitespace(episode.get("id", ""))),
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
        for index, episode in enumerate(episodes, start=1):
            episode_id = episode["id"]
            prefix = format_indexed_prefix(index, len(episodes))
            audio_source_label = get_audio_source_label(episode, downloaded_audio_index)
            previous_state = previous_episode_state_map.get(episode_id)
            resume_transcript_id = get_resume_transcript_id(previous_state, args)
            current_episode_id = episode_id
            update_episode_run_state(
                episode_state_map,
                episode_id,
                status="started",
                startedAt=utc_now(),
                finishedAt=None,
                reason="",
                assemblyAiTranscriptId=resume_transcript_id or episode_state_map[episode_id].get("assemblyAiTranscriptId", ""),
            )
            persist_report()

            if resume_transcript_id:
                print(
                    f"{prefix} START {episode_id} :: {episode['title']} [{audio_source_label}] [resume {resume_transcript_id}]"
                )
            else:
                print(f"{prefix} START {episode_id} :: {episode['title']} [{audio_source_label}]")

            def handle_transcript_submitted(transcript_id: str, used_local_audio: bool) -> None:
                update_episode_run_state(
                    episode_state_map,
                    episode_id,
                    assemblyAiTranscriptId=transcript_id,
                    usedLocalAudio=used_local_audio,
                    reason="AssemblyAI transcript submitted; polling for completion.",
                )
                persist_report()
                source_label = "local archive audio" if used_local_audio else "remote audio fallback"
                print(
                    f"{prefix} SUBMIT {episode_id} :: AssemblyAI transcript {transcript_id} accepted from {source_label}."
                )

            try:
                result = transcribe_episode(
                    episode,
                    session,
                    base_url,
                    args,
                    downloaded_audio_index,
                    resume_transcript_id=resume_transcript_id,
                    previous_state=previous_state,
                    on_transcript_submitted=handle_transcript_submitted,
                )
            except Exception as error:  # noqa: BLE001 - preserve incremental report state
                result = {
                    "status": "failed",
                    "episodeId": episode_id,
                    "reason": normalize_whitespace(str(error)),
                }

            if result["status"] == "written":
                update_episode_run_state(
                    episode_state_map,
                    episode_id,
                    status="completed",
                    finishedAt=utc_now(),
                    reason="",
                    chunkCount=result.get("chunkCount"),
                    languageCode=result.get("languageCode", ""),
                    usedLocalAudio=bool(result.get("usedLocalAudio")),
                    assemblyAiTranscriptId=result.get("transcriptId", ""),
                    transcriptPath=result.get("transcriptPath", episode_state_map[episode_id]["transcriptPath"]),
                )
                persist_report()
                source_label = "local archive audio" if result.get("usedLocalAudio") else "remote audio fallback"
                resume_label = " after resuming an existing AssemblyAI job" if result.get("resumedExistingJob") else ""
                print(
                    f"{prefix} DONE {result['episodeId']} :: wrote {result['chunkCount']} AssemblyAI chunk{'s' if result['chunkCount'] != 1 else ''} from {source_label}{resume_label}."
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
    except Exception as error:  # noqa: BLE001
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
    print("AssemblyAI transcript backfill complete.")
    print(f"Completed: {counts['completedCount']}")
    print(f"Skipped: {counts['skippedCount']}")
    print(f"Failed: {counts['failedCount']}")
    print(f"Report: {report_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
