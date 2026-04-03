import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

const INPUT_PATH = path.join(
  repoRoot,
  'data',
  'all-in-podcast-search',
  'episodes',
  'index.json'
);
const OUTPUT_PATH = path.join(
  repoRoot,
  'docs',
  'all-in-missing-transcripts.json'
);
const BATCH_SIZE = 25;

function buildBatchId(index) {
  return `batch-${String(index).padStart(2, '0')}`;
}

function buildPriority(index) {
  if (index < BATCH_SIZE) {
    return 'high';
  }

  if (index < BATCH_SIZE * 3) {
    return 'medium';
  }

  return 'low';
}

async function main() {
  const raw = await fs.readFile(INPUT_PATH, 'utf8');
  const index = JSON.parse(raw);

  const missingEpisodes = index.episodes
    .filter((episode) => !episode.transcriptAvailable)
    .sort((left, right) => {
      const publishDateCompare = (left.publishDate || '').localeCompare(
        right.publishDate || ''
      );

      if (publishDateCompare !== 0) {
        return publishDateCompare;
      }

      return left.id.localeCompare(right.id);
    });

  const countsByYear = {};
  const episodes = missingEpisodes.map((episode, indexWithinMissing) => {
    const year = (episode.publishDate || 'unknown').slice(0, 4) || 'unknown';
    const batchNumber = Math.floor(indexWithinMissing / BATCH_SIZE) + 1;

    countsByYear[year] = (countsByYear[year] || 0) + 1;

    return {
      id: episode.id,
      slug: episode.slug,
      episodeNumber: episode.episodeNumber,
      title: episode.title,
      publishDate: episode.publishDate,
      year,
      officialPageUrl: episode.officialPageUrl,
      fullEpisodeUrl: episode.fullEpisodeUrl,
      audioUrl: episode.audioUrl,
      dataFile: episode.dataFile,
      targetTranscriptDirectory: `/scripts/podcasts/all-in/raw/transcripts/${episode.id}/`,
      targetTranscriptFile: `/scripts/podcasts/all-in/raw/transcripts/${episode.id}/transcript.json`,
      suggestedSource: 'youtube-transcript',
      fallbackOrder: [
        'local-transcript-artifact',
        'official-source',
        'manual-json',
        'offline-asr'
      ],
      status: 'missing',
      priority: buildPriority(indexWithinMissing),
      batch: buildBatchId(batchNumber),
      notes: ''
    };
  });

  const batches = [];

  for (let start = 0; start < episodes.length; start += BATCH_SIZE) {
    const batchEpisodes = episodes.slice(start, start + BATCH_SIZE);
    const batchId = buildBatchId(Math.floor(start / BATCH_SIZE) + 1);

    batches.push({
      id: batchId,
      episodeCount: batchEpisodes.length,
      startDate: batchEpisodes[0]?.publishDate || '',
      endDate: batchEpisodes[batchEpisodes.length - 1]?.publishDate || '',
      episodeIds: batchEpisodes.map((episode) => episode.id)
    });
  }

  const manifest = {
    generatedAt: new Date().toISOString(),
    sourceIndex: '/data/all-in-podcast-search/episodes/index.json',
    outputFile: '/docs/all-in-missing-transcripts.json',
    totalEpisodes: index.episodes.length,
    missingTranscriptEpisodes: episodes.length,
    countsByYear,
    batchStrategy: 'oldest-first',
    batchSize: BATCH_SIZE,
    batches,
    episodes
  };

  await fs.writeFile(OUTPUT_PATH, `${JSON.stringify(manifest, null, 2)}\n`);

  console.log(
    `Wrote ${episodes.length} missing episodes to ${path.relative(repoRoot, OUTPUT_PATH)}`
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
