# All-In Podcast Search

This utility is built to stay static and hostable without any paid search or database layer.

## Folder structure

- `all-in-podcast-search/`
  - Public search UI and episode detail page
  - `pagefind-source/` is generated for Pagefind indexing
- `data/all-in-podcast-search/episodes/`
  - Generated episode index and per-episode JSON payloads
- `data/all-in-podcast-search/README.md`
  - Notes that the website data is generated output only
- `scripts/podcasts/all-in/raw/`
  - Raw archive snapshot plus transcript overrides
- `scripts/podcasts/all-in/raw/archive/feed.xml`
  - Local snapshot of the full official All-In RSS feed
- `scripts/podcasts/all-in/raw/transcripts/`
  - Transcript override folders keyed by episode id
- `scripts/podcasts/all-in/raw/transcripts/_template/`
  - Starter files for future transcript drops
- `scripts/podcasts/all-in/README.md`
  - Developer notes for the ingestion workflow

## Source inputs

The archive metadata comes from a local RSS snapshot:

- `scripts/podcasts/all-in/raw/archive/feed.xml`

Optional transcript data is attached episode-by-episode under:

- `scripts/podcasts/all-in/raw/transcripts/<episode-id>/metadata.json`
- `scripts/podcasts/all-in/raw/transcripts/<episode-id>/transcript.json`

`metadata.json` can override or enrich feed metadata with fields such as:

- `id`
- `title`
- `publishDate`
- `description`
- `summary`
- `duration` or `durationSeconds`
- `guests`
- `topicTags`
- `youtubeId`
- `officialPageUrl`
- `fullEpisodeUrl`

`transcript.json` uses a structured chunk format. The full schema is documented in:

`docs/all-in-transcript-schema.md`

These transcript override files stay compatible whether they come from manual transcript authoring, YouTube caption backfills, AssemblyAI, or offline ASR. The search build only depends on the stable `metadata.json` plus `transcript.json` layout under `scripts/podcasts/all-in/raw/transcripts/<episode-id>/`.

Quick example:

```json
{
  "chunks": [
    {
      "startTimestamp": "00:00:00",
      "endTimestamp": "00:05:12",
      "speaker": "Jason",
      "text": "Opening topic text."
    }
  ]
}
```

Supported chunk fields:

    - `startTimestamp` or `startSeconds`
    - `endTimestamp` or `endSeconds`
    - `speaker`
    - `text`
    - `excerpt`

Speaker labels are preserved only when the source transcript includes them.

## Generated schema notes

Generated output is written to a predictable location:

- `data/all-in-podcast-search/episodes/index.json`
- `data/all-in-podcast-search/episodes/<episode-slug>.json`

Each generated JSON payload now includes:

- `schemaVersion`
- `generatedAt`
- normalized `episode` metadata
- normalized `chunks`

The top-level generated episode index also includes archive-wide transcript coverage fields:

- `episodeCount`
- `transcriptEpisodeCount`
- `transcriptChunkCount`
- `speakerLabeledChunkCount`

Each transcript chunk includes stable fields such as:

- `id`
- `sequence`
- `sourceBlockIndex`
- `segmentIndex`
- `segmentCount`
- `startSeconds`
- `startTimestamp`
- `sourceStartSeconds`
- `sourceStartTimestamp`
- `endSeconds`
- `endTimestamp`
- `speaker`
- `text`
- `excerpt`

## Build commands

- `npm run fetch:all-in-podcast-archive`
  - Refreshes the local full-archive RSS snapshot
- `npm run build:all-in-podcast-data`
  - Parses the archive feed and any transcript overrides
  - Writes generated episode JSON
  - Writes static Pagefind source pages
- `npm run build:all-in-podcast-pagefind`
  - Runs Pagefind against the generated search-doc pages
- `npm run build:all-in-podcast-search`
  - Runs both steps
- `npm run refresh:all-in-podcast-search`
  - Refreshes the archive snapshot and rebuilds everything end-to-end

## Future episode ingestion

To refresh the archive later:

1. Run `npm run fetch:all-in-podcast-archive`
2. Run `npm run build:all-in-podcast-search`

To attach a transcript to a specific episode:

1. Create `scripts/podcasts/all-in/raw/transcripts/<episode-id>/`
2. Copy the files from `scripts/podcasts/all-in/raw/transcripts/_template/`
3. Fill in `metadata.json` if you have useful guest, tag, or playback metadata
4. Add `transcript.json`
5. Run `npm run build:all-in-podcast-search`

The front end reads from the generated JSON only, so the website code should not need changes when new episodes are added.

For archive-scale backfills in Codespaces, prefer the AssemblyAI workflow documented in `scripts/podcasts/all-in/README.md`. It preserves the same episode ids, transcript paths, and generated search output while working more reliably across resumable multi-episode runs than long local CPU ASR batches.
