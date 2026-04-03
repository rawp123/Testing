import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { dedupeVerdicts } from '../lib/dedupeVerdicts.js';
import { normalizeVerdict } from '../lib/normalizeVerdict.js';
import { CourtroomViewScraper } from '../scrapers/courtroomview.js';
import { NewsVerdictsScraper } from '../scrapers/newsVerdicts.js';
import { NewsSearchVerdictsScraper } from '../scrapers/newsSearchVerdicts.js';
import { TopVerdictScraper } from '../scrapers/topverdict.js';
import { type VerdictRecord } from '../scrapers/baseScraper.js';

const repoRoot = process.cwd();
const dataDirectory = path.join(repoRoot, 'data');
const protectedDataDirectory = path.join(repoRoot, 'work-in-progress', 'data');
const datasetPath = path.join(dataDirectory, 'nuclear-verdicts.json');
const latestPath = path.join(dataDirectory, 'nuclear-verdicts-latest.json');
const protectedLatestPath = path.join(protectedDataDirectory, 'nuclear-verdicts-latest.json');
const ingestionLogPath = path.join(dataDirectory, 'verdict-ingestion-log.json');

interface ScraperLogEntry {
  scraper: string;
  rawScraped: number;
  normalized: number;
}

async function run(): Promise<void> {
  const scrapers = [
    new CourtroomViewScraper(),
    new TopVerdictScraper(),
    new NewsVerdictsScraper(),
    new NewsSearchVerdictsScraper()
  ];

  const normalizedVerdicts: VerdictRecord[] = [];
  const scraperLogs: ScraperLogEntry[] = [];

  for (const scraper of scrapers) {
    const { rawVerdicts } = await scraper.scrape();
    let normalizedCount = 0;

    console.log(`[${scraper.sourceName}] raw verdicts scraped: ${rawVerdicts.length}`);

    rawVerdicts.forEach((rawVerdict) => {
      const normalized = normalizeVerdict(rawVerdict);
      if (normalized) {
        normalizedVerdicts.push(normalized);
        normalizedCount += 1;
      }
    });

    scraperLogs.push({
      scraper: scraper.sourceName,
      rawScraped: rawVerdicts.length,
      normalized: normalizedCount
    });

    console.log(`[${scraper.sourceName}] normalized verdicts: ${normalizedCount}`);
  }

  const dedupedVerdicts = dedupeVerdicts(normalizedVerdicts).sort((left, right) => {
    if (right.year !== left.year) {
      return right.year - left.year;
    }

    return right.totalVerdict - left.totalVerdict;
  });
  const duplicatesRemoved = Math.max(normalizedVerdicts.length - dedupedVerdicts.length, 0);
  const generatedAt = new Date().toISOString();
  const refreshedVerdicts = dedupedVerdicts.map((verdict) => ({
    ...verdict,
    updatedAt: generatedAt
  }));

  const ingestionLog = {
    generatedAt,
    rawCasesScraped: scraperLogs.reduce((sum, entry) => sum + entry.rawScraped, 0),
    normalizedCases: normalizedVerdicts.length,
    duplicatesRemoved,
    finalDatasetSize: refreshedVerdicts.length,
    scrapers: scraperLogs
  };

  await mkdir(dataDirectory, { recursive: true });
  await mkdir(protectedDataDirectory, { recursive: true });
  await writeFile(datasetPath, `${JSON.stringify(refreshedVerdicts, null, 2)}\n`, 'utf8');
  const latestSnapshot = {
    generatedAt,
    recordCount: refreshedVerdicts.length,
    records: refreshedVerdicts
  };
  await writeFile(latestPath, `${JSON.stringify(latestSnapshot, null, 2)}\n`, 'utf8');
  await writeFile(protectedLatestPath, `${JSON.stringify(latestSnapshot, null, 2)}\n`, 'utf8');
  await writeFile(ingestionLogPath, `${JSON.stringify(ingestionLog, null, 2)}\n`, 'utf8');

  console.log(`Raw cases scraped: ${ingestionLog.rawCasesScraped}`);
  console.log(`Duplicates removed: ${duplicatesRemoved}`);
  console.log(`Final dataset size: ${refreshedVerdicts.length}`);
  console.log(`Wrote dataset to ${datasetPath}`);
  console.log(`Wrote latest snapshot to ${latestPath}`);
  console.log(`Wrote protected snapshot to ${protectedLatestPath}`);
  console.log(`Wrote ingestion log to ${ingestionLogPath}`);
}

run().catch((error) => {
  console.error('runScrapers failed:', error);
  process.exitCode = 1;
});
