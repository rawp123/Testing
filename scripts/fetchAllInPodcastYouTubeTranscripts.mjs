import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';

const execFileAsync = promisify(execFile);
const repoRoot = process.cwd();
const episodesIndexPath = path.join(repoRoot, 'data', 'all-in-podcast-search', 'episodes', 'index.json');
const transcriptRoot = path.join(repoRoot, 'scripts', 'podcasts', 'all-in', 'raw', 'transcripts');
const pythonTranscriptHelperPath = path.join(repoRoot, 'scripts', 'fetchYouTubeTranscript.py');
const preferredPythonPath = path.join(repoRoot, '.venv', 'bin', 'python');
const USER_AGENT = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36';
const DEFAULT_LIMIT = null;
const MIN_CANDIDATE_SCORE = 55;

function getConfiguredProxyUrl() {
  return normalizeWhitespace(
    process.env.ALL_IN_YOUTUBE_PROXY
      || process.env.HTTPS_PROXY
      || process.env.HTTP_PROXY
      || process.env.https_proxy
      || process.env.http_proxy
      || ''
  );
}

function buildProxyEnvironment() {
  const proxyUrl = getConfiguredProxyUrl();

  if (!proxyUrl) {
    return process.env;
  }

  return {
    ...process.env,
    HTTPS_PROXY: proxyUrl,
    HTTP_PROXY: proxyUrl,
    https_proxy: proxyUrl,
    http_proxy: proxyUrl
  };
}

function normalizeWhitespace(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function normalizeComparisonText(value) {
  return normalizeWhitespace(value)
    .toLowerCase()
    .replace(/&amp;/g, 'and')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function toTimestamp(totalSeconds) {
  const seconds = Math.max(Number(totalSeconds) || 0, 0);
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainder = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`;
  }

  return `${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`;
}

function getText(value) {
  if (!value) {
    return '';
  }

  if (typeof value.simpleText === 'string') {
    return value.simpleText;
  }

  if (Array.isArray(value.runs)) {
    return value.runs.map((item) => item.text || '').join('');
  }

  return '';
}

function extractJsonObjectAfterMarker(html, markers) {
  for (const marker of markers) {
    const markerIndex = html.indexOf(marker);
    if (markerIndex === -1) {
      continue;
    }

    const startIndex = html.indexOf('{', markerIndex + marker.length);
    if (startIndex === -1) {
      continue;
    }

    let depth = 0;
    let inString = false;
    let isEscaped = false;

    for (let index = startIndex; index < html.length; index += 1) {
      const character = html[index];

      if (inString) {
        if (isEscaped) {
          isEscaped = false;
          continue;
        }

        if (character === '\\') {
          isEscaped = true;
          continue;
        }

        if (character === '"') {
          inString = false;
        }

        continue;
      }

      if (character === '"') {
        inString = true;
        continue;
      }

      if (character === '{') {
        depth += 1;
      } else if (character === '}') {
        depth -= 1;
        if (depth === 0) {
          return html.slice(startIndex, index + 1);
        }
      }
    }
  }

  return null;
}

function extractConfigValue(html, key) {
  const pattern = new RegExp(`"${key}":"([^"]+)"`);
  const match = html.match(pattern);
  return match ? match[1] : '';
}

function collectVideoRenderers(node, results = [], seen = new Set()) {
  if (!node || typeof node !== 'object') {
    return results;
  }

  if (Array.isArray(node)) {
    node.forEach((value) => collectVideoRenderers(value, results, seen));
    return results;
  }

  if (node.videoRenderer?.videoId && !seen.has(node.videoRenderer.videoId)) {
    seen.add(node.videoRenderer.videoId);
    const videoRenderer = node.videoRenderer;
    results.push({
      videoId: videoRenderer.videoId,
      title: normalizeWhitespace(getText(videoRenderer.title)),
      channel: normalizeWhitespace(getText(videoRenderer.ownerText) || getText(videoRenderer.longBylineText)),
      publishedText: normalizeWhitespace(getText(videoRenderer.publishedTimeText)),
      lengthText: normalizeWhitespace(getText(videoRenderer.lengthText))
    });
  }

  Object.values(node).forEach((value) => collectVideoRenderers(value, results, seen));
  return results;
}

function tokenize(value) {
  return normalizeComparisonText(value)
    .split(' ')
    .filter((token) => token.length > 1);
}

function getTokenOverlapScore(left, right) {
  const leftTokens = tokenize(left);
  const rightTokens = new Set(tokenize(right));

  if (!leftTokens.length || !rightTokens.size) {
    return 0;
  }

  const overlapCount = leftTokens.filter((token) => rightTokens.has(token)).length;
  return overlapCount / leftTokens.length;
}

function scoreVideoCandidate(episode, candidate) {
  const episodeTitle = normalizeComparisonText(episode.title);
  const candidateTitle = normalizeComparisonText(candidate.title);
  const candidateChannel = normalizeComparisonText(candidate.channel);
  let score = 0;

  if (!candidateTitle) {
    return Number.NEGATIVE_INFINITY;
  }

  if (candidateTitle === episodeTitle) {
    score += 140;
  } else {
    if (candidateTitle.includes(episodeTitle)) {
      score += 100;
    }
    if (episodeTitle.includes(candidateTitle)) {
      score += 45;
    }
  }

  score += getTokenOverlapScore(episode.title, candidate.title) * 80;

  if (episode.episodeNumber) {
    const episodeToken = `e${episode.episodeNumber}`;
    if (candidateTitle.includes(episodeToken)) {
      score += 30;
    }
  }

  if (candidateChannel.includes('all in') || candidateChannel.includes('all-in')) {
    score += 35;
  }

  if (candidateChannel.includes('podcast')) {
    score += 10;
  }

  if (candidateTitle.includes('shorts') || candidateTitle.includes('clip')) {
    score -= 35;
  }

  if (!candidate.lengthText) {
    score -= 10;
  }

  return score;
}

async function fetchText(url) {
  const proxyUrl = getConfiguredProxyUrl();

  if (proxyUrl) {
    const curlArguments = [
      '-sS',
      '-L',
      '--compressed',
      '--proxy',
      proxyUrl,
      '-H',
      'accept-language: en-US,en;q=0.9',
      '-A',
      USER_AGENT,
      url
    ];
    const { stdout } = await execFileAsync('curl', curlArguments, {
      cwd: repoRoot,
      env: buildProxyEnvironment(),
      maxBuffer: 1024 * 1024 * 20
    });
    return stdout;
  }

  const response = await fetch(url, {
    headers: {
      'accept-language': 'en-US,en;q=0.9',
      'user-agent': USER_AGENT
    }
  });

  if (!response.ok) {
    throw new Error(`Request failed for ${url} with ${response.status}.`);
  }

  return response.text();
}

async function searchYouTubeCandidates(episode) {
  const queries = [
    `${episode.title} All-In Podcast`,
    episode.episodeNumber ? `All-In E${episode.episodeNumber} ${episode.title}` : '',
    episode.title
  ].filter(Boolean);
  const candidates = new Map();

  for (const query of queries) {
    const html = await fetchText(`https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`);
    const initialDataText = extractJsonObjectAfterMarker(html, [
      'var ytInitialData = ',
      'window["ytInitialData"] = ',
      'ytInitialData = '
    ]);

    if (!initialDataText) {
      continue;
    }

    const initialData = JSON.parse(initialDataText);
    collectVideoRenderers(initialData).forEach((candidate) => {
      if (!candidates.has(candidate.videoId)) {
        candidates.set(candidate.videoId, candidate);
      }
    });
  }

  return [...candidates.values()]
    .map((candidate) => ({
      ...candidate,
      score: scoreVideoCandidate(episode, candidate)
    }))
    .filter((candidate) => candidate.score >= MIN_CANDIDATE_SCORE)
    .sort((left, right) => right.score - left.score);
}

function chooseCaptionTrack(captionTracks) {
  return [...captionTracks].sort((left, right) => {
    const leftManual = left.kind === 'asr' ? 1 : 0;
    const rightManual = right.kind === 'asr' ? 1 : 0;
    if (leftManual !== rightManual) {
      return leftManual - rightManual;
    }

    const leftEnglish = String(left.languageCode || '').startsWith('en') ? 0 : 1;
    const rightEnglish = String(right.languageCode || '').startsWith('en') ? 0 : 1;
    if (leftEnglish !== rightEnglish) {
      return leftEnglish - rightEnglish;
    }

    return String(left.name?.simpleText || '').localeCompare(String(right.name?.simpleText || ''));
  })[0] || null;
}

function findTranscriptParams(node) {
  if (!node || typeof node !== 'object') {
    return '';
  }

  if (Array.isArray(node)) {
    for (const value of node) {
      const params = findTranscriptParams(value);
      if (params) {
        return params;
      }
    }
    return '';
  }

  const endpointParams = normalizeWhitespace(node?.getTranscriptEndpoint?.params || '');
  if (endpointParams) {
    return endpointParams;
  }

  for (const value of Object.values(node)) {
    const params = findTranscriptParams(value);
    if (params) {
      return params;
    }
  }

  return '';
}

async function getYouTubeTranscriptSource(videoId) {
  const html = await fetchText(`https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}&hl=en`);
  const apiKey = extractConfigValue(html, 'INNERTUBE_API_KEY');
  const clientVersion = extractConfigValue(html, 'INNERTUBE_CLIENT_VERSION');
  const initialDataText = extractJsonObjectAfterMarker(html, [
    'var ytInitialData = ',
    'window["ytInitialData"] = ',
    'ytInitialData = '
  ]);
  const playerResponseText = extractJsonObjectAfterMarker(html, [
    'var ytInitialPlayerResponse = ',
    'window["ytInitialPlayerResponse"] = ',
    'ytInitialPlayerResponse = '
  ]);

  if (initialDataText && apiKey && clientVersion) {
    const initialData = JSON.parse(initialDataText);
    const transcriptParams = findTranscriptParams(initialData);
    if (transcriptParams) {
      return {
        mode: 'endpoint',
        apiKey,
        clientVersion,
        params: transcriptParams
      };
    }
  }

  if (!playerResponseText) {
    throw new Error(`Could not find transcript source for YouTube video ${videoId}.`);
  }

  const playerResponse = JSON.parse(playerResponseText);
  const captionTracks = playerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks || [];
  const selectedTrack = chooseCaptionTrack(captionTracks);

  if (!selectedTrack?.baseUrl) {
    return null;
  }

  return {
    mode: 'caption-track',
    videoTitle: normalizeWhitespace(playerResponse?.videoDetails?.title || ''),
    channel: normalizeWhitespace(playerResponse?.videoDetails?.author || ''),
    track: selectedTrack
  };
}

function normalizeCaptionText(value) {
  return normalizeWhitespace(
    String(value ?? '')
      .replace(/\u00a0/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, '\'')
  );
}

function buildTranscriptChunksFromCaptionEvents(events) {
  const chunks = [];
  let currentChunk = null;

  function flushCurrentChunk() {
    if (!currentChunk || !currentChunk.text) {
      currentChunk = null;
      return;
    }

    const safeStartSeconds = Math.max(Math.floor(currentChunk.startMs / 1000), 0);
    const safeEndSeconds = Number.isFinite(currentChunk.endMs)
      ? Math.max(Math.ceil(currentChunk.endMs / 1000), safeStartSeconds)
      : null;

    chunks.push({
      startSeconds: safeStartSeconds,
      ...(safeEndSeconds !== null ? { endSeconds: safeEndSeconds } : {}),
      text: currentChunk.text
    });
    currentChunk = null;
  }

  events.forEach((event) => {
    const segments = Array.isArray(event?.segs) ? event.segs : [];
    const text = normalizeCaptionText(segments.map((segment) => segment.utf8 || '').join(''));

    if (!text || /^\[[^\]]+\]$/.test(text)) {
      return;
    }

    const startMs = Math.max(Number(event.tStartMs) || 0, 0);
    const durationMs = Math.max(Number(event.dDurationMs) || 0, 0);
    const endMs = startMs + durationMs;

    if (!currentChunk) {
      currentChunk = {
        startMs,
        endMs,
        text
      };
      return;
    }

    const gapMs = startMs - currentChunk.endMs;
    const nextText = `${currentChunk.text} ${text}`.trim();
    const shouldFlush = (
      gapMs > 2500
      || nextText.length > 320
      || /[.!?]["']?$/.test(currentChunk.text)
    );

    if (shouldFlush) {
      flushCurrentChunk();
      currentChunk = {
        startMs,
        endMs,
        text
      };
      return;
    }

    if (!currentChunk.text.endsWith(text)) {
      currentChunk.text = nextText;
    }
    currentChunk.endMs = Math.max(currentChunk.endMs, endMs);
  });

  flushCurrentChunk();

  return chunks.map((chunk) => ({
    ...chunk,
    startTimestamp: toTimestamp(chunk.startSeconds),
    ...(Number.isFinite(chunk.endSeconds) ? { endTimestamp: toTimestamp(chunk.endSeconds) } : {})
  }));
}

async function fetchTranscriptChunksForTrack(track) {
  const captionUrl = new URL(track.baseUrl);
  captionUrl.searchParams.set('fmt', 'json3');
  const rawResponse = await fetchText(captionUrl.toString());
  const payload = JSON.parse(rawResponse);
  return buildTranscriptChunksFromCaptionEvents(payload.events || []);
}

async function fetchYouTubeTranscriptEndpointPayload(source) {
  const proxyUrl = getConfiguredProxyUrl();

  if (proxyUrl) {
    const curlArguments = [
      '-sS',
      '-L',
      '--compressed',
      '--proxy',
      proxyUrl,
      '-X',
      'POST',
      '-H',
      'content-type: application/json',
      '-H',
      `user-agent: ${USER_AGENT}`,
      '-H',
      'x-youtube-client-name: 1',
      '-H',
      `x-youtube-client-version: ${source.clientVersion}`,
      '--data-raw',
      JSON.stringify({
        context: {
          client: {
            clientName: 'WEB',
            clientVersion: source.clientVersion,
            hl: 'en',
            gl: 'US'
          }
        },
        params: source.params
      }),
      `https://www.youtube.com/youtubei/v1/get_transcript?key=${encodeURIComponent(source.apiKey)}`
    ];
    const { stdout } = await execFileAsync('curl', curlArguments, {
      cwd: repoRoot,
      env: buildProxyEnvironment(),
      maxBuffer: 1024 * 1024 * 20
    });
    return JSON.parse(stdout);
  }

  const response = await fetch(`https://www.youtube.com/youtubei/v1/get_transcript?key=${encodeURIComponent(source.apiKey)}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'user-agent': USER_AGENT,
      'x-youtube-client-name': '1',
      'x-youtube-client-version': source.clientVersion
    },
    body: JSON.stringify({
      context: {
        client: {
          clientName: 'WEB',
          clientVersion: source.clientVersion,
          hl: 'en',
          gl: 'US'
        }
      },
      params: source.params
    })
  });

  if (!response.ok) {
    throw new Error(`Transcript endpoint request failed with ${response.status}.`);
  }

  return response.json();
}

function extractPythonHelperErrorMessage(error) {
  return normalizeWhitespace(
    error?.stderr
      || error?.stdout
      || error?.message
      || String(error)
  );
}

function isMissingPythonTranscriptDependency(message) {
  return message.includes("No module named 'youtube_transcript_api'");
}

async function fetchTranscriptChunksViaPython(videoId) {
  const pythonExecutables = [
    ...(existsSync(preferredPythonPath) ? [preferredPythonPath] : []),
    'python3',
    'python'
  ];
  const attemptErrors = [];

  for (const pythonExecutable of pythonExecutables) {
    try {
      const { stdout } = await execFileAsync(pythonExecutable, [pythonTranscriptHelperPath, videoId], {
        cwd: repoRoot,
        env: buildProxyEnvironment(),
        maxBuffer: 1024 * 1024 * 10
      });
      const payload = JSON.parse(stdout);
      const segments = Array.isArray(payload.segments) ? payload.segments : [];

      return buildTranscriptChunksFromCaptionEvents(segments.map((segment) => ({
        tStartMs: Math.max(Math.floor((Number(segment.start) || 0) * 1000), 0),
        dDurationMs: Math.max(Math.floor((Number(segment.duration) || 0) * 1000), 0),
        segs: [{ utf8: normalizeCaptionText(segment.text || '') }]
      })));
    } catch (error) {
      attemptErrors.push({
        executable: pythonExecutable,
        message: extractPythonHelperErrorMessage(error)
      });
    }
  }

  if (!attemptErrors.length) {
    throw new Error('No usable Python executable was found for YouTube transcript fetching.');
  }

  const preferredAttempt = attemptErrors.find((attempt) => (
    attempt.executable === preferredPythonPath
    && !isMissingPythonTranscriptDependency(attempt.message)
  ));
  const substantiveAttempt = attemptErrors.find((attempt) => !isMissingPythonTranscriptDependency(attempt.message));
  const selectedAttempt = preferredAttempt || substantiveAttempt || attemptErrors[0];
  const attemptSummary = attemptErrors
    .map((attempt) => `${attempt.executable}: ${attempt.message}`)
    .join(' | ');

  if (attemptErrors.every((attempt) => isMissingPythonTranscriptDependency(attempt.message))) {
    throw new Error(
      `Python transcript helper could not import youtube_transcript_api. Install requirements or use the wrapper script. Tried ${attemptSummary}`
    );
  }

  throw new Error(
    `Python transcript helper failed for ${videoId}. Preferred error from ${selectedAttempt.executable}: ${selectedAttempt.message}. Tried ${attemptSummary}`
  );
}

function collectTranscriptSegmentRenderers(node, segments = []) {
  if (!node || typeof node !== 'object') {
    return segments;
  }

  if (Array.isArray(node)) {
    node.forEach((value) => collectTranscriptSegmentRenderers(value, segments));
    return segments;
  }

  if (node.transcriptSegmentRenderer) {
    segments.push(node.transcriptSegmentRenderer);
  }

  Object.values(node).forEach((value) => collectTranscriptSegmentRenderers(value, segments));
  return segments;
}

async function fetchTranscriptChunksForSource(source) {
  if (source.mode === 'caption-track') {
    return fetchTranscriptChunksForTrack(source.track);
  }

  const payload = await fetchYouTubeTranscriptEndpointPayload(source);
  const segments = collectTranscriptSegmentRenderers(payload)
    .map((segment) => {
      const text = normalizeCaptionText(getText(segment.snippet));
      if (!text) {
        return null;
      }

      const startMs = Math.max(Number(segment.startMs) || 0, 0);
      const endMs = Math.max(Number(segment.endMs) || startMs, startMs);
      return {
        tStartMs: startMs,
        dDurationMs: Math.max(endMs - startMs, 0),
        segs: [{ utf8: text }]
      };
    })
    .filter(Boolean);

  return buildTranscriptChunksFromCaptionEvents(segments);
}

async function readJsonIfExists(filePath) {
  try {
    return JSON.parse(await readFile(filePath, 'utf8'));
  } catch (error) {
    if (error?.code === 'ENOENT') {
      return null;
    }

    throw error;
  }
}

function buildMetadataPayload(existingMetadata, episode, videoId) {
  return {
    ...(existingMetadata || {}),
    id: normalizeWhitespace(existingMetadata?.id || episode.id),
    title: normalizeWhitespace(existingMetadata?.title || episode.title),
    publishDate: normalizeWhitespace(existingMetadata?.publishDate || episode.publishDate),
    description: normalizeWhitespace(existingMetadata?.description || episode.description || ''),
    summary: normalizeWhitespace(existingMetadata?.summary || episode.summary || ''),
    durationSeconds: existingMetadata?.durationSeconds ?? episode.durationSeconds ?? null,
    durationLabel: normalizeWhitespace(existingMetadata?.durationLabel || episode.durationLabel || ''),
    guests: Array.isArray(existingMetadata?.guests) && existingMetadata.guests.length
      ? existingMetadata.guests
      : Array.isArray(episode.guests) ? episode.guests : [],
    topicTags: Array.isArray(existingMetadata?.topicTags) && existingMetadata.topicTags.length
      ? existingMetadata.topicTags
      : Array.isArray(episode.topicTags) ? episode.topicTags : [],
    youtubeId: normalizeWhitespace(videoId || existingMetadata?.youtubeId || episode.youtubeId || ''),
    officialPageUrl: normalizeWhitespace(existingMetadata?.officialPageUrl || episode.officialPageUrl || ''),
    fullEpisodeUrl: normalizeWhitespace(existingMetadata?.fullEpisodeUrl || episode.fullEpisodeUrl || ''),
    audioUrl: normalizeWhitespace(existingMetadata?.audioUrl || episode.audioUrl || ''),
    imageUrl: normalizeWhitespace(existingMetadata?.imageUrl || episode.imageUrl || '')
  };
}

function parseArguments(argv) {
  const options = {
    episodeIds: [],
    limit: DEFAULT_LIMIT,
    overwrite: false,
    replaceOutline: false,
    missingOnly: false,
    dryRun: false,
    verbose: false
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];

    if (argument === '--episode' || argument === '--id') {
      const episodeId = normalizeWhitespace(argv[index + 1] || '');
      if (episodeId) {
        options.episodeIds.push(episodeId);
      }
      index += 1;
      continue;
    }

    if (argument === '--limit') {
      const nextValue = Number.parseInt(argv[index + 1] || '', 10);
      if (Number.isFinite(nextValue) && nextValue > 0) {
        options.limit = nextValue;
      }
      index += 1;
      continue;
    }

    if (argument === '--overwrite') {
      options.overwrite = true;
      continue;
    }

    if (argument === '--replace-outline') {
      options.replaceOutline = true;
      continue;
    }

    if (argument === '--missing-only') {
      options.missingOnly = true;
      continue;
    }

    if (argument === '--dry-run') {
      options.dryRun = true;
      continue;
    }

    if (argument === '--verbose') {
      options.verbose = true;
    }
  }

  return options;
}

async function loadEpisodesIndex() {
  const payload = JSON.parse(await readFile(episodesIndexPath, 'utf8'));
  return Array.isArray(payload.episodes) ? payload.episodes : [];
}

function shouldTargetEpisode(episode, options) {
  if (options.episodeIds.length > 0) {
    return options.episodeIds.includes(episode.id);
  }

  if (options.missingOnly) {
    return !episode.transcriptAvailable;
  }

  if (options.replaceOutline) {
    return episode.transcriptSourceType !== 'structured-json' && episode.transcriptSourceType !== 'legacy-timestamped-text';
  }

  return !episode.transcriptAvailable;
}

async function backfillEpisodeTranscript(episode, options) {
  const transcriptDirectory = path.join(transcriptRoot, episode.id);
  const metadataPath = path.join(transcriptDirectory, 'metadata.json');
  const transcriptPath = path.join(transcriptDirectory, 'transcript.json');
  const existingTranscript = await readJsonIfExists(transcriptPath);

  if (existingTranscript && !options.overwrite) {
    return {
      status: 'skipped',
      reason: 'Transcript override already exists.',
      episodeId: episode.id
    };
  }

  const candidates = episode.youtubeId
    ? [{ videoId: episode.youtubeId, title: episode.title, channel: 'existing-metadata', score: 1000 }]
    : await searchYouTubeCandidates(episode);

  if (options.verbose && candidates.length) {
    console.log(`Top YouTube candidates for ${episode.id}:`);
    candidates.slice(0, 5).forEach((candidate, index) => {
      console.log(`  ${index + 1}. [${candidate.score.toFixed(1)}] ${candidate.videoId} | ${candidate.title} | ${candidate.channel}`);
    });
  }

  if (!candidates.length) {
    return {
      status: 'skipped',
      reason: 'No strong YouTube candidate found.',
      episodeId: episode.id
    };
  }

  for (const candidate of candidates.slice(0, 6)) {
    try {
      let chunks = [];

      try {
        chunks = await fetchTranscriptChunksViaPython(candidate.videoId);
      } catch (error) {
        if (options.verbose) {
          console.log(`  Python transcript helper failed for ${candidate.videoId}: ${error instanceof Error ? error.message : String(error)}`);
        }

        const transcriptSource = await getYouTubeTranscriptSource(candidate.videoId);
        if (!transcriptSource) {
          if (options.verbose) {
            console.log(`  Candidate ${candidate.videoId} has no transcript source.`);
          }
          continue;
        }

        chunks = await fetchTranscriptChunksForSource(transcriptSource);
      }

      if (!chunks.length) {
        if (options.verbose) {
          console.log(`  Candidate ${candidate.videoId} returned an empty transcript payload.`);
        }
        continue;
      }

      const existingMetadata = await readJsonIfExists(metadataPath);
      const metadataPayload = buildMetadataPayload(existingMetadata, episode, candidate.videoId);
      const transcriptPayload = {
        schemaVersion: 1,
        episodeId: episode.id,
        source: 'YouTube transcript',
        videoId: candidate.videoId,
        languageCode: 'en',
        chunks
      };

      if (!options.dryRun) {
        await mkdir(transcriptDirectory, { recursive: true });
        await writeFile(metadataPath, `${JSON.stringify(metadataPayload, null, 2)}\n`, 'utf8');
        await writeFile(transcriptPath, `${JSON.stringify(transcriptPayload, null, 2)}\n`, 'utf8');
      }

      return {
        status: 'written',
        episodeId: episode.id,
        videoId: candidate.videoId,
        chunkCount: chunks.length,
        trackKind: 'youtube',
        matchedTitle: candidate.title,
        matchedChannel: candidate.channel
      };
    } catch (error) {
      if (options.verbose) {
        console.log(`  Candidate ${candidate.videoId} failed: ${error instanceof Error ? error.message : String(error)}`);
      }
      continue;
    }
  }

  return {
    status: 'skipped',
    reason: 'YouTube candidates found, but captions were unavailable.',
    episodeId: episode.id
  };
}

async function run() {
  const options = parseArguments(process.argv.slice(2));
  const proxyUrl = getConfiguredProxyUrl();
  const episodes = await loadEpisodesIndex();
  const targetEpisodes = episodes
    .filter((episode) => shouldTargetEpisode(episode, options))
    .sort((left, right) => new Date(`${left.publishDate}T00:00:00`).getTime() - new Date(`${right.publishDate}T00:00:00`).getTime());
  const limitedEpisodes = Number.isFinite(options.limit) && options.limit !== null
    ? targetEpisodes.slice(0, options.limit)
    : targetEpisodes;

  if (!limitedEpisodes.length) {
    console.log('No All-In episodes matched the current YouTube transcript backfill filters.');
    return;
  }

  console.log(`Checking ${limitedEpisodes.length} All-In episode${limitedEpisodes.length === 1 ? '' : 's'} for YouTube transcript backfill...`);

  if (proxyUrl) {
    console.log('Using proxy configuration for YouTube transcript requests.');
  }

  const results = [];

  for (const episode of limitedEpisodes) {
    console.log(`Searching YouTube for ${episode.id} (${episode.title})`);
    const result = await backfillEpisodeTranscript(episode, options);
    results.push(result);

    if (result.status === 'written') {
      console.log(`Wrote ${result.chunkCount} caption chunk${result.chunkCount === 1 ? '' : 's'} for ${result.episodeId} from YouTube video ${result.videoId}.`);
    } else {
      console.log(`Skipped ${result.episodeId}: ${result.reason}`);
    }
  }

  const writtenCount = results.filter((result) => result.status === 'written').length;
  const skippedCount = results.filter((result) => result.status === 'skipped').length;
  console.log(`YouTube transcript backfill complete: ${writtenCount} written, ${skippedCount} skipped.`);
}

run().catch((error) => {
  console.error('fetchAllInPodcastYouTubeTranscripts failed:', error);
  process.exitCode = 1;
});
