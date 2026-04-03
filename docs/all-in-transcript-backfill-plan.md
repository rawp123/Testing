# All-In Transcript Backfill Plan

## Current State

- Total episodes in the generated archive: `363`
- Full transcript coverage: `5`
  These are episodes backed by `structured-json` or `legacy-timestamped-text`.
- Outline-only coverage: `249`
  These are searchable, but they are not full transcripts.
- No transcript coverage: `109`

The missing inventory lives in [all-in-missing-transcripts.md](/workspaces/Testing/docs/all-in-missing-transcripts.md), and the batch-tracking manifest lives in [all-in-missing-transcripts.json](/workspaces/Testing/docs/all-in-missing-transcripts.json).

## Goal

Make every All-In episode searchable from fully static assets by prebuilding transcript JSON into `scripts/podcasts/all-in/raw/transcripts/<episode-id>/`, then rebuilding the site output under `data/all-in-podcast-search/` and `all-in-podcast-search/pagefind/`.

## Best Static-Site Architecture

1. Acquire transcript text ahead of time.
2. Store transcript chunks as durable JSON in the repo workflow.
3. Build episode JSON and Pagefind output from those static transcript files.
4. Serve only static HTML, CSS, JS, JSON, and Pagefind files at runtime.

This keeps the site fast, cheap, reliable, and independent of live third-party transcript fetches.

## Recommended Execution Plan

### Phase 1: Close The `109` Fully Missing Episodes

1. Use the YouTube backfill pipeline to target only missing episodes first.
2. Save successful fetches as transcript overrides under `raw/transcripts/<episode-id>/`.
3. Rebuild and verify that the missing count drops.

Preferred command on a local machine:

```bash
npm run refresh:all-in-podcast-full-transcripts -- --missing-only
```

### Phase 2: Replace The `249` Outline-Only Episodes

1. After the missing backlog is reduced, run the same pipeline with `--replace-outline`.
2. Replace RSS outline chunks with real transcript chunks wherever a transcript source exists.
3. Rebuild and compare transcript source counts.

Preferred command on a local machine:

```bash
npm run refresh:all-in-podcast-full-transcripts
```

The wrapper defaults to `--replace-outline`, which is the right long-term mode for a static transcript archive.

### Phase 3: Handle Episodes YouTube Cannot Supply

Not every episode will be retrievable from YouTube. For failures, fall back in this order:

1. Existing local transcript artifacts or exported text files
2. AssemblyAI using the downloaded local audio archive when available
3. Official episode pages or producer-supplied transcript sources
4. Manual transcript JSON creation for high-value episodes
5. Offline ASR from audio files as a final fallback

For the provider-backed fallback, the output should still be converted into static `transcript.json` files so the site remains fully static at runtime.

Preferred provider-backed fallback command:

```bash
ASSEMBLYAI_API_KEY=your_key npm run transcribe:all-in-podcast-assemblyai -- --missing-only
```

Preferred command for the offline fallback:

```bash
npm run transcribe:all-in-podcast-audio -- --missing-only
```

### Phase 4: Quality Control

For every batch:

1. Rebuild `data/all-in-podcast-search/episodes/index.json`
2. Spot-check a few episode pages
3. Spot-check the search page for timestamp jumps and snippet quality
4. Confirm that `transcriptSourceType` reflects the stronger source
5. Confirm that `chunkCount` is materially higher than outline-only versions

## Practical Constraints

- The current cloud environment is blocked by YouTube for transcript retrieval.
- The backfill pipeline is implemented, but successful fetches need to run from a residential or otherwise accepted IP.
- Local CPU ASR is useful for spot checks, but AssemblyAI is the better operational path for archive-scale reruns in Codespaces because it supports resumable multi-episode batches without depending on long-lived CPU transcription sessions.
- Because of that, the fastest path is:
  run the transcript-backfill workflow locally, commit the resulting static transcript JSON, then rebuild and deploy as normal.

## Commands

Target only currently missing episodes:

```bash
npm run fetch:all-in-podcast-youtube-transcripts -- --missing-only
```

Target a specific episode:

```bash
npm run fetch:all-in-podcast-youtube-transcripts -- --episode all-in-e115 --verbose
```

Run the full static pipeline locally:

```bash
npm run refresh:all-in-podcast-full-transcripts
```

Run the full static pipeline with offline ASR fallback:

```bash
npm run refresh:all-in-podcast-full-transcripts-with-asr -- --missing-only
```

Run the full static pipeline with AssemblyAI fallback:

```bash
ASSEMBLYAI_API_KEY=your_key npm run refresh:all-in-podcast-full-transcripts-with-assemblyai -- --missing-only
```

Run a resumable 3-episode AssemblyAI pilot:

```bash
ASSEMBLYAI_API_KEY=your_key npm run transcribe:all-in-podcast-assemblyai -- --limit 3 --replace-outline
```

Run a resumable full-archive AssemblyAI batch:

```bash
ASSEMBLYAI_API_KEY=your_key npm run transcribe:all-in-podcast-assemblyai -- --replace-outline
```

## Success Criteria

Short term:

- Missing transcript count moves from `109` toward `0`

Medium term:

- Outline-only count moves from `249` toward `0`

End state:

- Every episode has a saved static transcript override
- Search is built entirely from durable local transcript files
- No runtime transcript dependency on YouTube
