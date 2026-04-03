import { constants as fsConstants } from 'node:fs';
import { access, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { load } from 'cheerio';

const SCHEMA_VERSION = 4;
const MAX_SEGMENT_CHARACTERS = 280;
const MAX_SEGMENT_SENTENCES = 3;

const repoRoot = process.cwd();
const rawRoot = path.join(repoRoot, 'scripts', 'podcasts', 'all-in', 'raw');
const archiveFeedPath = path.join(rawRoot, 'archive', 'feed.xml');
const transcriptRoot = path.join(rawRoot, 'transcripts');
const outputBaseRoot = path.join(repoRoot, 'data', 'all-in-podcast-search');
const outputEpisodesRoot = path.join(outputBaseRoot, 'episodes');
const pagefindSourceRoot = path.join(repoRoot, 'all-in-podcast-search', 'pagefind-source');
const HOST_NAMES = new Set([
  'Jason Calacanis',
  'Chamath Palihapitiya',
  'David Sacks',
  'David Friedberg',
  'The Besties',
  'Besties',
  'Jason',
  'Chamath',
  'Sacks',
  'Friedberg'
]);
const GENERIC_GUEST_LABELS = new Set([
  'The Besties',
  'Besties',
  'The Pod',
  'Pod',
  'All-In',
  'All In',
  'Guests',
  'Guest',
  'Host',
  'Hosts'
]);
const NON_PERSON_GUESTS = new Set([
  'AI',
  'Anthropic',
  'CFTC',
  'The SEC',
  'China',
  'AI Browsers',
  'All-In Summit',
  'Bestie Awards',
  'Bestie Guestie',
  'Bestie Guestie Brad Gerstner',
  'Elon\'s Third Party',
  'Fed Hesitates',
  'Groq-Nvidia Deal',
  'Home Affordability Crisis',
  'Israel-Hamas War',
  'Jony Ive\'s IO',
  'LA\'s Wildfire Disaster',
  'MP Materials',
  'Palantir\'s Advantage',
  'Pear VC',
  'Congress',
  'California Forever',
  'Autonomous Robots',
  'Big Short',
  'Banter',
  'Bitter Lesson',
  'California Asset Seizure',
  'College Crisis',
  'CZ\'s Untold Story',
  'Epstein Files Flop',
  'Epstein Files Special',
  'Future of Everything'
]);
const TOPIC_PATTERNS = [
  { label: 'AI', patterns: [/\bAI\b/i, /\bartificial intelligence\b/i, /\bagentic\b/i] },
  { label: 'OpenAI', patterns: [/\bOpenAI\b/i, /\bChatGPT\b/i, /\bGPT-5\b/i, /\bSam Altman\b/i] },
  { label: 'Anthropic', patterns: [/\bAnthropic\b/i, /\bClaude\b/i] },
  { label: 'Google', patterns: [/\bGoogle\b/i, /\bAlphabet\b/i, /\bYouTube\b/i, /\bDeepMind\b/i] },
  { label: 'Meta', patterns: [/\bMeta\b/i, /\bFacebook\b/i, /\bInstagram\b/i, /\bZuck\b/i, /\bZuckerberg\b/i] },
  { label: 'Nvidia', patterns: [/\bNvidia\b/i, /\bJensen Huang\b/i, /\bGPU\b/i] },
  { label: 'Tesla', patterns: [/\bTesla\b/i, /\bElon Musk\b/i, /\bOptimus\b/i, /\bRobotaxi\b/i] },
  { label: 'Crypto', patterns: [/\bcrypto\b/i, /\bblockchain\b/i, /\btoken\b/i, /\bstablecoin\b/i] },
  { label: 'Bitcoin', patterns: [/\bBitcoin\b/i, /\bBTC\b/i] },
  { label: 'Politics', patterns: [/\bTrump\b/i, /\bBiden\b/i, /\belection/i, /\bDemocrat/i, /\bRepublican/i, /\bCongress\b/i, /\bWhite House\b/i] },
  { label: 'Markets', patterns: [/\bmarket\b/i, /\bstocks?\b/i, /\bS&P\b/i, /\bnasdaq\b/i, /\bearnings\b/i, /\brecession\b/i] },
  { label: 'Venture capital', patterns: [/\bVC\b/i, /\bventure capital\b/i, /\bstartup\b/i, /\bunicorn\b/i] },
  { label: 'Media', patterns: [/\bmedia\b/i, /\bHollywood\b/i, /\bNetflix\b/i, /\bcreator\b/i, /\bcensorship\b/i, /\bsocial media\b/i] },
  { label: 'Search', patterns: [/\bsearch\b/i, /\bPerplexity\b/i] },
  { label: 'Datacenters', patterns: [/\bdatacenter/i, /\bdata center/i, /\bcompute\b/i, /\bCoreWeave\b/i] },
  { label: 'Infrastructure', patterns: [/\binfrastructure\b/i, /\bpower\b/i, /\bgrid\b/i] },
  { label: 'Energy', patterns: [/\benergy\b/i, /\boil\b/i, /\bnuclear\b/i, /\bsolar\b/i, /\bpower\b/i] },
  { label: 'Defense', patterns: [/\bwar\b/i, /\bPentagon\b/i, /\bdefense\b/i, /\bmilitary\b/i, /\bdrones?\b/i] },
  { label: 'China', patterns: [/\bChina\b/i, /\bChinese\b/i, /\bTaiwan\b/i] },
  { label: 'Iran', patterns: [/\bIran\b/i] },
  { label: 'Israel', patterns: [/\bIsrael\b/i, /\bGaza\b/i, /\bHamas\b/i] },
  { label: 'Ukraine', patterns: [/\bUkraine\b/i, /\bRussia\b/i, /\bPutin\b/i] },
  { label: 'Healthcare', patterns: [/\bhealthcare\b/i, /\bFDA\b/i, /\bmedical\b/i, /\bdrug\b/i, /\bOzempic\b/i] },
  { label: 'Regulation', patterns: [/\bregulation\b/i, /\bFTC\b/i, /\bSEC\b/i, /\bDOJ\b/i, /\bantitrust\b/i] },
  { label: 'IPOs', patterns: [/\bIPO\b/i, /\bpublic markets\b/i] },
  { label: 'Tariffs', patterns: [/\btariff/i, /\btrade war\b/i] },
  { label: 'Autonomy', patterns: [/\bautonomous\b/i, /\bself-driving\b/i, /\bWaymo\b/i, /\brobotaxi\b/i] },
  { label: 'Robotics', patterns: [/\brobot/i, /\bOptimus\b/i] },
  { label: 'Founders', patterns: [/\bfounder/i, /\bCEO\b/i, /\bentrepreneur/i] }
];

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function pad(value) {
  return String(value).padStart(2, '0');
}

function toTimestamp(totalSeconds) {
  const safeSeconds = Math.max(0, Math.floor(Number(totalSeconds) || 0));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = safeSeconds % 60;

  if (hours > 0) {
    return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  }

  return `${pad(minutes)}:${pad(seconds)}`;
}

function toSeconds(timecode) {
  const parts = String(timecode).split(':').map((part) => Number(part));
  if (parts.some((part) => !Number.isFinite(part))) {
    throw new Error(`Invalid timecode "${timecode}"`);
  }

  if (parts.length === 3) {
    return (parts[0] * 3600) + (parts[1] * 60) + parts[2];
  }

  if (parts.length === 2) {
    return (parts[0] * 60) + parts[1];
  }

  throw new Error(`Unsupported timecode "${timecode}"`);
}

function normalizeInlineWhitespace(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function splitParagraphs(lines) {
  const paragraphs = [];
  let current = [];

  lines.forEach((line) => {
    if (!line.trim()) {
      if (current.length) {
        paragraphs.push(current.join(' '));
        current = [];
      }
      return;
    }

    current.push(line.trim());
  });

  if (current.length) {
    paragraphs.push(current.join(' '));
  }

  return paragraphs
    .map((paragraph) => normalizeInlineWhitespace(paragraph))
    .filter(Boolean);
}

function splitIntoSentences(text) {
  const compactText = normalizeInlineWhitespace(text);
  if (!compactText) {
    return [];
  }

  return compactText
    .split(/(?<=[.!?])\s+(?=[A-Z0-9"'(\[])/)
    .map((sentence) => normalizeInlineWhitespace(sentence))
    .filter(Boolean);
}

function splitLongSentence(sentence) {
  const words = normalizeInlineWhitespace(sentence).split(' ').filter(Boolean);
  if (!words.length) {
    return [];
  }

  const pieces = [];
  let current = '';

  words.forEach((word) => {
    const next = current ? `${current} ${word}` : word;
    if (next.length > MAX_SEGMENT_CHARACTERS && current) {
      pieces.push(current);
      current = word;
      return;
    }

    current = next;
  });

  if (current) {
    pieces.push(current);
  }

  return pieces;
}

function packSentencesIntoSegments(sentences) {
  const preparedSentences = sentences.flatMap((sentence) => {
    if (sentence.length <= MAX_SEGMENT_CHARACTERS) {
      return [sentence];
    }

    return splitLongSentence(sentence);
  });

  const segments = [];
  let current = [];
  let currentLength = 0;

  preparedSentences.forEach((sentence) => {
    const nextLength = currentLength + sentence.length + (current.length ? 1 : 0);
    if (
      current.length &&
      (current.length >= MAX_SEGMENT_SENTENCES || nextLength > MAX_SEGMENT_CHARACTERS)
    ) {
      segments.push(current.join(' '));
      current = [sentence];
      currentLength = sentence.length;
      return;
    }

    current.push(sentence);
    currentLength = nextLength;
  });

  if (current.length) {
    segments.push(current.join(' '));
  }

  return segments.map((segment) => normalizeInlineWhitespace(segment)).filter(Boolean);
}

function normalizeTranscriptSegments(lines) {
  const paragraphs = splitParagraphs(lines);
  const segments = paragraphs.flatMap((paragraph) => {
    if (paragraph.length <= MAX_SEGMENT_CHARACTERS) {
      return [paragraph];
    }

    const sentences = splitIntoSentences(paragraph);
    if (sentences.length <= 1) {
      return splitLongSentence(paragraph);
    }

    return packSentencesIntoSegments(sentences);
  });

  return segments.filter(Boolean);
}

function buildExcerpt(text) {
  const normalized = normalizeInlineWhitespace(text);
  if (normalized.length <= 140) {
    return normalized;
  }

  const truncated = normalized.slice(0, 140);
  return `${truncated.replace(/\s+\S*$/, '')}...`;
}

function buildChunkId(episodeSlug, startSeconds, segmentIndex) {
  return `${episodeSlug}-${String(startSeconds).padStart(5, '0')}-${String(segmentIndex).padStart(2, '0')}`;
}

function parseOptionalDuration(rawMetadata) {
  if (Number.isFinite(Number(rawMetadata.durationSeconds))) {
    const durationSeconds = Math.max(Math.floor(Number(rawMetadata.durationSeconds)), 0);
    return {
      durationSeconds,
      durationLabel: toTimestamp(durationSeconds)
    };
  }

  const durationValue = normalizeInlineWhitespace(rawMetadata.duration || '');
  if (durationValue) {
    const durationSeconds = toSeconds(durationValue);
    return {
      durationSeconds,
      durationLabel: toTimestamp(durationSeconds)
    };
  }

  return {
    durationSeconds: null,
    durationLabel: ''
  };
}

function normalizeStringArray(value) {
  if (Array.isArray(value)) {
    return value.map((entry) => normalizeInlineWhitespace(entry)).filter(Boolean);
  }

  return [];
}

function uniqueNormalizedNames(names) {
  const seen = new Set();
  const result = [];

  names.forEach((name) => {
    const normalized = normalizeInlineWhitespace(name);
    if (!normalized) {
      return;
    }

    const key = normalized.toLowerCase();
    if (seen.has(key)) {
      return;
    }

    seen.add(key);
    result.push(normalized);
  });

  return result;
}

function isLikelyPersonName(value) {
  const normalized = normalizeInlineWhitespace(value);
  if (!normalized) {
    return false;
  }

  if (normalized !== 'CZ' && normalized.split(' ').length < 2) {
    return false;
  }

  return /^[A-Z][A-Za-z'.-]+(?: (?:[A-Z](?:\.)?|[A-Z][A-Za-z'.-]+)){1,5}$/.test(normalized);
}

function isLikelyNonPersonGuestLabel(value) {
  const normalized = normalizeInlineWhitespace(value);
  if (!normalized) {
    return true;
  }

  return [
    /\b(?:Las Vegas|Miami|Austin|Texas|California|Davos|Washington)\b/i,
    /\b(?:Summit|Playlist|Podcast|Pod|Episode|Show|Panel|Roundtable|Debate|Forum|Conference)\b/i,
    /\b(?:Hotel|Resort|Casino|Venetian|University|College|House|Capital)\b/i
  ].some((pattern) => pattern.test(normalized));
}

function cleanGuestName(value) {
  let normalized = normalizeInlineWhitespace(value)
    .replace(/&amp;/gi, '&')
    .replace(/^bestie guestie\s+/i, '')
    .replace(/^the\s+/i, '')
    .replace(/^(?:legendary|special|surprise)\s+/i, '')
    .replace(/^(?:the\s+)?(?:besties\s+welcome\s+)?/i, '')
    .replace(/^(?:live from|recorded live from|live at|recorded live at)\s+/i, '')
    .replace(/^(?:[A-Z][A-Za-z0-9&'.-]+(?: [A-Z][A-Za-z0-9&'.-]+){0,5})'s\s+/i, '')
    .replace(/^(?:dr|mr|mrs|ms|senator|governor|president|prince|professor|rep)\.?\s+/i, '')
    .replace(/^(?:(?:[A-Z][a-z]+(?: [A-Z][a-z]+){0,3})\s+secretary)\s+/i, '')
    .replace(/^(?:under secretary of [a-z ]+)\s+/i, '')
    .replace(/^(?:[A-Z][a-z]+ CEO(?:'s)?|CEO(?:'s)?|[A-Z][a-z]+ founder|founder)\s+/i, '')
    .replace(/^war\s+/i, '')
    .replace(/^(?:harvard professor)\s+/i, '')
    .replace(/^(?:sec's|cftc's)\s+/i, '')
    .replace(/\s+\([^)]*\)\s*$/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();

  const tokens = normalized.split(/\s+/).filter(Boolean);
  if (tokens.length > 2) {
    for (let width = Math.min(tokens.length, 4); width >= 2; width -= 1) {
      const candidate = tokens.slice(-width).join(' ');
      if (isLikelyPersonName(candidate)) {
        normalized = candidate;
        break;
      }
    }
  }

  normalized = normalized
    .replace(/^war\s+/i, '')
    .replace(/^materials CEO\s+/i, '')
    .trim();

  if (!normalized) {
    return '';
  }

  if (isLikelyNonPersonGuestLabel(normalized)) {
    return '';
  }

  if (HOST_NAMES.has(normalized) || GENERIC_GUEST_LABELS.has(normalized) || NON_PERSON_GUESTS.has(normalized)) {
    return '';
  }

  if (normalized !== 'CZ' && normalized.split(' ').length < 2) {
    return '';
  }

  if (!isLikelyPersonName(normalized)) {
    return '';
  }

  return normalized;
}

function splitGuestCandidates(value) {
  const normalized = normalizeInlineWhitespace(value)
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\s+\b(?:and|with|featuring|feat\.?|ft\.?)\b\s+/gi, ' & ')
    .replace(/\s*,\s*/g, ' & ');

  return uniqueNormalizedNames(normalized
    .split(/\s*&\s*/)
    .map((entry) => cleanGuestName(entry))
    .filter(Boolean));
}

function inferGuestsFromParagraph(paragraph) {
  const compact = normalizeInlineWhitespace(paragraph);
  if (!compact) {
    return [];
  }

  const matches = [];
  const patternHandlers = [
    /^follow ([^:]+):/i,
    /^featuring\s+(.+?)(?:!|\.|;|$)/i,
    /(?:welcome|welcomes|welcomed|intro(?:s|duces)?|introduces)\s+(.+?)(?:!|\.|,|;|$)/i,
    /(.+?) joins the show!?$/i,
    /^guest intros?:?\s+.+?\s+introduces\s+(.+?)(?:!|\.|,|;|$)/i
  ];

  patternHandlers.forEach((pattern) => {
    const match = compact.match(pattern);
    if (!match) {
      return;
    }

    matches.push(...splitGuestCandidates(match[1]));
  });

  return uniqueNormalizedNames(matches);
}

function inferGuestsFromTitle(title) {
  const compact = normalizeInlineWhitespace(title).replace(/&amp;/gi, '&');
  const candidates = [];

  const directPatterns = [
    /^(.+?)\s+on\b/i,
    /^(.+?)\s+live\b/i,
    /(?:^| )with\s+(.+)$/i,
    /^how\s+(.+?)\s+thinks\b/i
  ];

  directPatterns.forEach((pattern) => {
    const match = compact.match(pattern);
    if (!match) {
      return;
    }

    candidates.push(...splitGuestCandidates(match[1]));
  });

  return uniqueNormalizedNames(candidates);
}

function inferGuestsFromArchiveMetadata(title, paragraphs) {
  const paragraphGuests = uniqueNormalizedNames(paragraphs.flatMap((paragraph) => inferGuestsFromParagraph(paragraph)));
  if (paragraphGuests.length) {
    return paragraphGuests;
  }

  return uniqueNormalizedNames(inferGuestsFromTitle(title));
}

function inferTopicsFromArchiveMetadata(title, paragraphs) {
  const sourceText = normalizeInlineWhitespace([title, ...paragraphs.slice(0, 8)].join(' '));
  const topics = [];

  TOPIC_PATTERNS.forEach((entry) => {
    if (entry.patterns.some((pattern) => pattern.test(sourceText))) {
      topics.push(entry.label);
    }
  });

  return uniqueNormalizedNames(topics).slice(0, 5);
}

function toOptionalSeconds(timecode, label) {
  if (timecode === null || timecode === undefined || timecode === '') {
    return null;
  }

  if (Number.isFinite(Number(timecode))) {
    return Math.max(Math.floor(Number(timecode)), 0);
  }

  const normalized = normalizeInlineWhitespace(timecode);
  if (!normalized) {
    return null;
  }

  try {
    return toSeconds(normalized);
  } catch (error) {
    throw new Error(`${label}: ${error.message}`);
  }
}

function parseSpeakerPrefix(text) {
  const compactText = normalizeInlineWhitespace(text);
  const speakerMatch = compactText.match(/^([A-Z][A-Za-z0-9.'&/ -]{1,48}):\s+(.+)$/);
  if (!speakerMatch) {
    return {
      speaker: '',
      text: compactText
    };
  }

  return {
    speaker: normalizeInlineWhitespace(speakerMatch[1]),
    text: normalizeInlineWhitespace(speakerMatch[2])
  };
}

function buildChunksFromSourceBlocks(sourceBlocks, episodeId) {
  if (!sourceBlocks.length) {
    throw new Error(`Transcript for ${episodeId} does not contain any timestamped lines.`);
  }

  sourceBlocks.forEach((block, index) => {
    const previous = sourceBlocks[index - 1];
    if (previous && block.startSeconds < previous.startSeconds) {
      throw new Error(`Transcript for ${episodeId} has out-of-order timestamps near ${block.rawTimestamp || block.startTimestamp || toTimestamp(block.startSeconds)}.`);
    }
  });

  const episodeSlug = slugify(episodeId);
  const chunks = [];

  sourceBlocks.forEach((block, blockIndex) => {
    const nextBlock = sourceBlocks[blockIndex + 1];
    const nextStartSeconds = nextBlock ? nextBlock.startSeconds : null;
    const endSeconds = block.endSeconds ?? nextStartSeconds ?? null;
    const normalizedSegments = normalizeTranscriptSegments(block.lines);

    if (!normalizedSegments.length) {
      return;
    }

    normalizedSegments.forEach((text, segmentIndex) => {
      const stableSegmentIndex = segmentIndex + 1;
      chunks.push({
        id: buildChunkId(episodeSlug, block.startSeconds, stableSegmentIndex),
        sequence: chunks.length + 1,
        sourceBlockIndex: blockIndex + 1,
        segmentIndex: stableSegmentIndex,
        segmentCount: normalizedSegments.length,
        startSeconds: block.startSeconds,
        startTimestamp: toTimestamp(block.startSeconds),
        sourceStartSeconds: block.startSeconds,
        sourceStartTimestamp: toTimestamp(block.startSeconds),
        endSeconds,
        endTimestamp: endSeconds !== null ? toTimestamp(endSeconds) : '',
        speaker: normalizeInlineWhitespace(block.speaker || ''),
        text,
        excerpt: normalizeInlineWhitespace(block.excerpt || '') || buildExcerpt(text)
      });
    });
  });

  if (!chunks.length) {
    throw new Error(`Transcript for ${episodeId} did not produce any usable chunks.`);
  }

  return chunks;
}

function parseTranscriptText(rawTranscript, episodeId) {
  const lines = rawTranscript.split(/\r?\n/);
  const sourceBlocks = [];
  let currentBlock = null;

  lines.forEach((line) => {
    const match = line.match(/^\[(\d{2}:\d{2}(?::\d{2})?)\]\s*(.*)$/);
    if (match) {
      if (currentBlock) {
        sourceBlocks.push(currentBlock);
      }

      currentBlock = {
        rawTimestamp: match[1],
        startSeconds: toSeconds(match[1]),
        lines: match[2] ? [match[2]] : []
      };
      return;
    }

    if (currentBlock) {
      currentBlock.lines.push(line);
    }
  });

  if (currentBlock) {
    sourceBlocks.push(currentBlock);
  }

  return buildChunksFromSourceBlocks(sourceBlocks.map((block) => {
    const initialLine = block.lines[0] || '';
    const speakerInfo = parseSpeakerPrefix(initialLine);
    return {
      ...block,
      speaker: speakerInfo.speaker,
      lines: [
        speakerInfo.text,
        ...block.lines.slice(1)
      ]
    };
  }), episodeId);
}

function parseStructuredTranscript(rawTranscript, episodeId) {
  let payload;

  try {
    payload = JSON.parse(rawTranscript);
  } catch (error) {
    throw new Error(`Structured transcript for ${episodeId} is not valid JSON.`);
  }

  if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
    if (payload.episodeId && normalizeInlineWhitespace(payload.episodeId) !== episodeId) {
      throw new Error(`Structured transcript for ${episodeId} has mismatched episodeId "${payload.episodeId}".`);
    }

    if (payload.schemaVersion && !Number.isFinite(Number(payload.schemaVersion))) {
      throw new Error(`Structured transcript for ${episodeId} has an invalid schemaVersion.`);
    }
  }

  const sourceEntries = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.chunks)
      ? payload.chunks
      : Array.isArray(payload?.segments)
        ? payload.segments
        : null;

  if (!sourceEntries) {
    throw new Error(`Structured transcript for ${episodeId} must be an array or contain a "chunks" array.`);
  }

  const sourceBlocks = sourceEntries.map((entry, index) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      throw new Error(`Structured transcript for ${episodeId} has an invalid chunk at index ${index}.`);
    }

    const startSeconds = toOptionalSeconds(entry.startSeconds ?? entry.startTimestamp, `Chunk ${index + 1}`);
    if (startSeconds === null) {
      throw new Error(`Structured transcript for ${episodeId} is missing a start timestamp at chunk ${index + 1}.`);
    }

    const normalizedText = normalizeInlineWhitespace(entry.text || '');
    if (!normalizedText) {
      throw new Error(`Structured transcript for ${episodeId} is missing text at chunk ${index + 1}.`);
    }

    const speaker = normalizeInlineWhitespace(entry.speaker || '');

    return {
      startSeconds,
      rawTimestamp: normalizeInlineWhitespace(entry.startTimestamp || ''),
      endSeconds: toOptionalSeconds(entry.endSeconds ?? entry.endTimestamp, `Chunk ${index + 1} end timestamp`),
      speaker,
      excerpt: normalizeInlineWhitespace(entry.excerpt || ''),
      lines: [normalizedText]
    };
  });

  return buildChunksFromSourceBlocks(sourceBlocks, episodeId);
}

function pathExists(targetPath) {
  return access(targetPath, fsConstants.F_OK)
    .then(() => true)
    .catch(() => false);
}

function extractEpisodeNumber(title) {
  const patterns = [
    /\bEpisode\s*#\s*(\d+)\b/i,
    /\bE(\d+)\b/i
  ];

  for (const pattern of patterns) {
    const match = String(title).match(pattern);
    if (match) {
      return Number(match[1]);
    }
  }

  return null;
}

function stripHtml(markup) {
  const fragment = load(`<div>${markup || ''}</div>`);
  return normalizeInlineWhitespace(fragment.text());
}

function extractContentParagraphs(markup) {
  const fragment = load(`<div>${markup || ''}</div>`);
  const paragraphs = fragment('p')
    .map((_, element) => normalizeInlineWhitespace(fragment(element).text()))
    .get()
    .filter(Boolean);

  if (paragraphs.length) {
    return paragraphs;
  }

  const plainText = stripHtml(markup);
  return plainText ? [plainText] : [];
}

function isBoilerplateParagraph(paragraph) {
  const compact = normalizeInlineWhitespace(paragraph);
  return [
    /^follow\b/i,
    /^thanks to our partner/i,
    /^thanks to our partners/i,
    /^thanks to our sponsors/i,
    /^thanks to /i,
    /^intro music credit/i,
    /^intro video credit/i,
    /^referenced in the show/i,
    /^take the survey/i,
    /^apply for /i,
    /^watch \| listen \| subscribe/i,
    /^#allin\b/i,
    /^https?:\/\//i
  ].some((pattern) => pattern.test(compact));
}

function summarizeParagraphs(paragraphs, maxCharacters) {
  const cleaned = paragraphs
    .map((paragraph) => normalizeInlineWhitespace(paragraph))
    .filter(Boolean)
    .filter((paragraph) => !isBoilerplateParagraph(paragraph));

  const joined = cleaned.join(' ');
  if (!joined) {
    return '';
  }

  if (joined.length <= maxCharacters) {
    return joined;
  }

  const truncated = joined.slice(0, maxCharacters);
  return `${truncated.replace(/\s+\S*$/, '')}...`;
}

function trimTimelineBoilerplate(text) {
  const compact = normalizeInlineWhitespace(text);
  if (!compact) {
    return '';
  }

  const markers = [
    /\bFollow the besties:\b/i,
    /\bFollow on X:\b/i,
    /\bFollow on Instagram:\b/i,
    /\bFollow on TikTok:\b/i,
    /\bFollow on LinkedIn:\b/i,
    /\bThanks to our partner/i,
    /\bThanks to our partners/i,
    /\bThanks to our sponsors/i,
    /\bIntro Music Credit:\b/i,
    /\bIntro Video Credit:\b/i,
    /\bReferenced in the show:\b/i,
    /\bTake the survey\b/i,
    /\bApply for\b/i,
    /\bWatch \| Listen \| Subscribe\b/i
  ];

  let cutoffIndex = compact.length;
  markers.forEach((pattern) => {
    const match = compact.match(pattern);
    if (!match || typeof match.index !== 'number') {
      return;
    }

    cutoffIndex = Math.min(cutoffIndex, match.index);
  });

  return normalizeInlineWhitespace(compact.slice(0, cutoffIndex));
}

function parseDescriptionOutlineChunks(markup, episodeId) {
  const trimmedText = trimTimelineBoilerplate(stripHtml(markup));
  if (!trimmedText) {
    return [];
  }

  const timestampPattern = /\((\d{1,2}:\d{2}(?::\d{2})?)\)\s*/g;
  const matches = [...trimmedText.matchAll(timestampPattern)];
  if (!matches.length) {
    return [];
  }

  const chunks = [];

  matches.forEach((match, index) => {
    const timestamp = match[1];
    const matchIndex = match.index ?? 0;
    const contentStart = matchIndex + match[0].length;
    const nextMatchIndex = matches[index + 1]?.index ?? trimmedText.length;
    const text = normalizeInlineWhitespace(trimmedText.slice(contentStart, nextMatchIndex))
      .replace(/^[\-:;,.\s]+/, '')
      .replace(/[\-:;,.\s]+$/, '');

    if (!text) {
      return;
    }

    const startSeconds = toSeconds(timestamp);
    const nextTimestamp = matches[index + 1]?.[1] || '';
    const endSeconds = nextTimestamp ? toSeconds(nextTimestamp) : null;

    chunks.push({
      startTimestamp: toTimestamp(startSeconds),
      ...(endSeconds !== null ? { endTimestamp: toTimestamp(endSeconds) } : {}),
      text
    });
  });

  return chunks;
}

function normalizeArchiveEpisode(item) {
  const title = normalizeInlineWhitespace(item.title);
  const link = normalizeInlineWhitespace(item.link);
  const url = new URL(link);
  const rawSlug = url.pathname
    .replace(/^\/website\//, '')
    .replace(/^\/+/, '')
    .replace(/\/+$/, '');
  const fallbackSlug = slugify(title);
  const slug = slugify(rawSlug || fallbackSlug);
  const episodeNumber = extractEpisodeNumber(title);
  const id = episodeNumber ? `all-in-e${episodeNumber}` : `all-in-${slug}`;
  const descriptionMarkup = item.contentEncoded || item.descriptionHtml || '';
  const paragraphs = extractContentParagraphs(descriptionMarkup);
  const plainDescription = summarizeParagraphs(paragraphs, 180) || stripHtml(descriptionMarkup) || title;
  const summary = summarizeParagraphs(paragraphs, 360) || plainDescription;
  const duration = parseOptionalDuration({
    duration: item.duration
  });

  return {
    id,
    slug,
    episodeNumber,
    title,
    publishDate: new Date(item.pubDate).toISOString().slice(0, 10),
    description: plainDescription,
    summary,
    durationSeconds: duration.durationSeconds,
    durationLabel: duration.durationLabel,
    guests: inferGuestsFromArchiveMetadata(title, paragraphs),
    topicTags: inferTopicsFromArchiveMetadata(title, paragraphs),
    youtubeId: '',
    officialPageUrl: link,
    fullEpisodeUrl: link,
    audioUrl: normalizeInlineWhitespace(item.audioUrl),
    imageUrl: normalizeInlineWhitespace(item.imageUrl),
    descriptionHtml: descriptionMarkup
  };
}

function parseArchiveFeed(xml) {
  const $ = load(xml, {
    xmlMode: true,
    decodeEntities: false
  });

  const seenIds = new Set();
  const episodes = [];

  $('channel > item').each((_, itemNode) => {
    const item = $(itemNode);
    const normalizedEpisode = normalizeArchiveEpisode({
      title: item.find('title').first().text(),
      link: item.find('link').first().text(),
      pubDate: item.find('pubDate').first().text(),
      descriptionHtml: item.find('description').first().text(),
      contentEncoded: item.find('content\\:encoded').first().text(),
      duration: item.find('itunes\\:duration').first().text(),
      audioUrl: item.find('enclosure').attr('url') || '',
      imageUrl: item.find('itunes\\:image').attr('href') || ''
    });

    if (seenIds.has(normalizedEpisode.id)) {
      return;
    }

    seenIds.add(normalizedEpisode.id);
    episodes.push(normalizedEpisode);
  });

  return episodes.sort((left, right) => new Date(`${right.publishDate}T00:00:00`).getTime() - new Date(`${left.publishDate}T00:00:00`).getTime());
}

async function readJsonIfExists(filePath) {
  if (!(await pathExists(filePath))) {
    return null;
  }

  return JSON.parse(await readFile(filePath, 'utf8'));
}

function normalizeOverrideMetadata(rawMetadata, sourceLabel) {
  if (!rawMetadata) {
    return {
      id: '',
      title: '',
      publishDate: '',
      description: '',
      summary: '',
      durationSeconds: null,
      durationLabel: '',
      guests: [],
      topicTags: [],
      youtubeId: '',
      officialPageUrl: '',
      fullEpisodeUrl: '',
      audioUrl: '',
      imageUrl: ''
    };
  }

  if (typeof rawMetadata !== 'object' || Array.isArray(rawMetadata)) {
    throw new Error(`${sourceLabel}: transcript override metadata must be a JSON object.`);
  }

  const duration = parseOptionalDuration(rawMetadata);

  return {
    id: normalizeInlineWhitespace(rawMetadata.id || ''),
    title: normalizeInlineWhitespace(rawMetadata.title || ''),
    publishDate: normalizeInlineWhitespace(rawMetadata.publishDate || ''),
    description: normalizeInlineWhitespace(rawMetadata.description || ''),
    summary: normalizeInlineWhitespace(rawMetadata.summary || ''),
    durationSeconds: duration.durationSeconds,
    durationLabel: duration.durationLabel,
    guests: normalizeStringArray(rawMetadata.guests).length
      ? normalizeStringArray(rawMetadata.guests)
      : normalizeInlineWhitespace(rawMetadata.guest || '')
        ? [normalizeInlineWhitespace(rawMetadata.guest)]
        : [],
    topicTags: normalizeStringArray(rawMetadata.topicTags),
    youtubeId: normalizeInlineWhitespace(rawMetadata.youtubeId || ''),
    officialPageUrl: normalizeInlineWhitespace(rawMetadata.officialPageUrl || ''),
    fullEpisodeUrl: normalizeInlineWhitespace(rawMetadata.fullEpisodeUrl || ''),
    audioUrl: normalizeInlineWhitespace(rawMetadata.audioUrl || ''),
    imageUrl: normalizeInlineWhitespace(rawMetadata.imageUrl || '')
  };
}

function mergeEpisode(baseEpisode, overrideEpisode) {
  return {
    ...baseEpisode,
    title: overrideEpisode.title || baseEpisode.title,
    publishDate: overrideEpisode.publishDate || baseEpisode.publishDate,
    description: overrideEpisode.description || baseEpisode.description,
    summary: overrideEpisode.summary || baseEpisode.summary,
    durationSeconds: overrideEpisode.durationSeconds ?? baseEpisode.durationSeconds,
    durationLabel: overrideEpisode.durationLabel || baseEpisode.durationLabel,
    guests: overrideEpisode.guests.length ? overrideEpisode.guests : baseEpisode.guests,
    topicTags: overrideEpisode.topicTags.length ? overrideEpisode.topicTags : baseEpisode.topicTags,
    youtubeId: overrideEpisode.youtubeId || baseEpisode.youtubeId,
    officialPageUrl: overrideEpisode.officialPageUrl || baseEpisode.officialPageUrl,
    fullEpisodeUrl: overrideEpisode.fullEpisodeUrl || baseEpisode.fullEpisodeUrl,
    audioUrl: overrideEpisode.audioUrl || baseEpisode.audioUrl,
    imageUrl: overrideEpisode.imageUrl || baseEpisode.imageUrl
  };
}

async function readTranscriptOverrides(archiveEpisodesById) {
  if (!(await pathExists(transcriptRoot)) && !(await pathExists(rawRoot))) {
    return new Map();
  }

  const modernFolders = await pathExists(transcriptRoot)
    ? (await readdir(transcriptRoot, { withFileTypes: true }))
      .filter((entry) => entry.isDirectory() && !entry.name.startsWith('_'))
      .map((entry) => ({
        source: 'modern',
        folderName: entry.name,
        folderPath: path.join(transcriptRoot, entry.name)
      }))
    : [];
  const legacyFolders = await pathExists(rawRoot)
    ? (await readdir(rawRoot, { withFileTypes: true }))
      .filter((entry) => entry.isDirectory())
      .filter((entry) => !entry.name.startsWith('_'))
      .filter((entry) => entry.name !== 'archive' && entry.name !== 'transcripts')
      .filter((entry) => entry.name !== 'audio' && !entry.name.startsWith('audio-'))
      .map((entry) => ({
        source: 'legacy',
        folderName: entry.name,
        folderPath: path.join(rawRoot, entry.name)
      }))
    : [];
  const overrideFolders = [...modernFolders, ...legacyFolders]
    .sort((left, right) => left.folderName.localeCompare(right.folderName));

  const overrides = new Map();

  for (const { source, folderName, folderPath } of overrideFolders) {
    const metadataPath = path.join(folderPath, 'metadata.json');
    const transcriptTextPath = path.join(folderPath, 'transcript.txt');
    const transcriptJsonPath = path.join(folderPath, 'transcript.json');
    const rawOverrideMetadata = await readJsonIfExists(metadataPath);
    const overrideMetadata = normalizeOverrideMetadata(rawOverrideMetadata, `${folderName}/metadata.json`);
    const episodeId = overrideMetadata.id || folderName;

    if (overrides.has(episodeId)) {
      continue;
    }

    if (!archiveEpisodesById.has(episodeId)) {
      if (source === 'legacy') {
        console.warn(`Skipping legacy transcript folder "${folderName}" because it does not map to a current archive episode id ("${episodeId}").`);
        continue;
      }
      throw new Error(`Transcript override folder "${folderName}" points to unknown archive episode "${episodeId}".`);
    }

    const hasTranscriptJson = await pathExists(transcriptJsonPath);
    const hasTranscriptText = await pathExists(transcriptTextPath);

    let chunks = [];
    let transcriptSourceType = 'structured-json';

    if (hasTranscriptJson) {
      const transcriptRaw = await readFile(transcriptJsonPath, 'utf8');
      chunks = parseStructuredTranscript(transcriptRaw, episodeId);
    } else if (hasTranscriptText) {
      const transcriptRaw = await readFile(transcriptTextPath, 'utf8');
      chunks = parseTranscriptText(transcriptRaw, episodeId);
      transcriptSourceType = 'legacy-timestamped-text';
    } else {
      throw new Error(`Transcript override folder "${folderName}" is missing transcript.json or transcript.txt.`);
    }

    overrides.set(episodeId, {
      metadata: overrideMetadata,
      chunks,
      transcriptSourceType
    });
  }

  return overrides;
}

function buildSearchDocument(episode, chunks) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="robots" content="noindex" />
  <title>${escapeHtml(episode.title)}</title>
</head>
<body>
  <main data-pagefind-body>
    <h1>${escapeHtml(episode.title)}</h1>
    <p data-pagefind-ignore>${escapeHtml(episode.description)}</p>
    <span hidden data-pagefind-meta="title">${escapeHtml(episode.title)}</span>
    <span hidden data-pagefind-meta="episode_id">${escapeHtml(episode.id)}</span>
    <span hidden data-pagefind-meta="publish_date">${escapeHtml(episode.publishDate)}</span>
    <span hidden data-pagefind-meta="detail_url">${escapeHtml(episode.detailPath)}</span>
    <span hidden data-pagefind-meta="data_file">${escapeHtml(episode.dataFile)}</span>
    <span hidden data-pagefind-meta="youtube_id">${escapeHtml(episode.youtubeId || '')}</span>
${chunks.map((chunk) => `    <section>
      <h2 id="${escapeHtml(chunk.id)}">${escapeHtml(chunk.startTimestamp)}</h2>
      ${chunk.speaker ? `<p>${escapeHtml(chunk.speaker)}</p>` : ''}
      <p>${escapeHtml(chunk.text)}</p>
    </section>`).join('\n')}
  </main>
</body>
</html>
`;
}

async function buildEpisodeOutput(baseEpisode, transcriptOverride) {
  const mergedEpisode = mergeEpisode(baseEpisode, transcriptOverride?.metadata || normalizeOverrideMetadata(null, ''));
  const descriptionOutlineChunks = parseDescriptionOutlineChunks(baseEpisode.descriptionHtml || '', mergedEpisode.id);
  const chunks = transcriptOverride?.chunks?.length ? transcriptOverride.chunks : descriptionOutlineChunks;
  const transcriptSourceType = transcriptOverride?.transcriptSourceType || (descriptionOutlineChunks.length ? 'rss-description-outline' : '');
  const detailPath = `/all-in-podcast-search/all-in/episode/?id=${encodeURIComponent(mergedEpisode.id)}`;
  const dataFile = `/data/all-in-podcast-search/episodes/${mergedEpisode.slug}.json`;
  const { descriptionHtml: _descriptionHtml, ...publicEpisode } = mergedEpisode;

  const episodeSummary = {
    ...publicEpisode,
    chunkCount: chunks.length,
    speakerLabelCount: chunks.filter((chunk) => chunk.speaker).length,
    transcriptSourceType,
    transcriptAvailable: chunks.length > 0,
    detailPath,
    dataFile
  };

  const episodePayload = {
    schemaVersion: SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    episode: episodeSummary,
    chunks
  };

  await writeFile(path.join(outputEpisodesRoot, `${mergedEpisode.slug}.json`), `${JSON.stringify(episodePayload, null, 2)}\n`, 'utf8');

  if (chunks.length > 0) {
    const pagefindDirectory = path.join(pagefindSourceRoot, mergedEpisode.slug);
    await mkdir(pagefindDirectory, { recursive: true });
    await writeFile(path.join(pagefindDirectory, 'index.html'), buildSearchDocument(episodeSummary, chunks), 'utf8');
  }

  return episodeSummary;
}

async function run() {
  if (!(await pathExists(archiveFeedPath))) {
    throw new Error(`Archive feed snapshot not found at ${path.relative(repoRoot, archiveFeedPath)}. Run the archive fetch script first.`);
  }

  const xml = await readFile(archiveFeedPath, 'utf8');
  const archiveEpisodes = parseArchiveFeed(xml);
  const archiveEpisodesById = new Map(archiveEpisodes.map((episode) => [episode.id, episode]));
  const transcriptOverrides = await readTranscriptOverrides(archiveEpisodesById);

  await rm(outputEpisodesRoot, { recursive: true, force: true });
  await mkdir(outputEpisodesRoot, { recursive: true });
  await rm(pagefindSourceRoot, { recursive: true, force: true });
  await mkdir(pagefindSourceRoot, { recursive: true });

  const builtEpisodes = [];
  for (const archiveEpisode of archiveEpisodes) {
    builtEpisodes.push(await buildEpisodeOutput(archiveEpisode, transcriptOverrides.get(archiveEpisode.id)));
  }

  await writeFile(
    path.join(outputEpisodesRoot, 'index.json'),
    `${JSON.stringify({
      schemaVersion: SCHEMA_VERSION,
      generatedAt: new Date().toISOString(),
      episodeCount: builtEpisodes.length,
      transcriptEpisodeCount: builtEpisodes.filter((episode) => episode.transcriptAvailable).length,
      transcriptChunkCount: builtEpisodes.reduce((sum, episode) => sum + Number(episode.chunkCount || 0), 0),
      speakerLabeledChunkCount: builtEpisodes.reduce((sum, episode) => sum + Number(episode.speakerLabelCount || 0), 0),
      episodes: builtEpisodes
    }, null, 2)}\n`,
    'utf8'
  );

  console.log(`Built ${builtEpisodes.length} All-In Podcast archive episodes (${builtEpisodes.filter((episode) => episode.transcriptAvailable).length} with transcripts).`);
}

run().catch((error) => {
  console.error('buildAllInPodcastSearch failed:', error);
  process.exitCode = 1;
});
