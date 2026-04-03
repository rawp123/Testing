# All-In Podcast Raw Inputs

This folder holds the source inputs for the static All-In Podcast Search build pipeline.

## What belongs here

- `raw/archive/feed.xml`
- `raw/audio/<episode-audio-files>` plus `raw/audio/metadata.json`
- `raw/transcripts/<episode-id>/metadata.json`
- `raw/transcripts/<episode-id>/transcript.json`
- `raw/transcripts/<episode-id>/transcript.txt` for legacy timestamped transcripts

Everything in `data/all-in-podcast-search/` is generated output and should be treated as build artifacts, not hand-edited source material.

## Refreshing the full archive

1. Run `npm run fetch:all-in-podcast-archive` to refresh the local RSS snapshot.
2. Optionally run `npm run download:all-in-podcast-audio-rss:full` to save a local copy of the audio archive under `raw/audio/`.
3. Optionally run `npm run fetch:all-in-podcast-youtube-transcripts` to backfill transcript overrides from YouTube captions.
4. Run `npm run build:all-in-podcast-search` to rebuild the generated JSON and Pagefind output.

The canonical local audio archive location is `scripts/podcasts/all-in/raw/audio/`. The downloader now writes stable `id`, `slug`, and `episodeNumber` fields into `raw/audio/metadata.json` so transcript utilities can map local files back to the same episode ids used by the generated site.

If you want to do both in one step, run:

```bash
npm run refresh:all-in-podcast-search
```

If you want to include a YouTube caption backfill before rebuilding, run:

```bash
npm run refresh:all-in-podcast-search-with-youtube
```

If you want the full static-site workflow in one command, including Python dependency bootstrapping and an attempt to replace RSS outlines with real transcripts, run:

```bash
npm run refresh:all-in-podcast-full-transcripts
```

If you also want that workflow to pull the RSS audio archive into `raw/audio/` first, run:

```bash
npm run refresh:all-in-podcast-full-transcripts-with-audio
```

If you also want an offline ASR fallback after the YouTube pass, run:

```bash
npm run refresh:all-in-podcast-full-transcripts-with-asr -- --missing-only
```

If you want to use AssemblyAI as the provider-backed fallback after the YouTube pass, run:

```bash
ASSEMBLYAI_API_KEY=your_key npm run refresh:all-in-podcast-full-transcripts-with-assemblyai -- --missing-only
```

## Attaching transcript data to an episode

1. Create a folder under `scripts/podcasts/all-in/raw/transcripts/` named with the generated episode id.
2. Copy the files from `scripts/podcasts/all-in/raw/transcripts/_template/`.
3. Fill in any transcript-specific metadata you want to preserve.
4. Add `transcript.json` with structured chunk data (timestamps + optional speaker labels).
   The JSON schema is documented in `docs/all-in-transcript-schema.md`.
5. If you only have an older timestamped plain-text transcript, `transcript.txt` is also supported.
6. Run `npm run build:all-in-podcast-search`.

The transcript override folder name should match the episode id generated from the archive feed. If needed, you can also set the exact `id` inside `metadata.json`.

Optional metadata fields:

- `duration` or `durationSeconds`: full episode runtime used in the Episodes tab
- `guests`: array of guest names for lightweight filtering in the UI
- `guest`: single guest string if there is only one
- `topicTags`: array of lightweight topic labels for the Episodes tab
- `officialPageUrl` or `fullEpisodeUrl`: override the default official episode destination
- `youtubeId`: enables timestamp-based playback from the episode detail page when a video id is known

## Transcript format

If you already have chunked transcript data, you can provide `transcript.json`:

```json
{
  "chunks": [
    {
      "startTimestamp": "00:12:07",
      "endTimestamp": "00:13:42",
      "speaker": "Chamath",
      "text": "Opening sentence for the segment."
    }
  ]
}
```

Supported fields per chunk:

- `startTimestamp` or `startSeconds`
- `endTimestamp` or `endSeconds` (optional)
- `speaker` (optional, preserved exactly when provided)
- `text`
- `excerpt` (optional)

Speaker names are never guessed. If a transcript source omits them, the generated chunks omit them too.

Legacy plain-text transcripts are also accepted when each block starts with a bracketed timestamp:

```text
[00:00:00] Jason: Opening topic text.
[00:07:13] Chamath: Next section text.
```

`transcript.json` is still the preferred format because it preserves chunk boundaries and metadata more explicitly.

## YouTube caption backfill

The repo also includes a helper for generating transcript overrides from YouTube captions:

```bash
npm run fetch:all-in-podcast-youtube-transcripts
```

Useful flags:

- `--limit 25` to cap how many episodes are checked in one run
- `--episode all-in-e115` to target a specific episode id
- `--replace-outline` to replace RSS outline coverage with YouTube captions when available
- `--missing-only` to limit the backfill to episodes with no transcript coverage at all
- `--overwrite` to rewrite an existing transcript override

By default, the script only targets episodes with no transcript coverage yet.
The full-refresh wrapper defaults to `--replace-outline`, which is the better fit when you want a stronger fully static archive.

The script works best from a normal residential IP. YouTube often blocks transcript requests from cloud-hosted environments, in which case the helper may find the right video but still fail to fetch transcript text.

If you need to route requests through a different network, the fetcher supports these environment variables:

- `ALL_IN_YOUTUBE_PROXY` as the repo-specific preferred proxy setting
- `HTTPS_PROXY` or `HTTP_PROXY` as standard proxy fallbacks

Examples:

```bash
npm run refresh:all-in-podcast-full-transcripts -- --missing-only
```

```bash
ALL_IN_YOUTUBE_PROXY=http://user:pass@host:port npm run refresh:all-in-podcast-full-transcripts -- --missing-only
```

The proxy setting is applied to:

- YouTube search-page lookups
- YouTube watch-page transcript discovery
- YouTube transcript endpoint requests
- The Python `youtube-transcript-api` helper

## AssemblyAI fallback

AssemblyAI is the recommended archive-scale fallback in Codespaces and other environments where local CPU ASR is slow or unstable across multi-episode batches.
The repo already includes an AssemblyAI-backed transcript path for episodes YouTube cannot supply:

```bash
ASSEMBLYAI_API_KEY=your_key npm run transcribe:all-in-podcast-assemblyai -- --missing-only
```

Useful flags:

- `--episode all-in-e115` to target a specific episode
- `--limit 3` to cap a pilot batch to the first three matched episodes
- `--local-audio-only` to restrict the run to episodes that already exist in `raw/audio/metadata.json`
- `--replace-outline` to replace RSS outline coverage with provider transcripts
- `--overwrite` to regenerate an existing transcript override
- `--resume-report` or `--no-resume-report` to control whether the existing JSON run report should be used to resume previously submitted AssemblyAI jobs
- `--speech-model universal-3-pro` to select the AssemblyAI speech model
- `--no-speaker-labels` to disable diarized utterance output
- `--speakers-expected 4` to lock the diarization target
- `--report-path path/to/report.json` to save the run report somewhere custom

Environment variables:

- `ASSEMBLYAI_API_KEY` is required
- `ASSEMBLYAI_BASE_URL` can switch endpoints, including the EU endpoint
- `ASSEMBLYAI_SPEECH_MODEL` can override the default speech model
- `ASSEMBLYAI_POLL_INTERVAL_SECONDS` can slow down or speed up transcript polling
- `ASSEMBLYAI_POLL_TIMEOUT_SECONDS` can extend long-running batch polling windows
- `ASSEMBLYAI_HTTP_RETRIES` can increase or reduce per-request retry behavior

The script submits each episode `audioUrl` to AssemblyAI's async `/v2/transcript` endpoint, polls for completion, and converts the timed utterances into the same static `transcript.json` format used by the rest of the site.

When `scripts/podcasts/all-in/raw/audio/metadata.json` exists, the AssemblyAI utility now prefers the downloaded local audio files and uploads them to AssemblyAI before submitting the transcript job.

Notes:

- When local archive metadata exists, AssemblyAI episode selection is local-audio-first by default for non-explicit runs, so `--limit` pilots naturally draw from the downloaded archive subset before remote-only episodes
- Add `--local-audio-only` when you want a pilot or batch run to stay strictly on the downloaded archive and never spill into remote fallback episodes
- Existing transcript overrides are skipped cleanly unless `--overwrite` is passed, which makes reruns resumable by default
- Each AssemblyAI run now writes a JSON report to `scripts/podcasts/all-in/raw/transcripts/_reports/assemblyai-last-run.json`
- The report is written incrementally: the run starts with every target episode marked `queued`, flips each episode to `started` before upload/transcription begins, then updates it to `completed`, `skipped`, or `failed`
- Episode entries in the report include `startedAt` and `finishedAt` timestamps when available, which makes interrupted provider runs much easier to inspect and resume
- Submitted `assemblyAiTranscriptId` values are now persisted before polling completes, so reruns can resume already-submitted AssemblyAI jobs instead of always creating replacement jobs
- The default last-run report is therefore enough for resumable pilot batches and resumable full-archive batches, as long as you reuse the same report path

To combine both steps in one command:

```bash
ASSEMBLYAI_API_KEY=your_key npm run refresh:all-in-podcast-full-transcripts-with-audio-and-assemblyai -- --missing-only
```

Recommended commands:

```bash
ASSEMBLYAI_API_KEY=your_key npm run transcribe:all-in-podcast-assemblyai -- --limit 3 --replace-outline
```

```bash
ASSEMBLYAI_API_KEY=your_key npm run transcribe:all-in-podcast-assemblyai -- --replace-outline
```

## Offline ASR fallback

For episodes YouTube still cannot supply, the repo now includes an offline ASR path powered by `faster-whisper`:

```bash
npm run transcribe:all-in-podcast-audio -- --missing-only
```

Useful flags:

- `--episode all-in-e115` to target a specific episode
- `--limit 5` to cap a pilot batch to the first five matched episodes
- `--replace-outline` to replace RSS outline coverage with ASR transcripts
- `--overwrite` to regenerate an existing transcript override
- `--model small` to choose a Whisper model
- `--device cpu` or `--device cuda` to pick the inference device
- `--compute-type int8` to reduce CPU memory use
- `--report-path path/to/report.json` to save the run report somewhere custom

Notes:

- The first run downloads the selected Whisper model into `.cache/all-in-whisper/`
- Audio files are downloaded temporarily into `.cache/all-in-podcast-audio/`
- ASR output is saved as the same static `transcript.json` format used by the rest of the site
- When `scripts/podcasts/all-in/raw/audio/metadata.json` exists, offline ASR prefers those local archive files instead of redownloading audio from RSS URLs
- When local archive metadata exists, episode selection is local-audio-first by default for non-explicit runs, so `--limit` pilots naturally draw from the downloaded archive subset before remote-only episodes
- Existing transcript overrides are skipped cleanly unless `--overwrite` is passed, which makes reruns resumable by default
- Each ASR run now writes a JSON report to `scripts/podcasts/all-in/raw/transcripts/_reports/offline-asr-last-run.json`
- The report is written incrementally: the run starts with every target episode marked `queued`, flips each episode to `started` before ASR begins, then updates it to `completed`, `skipped`, or `failed`
- Episode entries in the report include `startedAt` and `finishedAt` timestamps when available, which makes interrupted long runs much easier to inspect and resume
- The CLI logs `START`, `DONE`, `SKIP`, and `FAIL` for each episode, then prints completed/skipped/failed totals at the end

To combine both steps in one command:

```bash
npm run refresh:all-in-podcast-full-transcripts-with-audio-and-asr -- --missing-only
```

## Output locations

- Generated episode data: `data/all-in-podcast-search/episodes/`
- Generated Pagefind source docs: `all-in-podcast-search/pagefind-source/`
- Generated Pagefind bundle: `all-in-podcast-search/pagefind/`

Generated episode summaries also include transcript coverage fields like:

- `chunkCount`
- `speakerLabelCount`
- `transcriptSourceType`

## Notes

- Legacy timestamped transcript folders are now supported both in the active `raw/transcripts/` workflow and in older top-level `raw/all-in-*` folders.
- The website reads only from generated JSON under `data/all-in-podcast-search/episodes/`.
- Episodes without transcript overrides still appear in the archive table; they simply show `Transcript: No` until transcript data is attached later.
