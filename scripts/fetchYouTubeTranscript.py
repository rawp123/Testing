#!/usr/bin/env python3

import json
import sys

from youtube_transcript_api import YouTubeTranscriptApi


def main() -> int:
    if len(sys.argv) < 2 or not sys.argv[1].strip():
        print("Usage: fetchYouTubeTranscript.py <video_id>", file=sys.stderr)
        return 1

    video_id = sys.argv[1].strip()

    try:
        transcript = YouTubeTranscriptApi().fetch(video_id, languages=["en"])
    except Exception as error:  # noqa: BLE001 - surface the upstream message cleanly
        print(str(error), file=sys.stderr)
        return 1

    payload = {
        "videoId": video_id,
        "segments": transcript.to_raw_data()
    }
    print(json.dumps(payload))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
