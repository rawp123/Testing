export const DATA_ROOT = '/data/all-in-podcast-search';

const EPISODES_INDEX_URL = `${DATA_ROOT}/episodes/index.json`;
const episodeIndexPromise = fetch(EPISODES_INDEX_URL).then(async (response) => {
  if (!response.ok) {
    throw new Error(`Episode index request failed with ${response.status}`);
  }

  return response.json();
});
const episodeCache = new Map();

export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function formatDate(value) {
  if (!value) {
    return 'Unknown date';
  }

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  }).format(new Date(`${value}T00:00:00`));
}

export function formatTimestamp(totalSeconds) {
  const seconds = Math.max(Number(totalSeconds) || 0, 0);
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainder = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`;
  }

  return `${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`;
}

function parseTimestampToSeconds(value) {
  if (Number.isFinite(Number(value))) {
    return Math.max(Math.floor(Number(value)), 0);
  }

  const normalized = String(value ?? '').trim();
  if (!normalized) {
    return null;
  }

  const parts = normalized.split(':').map((part) => Number.parseInt(part, 10));
  if (!parts.length || parts.some((part) => !Number.isFinite(part) || part < 0)) {
    return null;
  }

  if (parts.length === 2) {
    const [minutes, seconds] = parts;
    return (minutes * 60) + seconds;
  }

  if (parts.length === 3) {
    const [hours, minutes, seconds] = parts;
    return (hours * 3600) + (minutes * 60) + seconds;
  }

  return null;
}

function buildFallbackChunkId(episodeId, startSeconds, chunkIndex) {
  const safeEpisodeId = String(episodeId || 'episode').trim() || 'episode';
  const safeSeconds = Math.max(Number(startSeconds) || 0, 0);
  return `${safeEpisodeId}-chunk-${String(safeSeconds).padStart(5, '0')}-${String(chunkIndex + 1).padStart(2, '0')}`;
}

function normalizeEpisodeChunk(chunk, chunkIndex, episodeId) {
  const startSeconds = parseTimestampToSeconds(chunk?.startSeconds ?? chunk?.startTimestamp);
  const endSeconds = parseTimestampToSeconds(chunk?.endSeconds ?? chunk?.endTimestamp);
  const normalizedStartSeconds = startSeconds ?? 0;
  const normalizedEndSeconds = endSeconds !== null ? endSeconds : null;

  return {
    ...chunk,
    id: chunk?.id || buildFallbackChunkId(episodeId, normalizedStartSeconds, chunkIndex),
    startSeconds: normalizedStartSeconds,
    startTimestamp: chunk?.startTimestamp || formatTimestamp(normalizedStartSeconds),
    endSeconds: normalizedEndSeconds,
    endTimestamp: chunk?.endTimestamp || (normalizedEndSeconds !== null ? formatTimestamp(normalizedEndSeconds) : '')
  };
}

export function buildMomentUrl(episodeId, startSeconds, chunkId, options = {}) {
  const baseUrl = new URL('/all-in-podcast-search/all-in/episode/', window.location.origin);
  baseUrl.searchParams.set('id', episodeId);

  if (Number.isFinite(Number(startSeconds))) {
    baseUrl.searchParams.set('t', String(Math.max(Math.floor(Number(startSeconds)), 0)));
  }

  if (chunkId) {
    baseUrl.hash = chunkId;
  }

  if (options.autoplay) {
    baseUrl.searchParams.set('play', '1');
  } else {
    baseUrl.searchParams.delete('play');
  }

  if (options.query) {
    baseUrl.searchParams.set('q', options.query);
  } else {
    baseUrl.searchParams.delete('q');
  }

  return `${baseUrl.pathname}${baseUrl.search}${baseUrl.hash}`;
}

export function buildEpisodeUrl(episodeId, options = {}) {
  const baseUrl = new URL('/all-in-podcast-search/all-in/episode/', window.location.origin);
  baseUrl.searchParams.set('id', episodeId);

  if (options.query) {
    baseUrl.searchParams.set('q', options.query);
  }

  return `${baseUrl.pathname}${baseUrl.search}`;
}

export function findChunkForTime(chunks, totalSeconds) {
  if (!Array.isArray(chunks) || !chunks.length) {
    return null;
  }

  const safeSeconds = Math.max(Number(totalSeconds) || 0, 0);

  for (let index = 0; index < chunks.length; index += 1) {
    const chunk = chunks[index];
    const chunkStart = Math.max(Number(chunk.startSeconds) || 0, 0);
    const chunkEnd = Number.isFinite(Number(chunk.endSeconds))
      ? Math.max(Number(chunk.endSeconds) || 0, 0)
      : Number.POSITIVE_INFINITY;

    if (safeSeconds >= chunkStart && safeSeconds < chunkEnd) {
      return chunk;
    }
  }

  return chunks[chunks.length - 1];
}

export async function loadEpisodesIndex() {
  const payload = await episodeIndexPromise;
  return Array.isArray(payload.episodes) ? payload.episodes : [];
}

export async function loadEpisodesCatalog() {
  return episodeIndexPromise;
}

export async function loadEpisodeById(episodeId) {
  if (!episodeId) {
    throw new Error('Episode id is required.');
  }

  if (!episodeCache.has(episodeId)) {
    const episodeList = await loadEpisodesIndex();
    const episodeSummary = episodeList.find((episode) => episode.id === episodeId);
    const dataFile = episodeSummary?.dataFile || `${DATA_ROOT}/episodes/${episodeId}.json`;

    const episodePromise = fetch(dataFile).then(async (response) => {
      if (!response.ok) {
        throw new Error(`Episode request failed with ${response.status}`);
      }

      const payload = await response.json();
      const chunks = Array.isArray(payload.chunks)
        ? payload.chunks.map((chunk, chunkIndex) => normalizeEpisodeChunk(chunk, chunkIndex, episodeId))
        : [];
      const chunkMap = Object.fromEntries(chunks.map((chunk) => [chunk.id, chunk]));
      return {
        ...payload,
        chunks,
        chunkMap
      };
    });

    episodeCache.set(episodeId, episodePromise);
  }

  return episodeCache.get(episodeId);
}

export function getTimeFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return Number(params.get('t')) || 0;
}

export function shouldAutoplayFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get('play') === '1';
}

export function getSearchQueryFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get('q') || '';
}
