# All-In Transcript JSON Schema

Each episode transcript is stored as a structured JSON file at:

`scripts/podcasts/all-in/raw/transcripts/<episode-id>/transcript.json`

The build step validates the schema and rejects malformed files.

## Top-level structure

Required:

- `chunks`: array of transcript segments (see below)

Optional:

- `schemaVersion`: numeric schema identifier (current: `1`)
- `episodeId`: should match the folder name/episode id (validated when present)
- `source`: freeform string describing where the transcript came from

Example:

```json
{
  "schemaVersion": 1,
  "episodeId": "all-in-example-episode-id",
  "source": "Manual transcript export",
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

## Chunk schema

Required:

- `startTimestamp` or `startSeconds`
- `text`

Optional:

- `endTimestamp` or `endSeconds`
- `speaker`
- `excerpt`

Notes:

- Use `startTimestamp`/`endTimestamp` in `HH:MM:SS` or `MM:SS` format.
- If `startSeconds`/`endSeconds` are supplied, they must be numeric (seconds).
- Speaker names are preserved only when provided. They are never inferred.

## Episode metadata

Episode-level metadata lives in the separate `metadata.json` file in the same folder, not inside the transcript JSON.
