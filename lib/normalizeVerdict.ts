import { type RawVerdict, type VerdictRecord } from '../scrapers/baseScraper.js';
import { deriveVerdictBucket, inferCaseType, inferIndustry } from './verdictInference.js';

function toNumber(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  const normalized = String(value ?? '').replace(/[^0-9.-]+/g, '');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toText(value: unknown, fallback = ''): string {
  const normalized = String(value ?? '').replace(/\s+/g, ' ').trim();
  if (normalized) {
    return normalized;
  }

  return String(fallback ?? '').replace(/\s+/g, ' ').trim();
}

function parseYear(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  const text = toText(value);
  const match = text.match(/\b(19|20)\d{2}\b/);
  return match ? Number(match[0]) : 0;
}

function buildId(caseName: string, year: number, state: string): string {
  return `${caseName}-${year}-${state}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);
}

const STATES: Array<{ abbr: string; name: string }> = [
  { abbr: 'AL', name: 'Alabama' },
  { abbr: 'AK', name: 'Alaska' },
  { abbr: 'AZ', name: 'Arizona' },
  { abbr: 'AR', name: 'Arkansas' },
  { abbr: 'CA', name: 'California' },
  { abbr: 'CO', name: 'Colorado' },
  { abbr: 'CT', name: 'Connecticut' },
  { abbr: 'DE', name: 'Delaware' },
  { abbr: 'FL', name: 'Florida' },
  { abbr: 'GA', name: 'Georgia' },
  { abbr: 'HI', name: 'Hawaii' },
  { abbr: 'ID', name: 'Idaho' },
  { abbr: 'IL', name: 'Illinois' },
  { abbr: 'IN', name: 'Indiana' },
  { abbr: 'IA', name: 'Iowa' },
  { abbr: 'KS', name: 'Kansas' },
  { abbr: 'KY', name: 'Kentucky' },
  { abbr: 'LA', name: 'Louisiana' },
  { abbr: 'ME', name: 'Maine' },
  { abbr: 'MD', name: 'Maryland' },
  { abbr: 'MA', name: 'Massachusetts' },
  { abbr: 'MI', name: 'Michigan' },
  { abbr: 'MN', name: 'Minnesota' },
  { abbr: 'MS', name: 'Mississippi' },
  { abbr: 'MO', name: 'Missouri' },
  { abbr: 'MT', name: 'Montana' },
  { abbr: 'NE', name: 'Nebraska' },
  { abbr: 'NV', name: 'Nevada' },
  { abbr: 'NH', name: 'New Hampshire' },
  { abbr: 'NJ', name: 'New Jersey' },
  { abbr: 'NM', name: 'New Mexico' },
  { abbr: 'NY', name: 'New York' },
  { abbr: 'NC', name: 'North Carolina' },
  { abbr: 'ND', name: 'North Dakota' },
  { abbr: 'OH', name: 'Ohio' },
  { abbr: 'OK', name: 'Oklahoma' },
  { abbr: 'OR', name: 'Oregon' },
  { abbr: 'PA', name: 'Pennsylvania' },
  { abbr: 'RI', name: 'Rhode Island' },
  { abbr: 'SC', name: 'South Carolina' },
  { abbr: 'SD', name: 'South Dakota' },
  { abbr: 'TN', name: 'Tennessee' },
  { abbr: 'TX', name: 'Texas' },
  { abbr: 'UT', name: 'Utah' },
  { abbr: 'VT', name: 'Vermont' },
  { abbr: 'VA', name: 'Virginia' },
  { abbr: 'WA', name: 'Washington' },
  { abbr: 'WV', name: 'West Virginia' },
  { abbr: 'WI', name: 'Wisconsin' },
  { abbr: 'WY', name: 'Wyoming' },
  { abbr: 'DC', name: 'District of Columbia' }
];

export function parseLocation(location: unknown): { state: string; county: string; court: string } {
  const text = toText(location);
  const countyMatch = text.match(/([A-Z][A-Za-z.\-'\s]+?\sCounty)\b/i);
  const courtMatch = text.match(/((?:Superior|District|Circuit|County|State|Federal|Appellate|Trial)\s+Court[^,;]*)/i);
  const stateMatch = STATES.find(({ abbr, name }) => {
    const abbrPattern = new RegExp(`\\b${abbr}\\b`);
    const namePattern = new RegExp(`\\b${name.replace(/\s+/g, '\\s+')}\\b`, 'i');
    return abbrPattern.test(text) || namePattern.test(text);
  });

  return {
    state: stateMatch?.name || '',
    county: countyMatch?.[1] || '',
    court: courtMatch?.[1] || ''
  };
}

export function extractCaseNameFromHeadline(headline: unknown): string {
  const text = toText(headline);
  if (!text) {
    return '';
  }

  const versusMatch = text.match(/([A-Z][A-Za-z0-9&.,'\-\s]+?\s+v\.?\s+[A-Z][A-Za-z0-9&.,'\-\s]+)/);
  if (versusMatch) {
    return versusMatch[1].replace(/\s+/g, ' ').trim();
  }

  const quotedMatch = text.match(/[“"]([^"”]{8,160})["”]/);
  if (quotedMatch) {
    return quotedMatch[1].trim();
  }

  return text
    .replace(/^(jury\s+(awards?|verdict)\s+|verdict\s+watch:\s*)/i, '')
    .replace(/\s*[-|:]\s*.*$/, '')
    .trim();
}

function determineVerificationStatus(rawVerdict: RawVerdict): string {
  const explicitStatus = toText(rawVerdict.verificationStatus);
  if (explicitStatus) {
    return explicitStatus;
  }

  const sourceText = [rawVerdict.source, rawVerdict.sourceLabel, rawVerdict.publisher, rawVerdict.sourceUrl]
    .map((value) => toText(value))
    .join(' ')
    .toLowerCase();

  if (
    sourceText.includes('verdictsearch') ||
    sourceText.includes('top verdict') ||
    sourceText.includes('courtroom view') ||
    sourceText.includes('courtroomview')
  ) {
    return 'verdict_reporter';
  }

  return 'news_reported';
}

export function normalizeVerdict(rawVerdict: RawVerdict): VerdictRecord | null {
  const headline = toText(rawVerdict.headline || rawVerdict.title);
  const articleText = toText(rawVerdict.articleText || rawVerdict.notes);
  const caseName = toText(rawVerdict.caseName) || extractCaseNameFromHeadline(headline);
  const year = toNumber(rawVerdict.year) || parseYear(rawVerdict.date) || parseYear(articleText) || parseYear(headline);
  const totalVerdict = toNumber(rawVerdict.totalVerdict ?? rawVerdict.amount);
  const punitive = toNumber(rawVerdict.punitive ?? rawVerdict.punitiveDamages ?? rawVerdict.punitiveAmount);
  const compensatory =
    toNumber(rawVerdict.compensatory ?? rawVerdict.compensatoryDamages) ||
    (totalVerdict > 0 && punitive > 0 ? Math.max(totalVerdict - punitive, 0) : 0);
  const source = toText(rawVerdict.source || rawVerdict.publisher, 'Unknown source');
  const sourceUrl = toText(rawVerdict.sourceUrl || rawVerdict.url);

  if (!caseName || !year || !sourceUrl) {
    return null;
  }

  const parsedLocation = parseLocation(rawVerdict.location);
  const state = toText(rawVerdict.state || parsedLocation.state, 'Unknown');
  const county = toText(rawVerdict.county || parsedLocation.county);
  const court = toText(rawVerdict.court || parsedLocation.court);
  const jurisdiction = toText(rawVerdict.jurisdiction || rawVerdict.county || rawVerdict.court, county || court || 'Unknown');
  const inferenceText = [headline, articleText, rawVerdict.location, rawVerdict.notes].map((value) => toText(value)).join(' ');
  const industry = toText(rawVerdict.industry, inferIndustry(inferenceText));
  const caseType = toText(rawVerdict.caseType, inferCaseType(inferenceText));
  const verificationStatus = determineVerificationStatus(rawVerdict);
  const updatedAt = toText(rawVerdict.updatedAt, new Date().toISOString());
  const notes = toText(rawVerdict.notes || articleText);
  const sourceLabel = toText(rawVerdict.sourceLabel, source);

  return {
    id: buildId(caseName, year, state),
    caseName,
    year,
    state,
    county,
    jurisdiction,
    court,
    industry,
    caseType,
    totalVerdict,
    compensatory,
    compensatoryDamages: compensatory,
    punitive,
    punitiveDamages: punitive,
    hasPunitive: punitive > 0,
    source,
    sourceLabel,
    sourceUrl,
    verificationStatus,
    updatedAt,
    verdictBucket: deriveVerdictBucket(totalVerdict),
    captionType: caseType,
    notes
  };
}
