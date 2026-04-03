import { type VerdictRecord } from '../scrapers/baseScraper.js';

function normalizeCaseName(value: string): string {
  return value
    .toLowerCase()
    .replace(/\b(et al|inc|llc|l\.l\.c|corp|corporation|co|company|ltd|plc)\b/g, ' ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenize(value: string): string[] {
  return normalizeCaseName(value)
    .split(' ')
    .filter((token) => token.length > 1);
}

function buildBigrams(value: string): Set<string> {
  const normalized = normalizeCaseName(value).replace(/\s+/g, ' ');
  const padded = ` ${normalized} `;
  const bigrams = new Set<string>();

  for (let index = 0; index < padded.length - 1; index += 1) {
    bigrams.add(padded.slice(index, index + 2));
  }

  return bigrams;
}

function diceCoefficient(left: string, right: string): number {
  const leftBigrams = buildBigrams(left);
  const rightBigrams = buildBigrams(right);

  if (!leftBigrams.size || !rightBigrams.size) {
    return 0;
  }

  let overlap = 0;
  leftBigrams.forEach((token) => {
    if (rightBigrams.has(token)) {
      overlap += 1;
    }
  });

  return (2 * overlap) / (leftBigrams.size + rightBigrams.size);
}

function tokenOverlap(left: string, right: string): number {
  const leftTokens = new Set(tokenize(left));
  const rightTokens = new Set(tokenize(right));

  if (!leftTokens.size || !rightTokens.size) {
    return 0;
  }

  let overlap = 0;
  leftTokens.forEach((token) => {
    if (rightTokens.has(token)) {
      overlap += 1;
    }
  });

  return overlap / Math.max(leftTokens.size, rightTokens.size);
}

function caseNameSimilarity(left: string, right: string): number {
  const normalizedLeft = normalizeCaseName(left);
  const normalizedRight = normalizeCaseName(right);

  if (!normalizedLeft || !normalizedRight) {
    return 0;
  }

  if (normalizedLeft === normalizedRight) {
    return 1;
  }

  const dice = diceCoefficient(normalizedLeft, normalizedRight);
  const overlap = tokenOverlap(normalizedLeft, normalizedRight);
  return (dice * 0.65) + (overlap * 0.35);
}

function amountSimilarity(left: number, right: number): boolean {
  if (!left || !right) {
    return true;
  }

  const delta = Math.abs(left - right);
  const baseline = Math.max(left, right);
  return delta / baseline <= 0.15;
}

function normalizeLocation(record: VerdictRecord): string {
  return [record.county, record.state, record.court, record.jurisdiction]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function locationSimilarity(left: VerdictRecord, right: VerdictRecord): boolean {
  if (left.state && right.state && left.state !== right.state) {
    return false;
  }

  const leftLocation = normalizeLocation(left);
  const rightLocation = normalizeLocation(right);

  if (!leftLocation || !rightLocation) {
    return true;
  }

  if (leftLocation === rightLocation) {
    return true;
  }

  return tokenOverlap(leftLocation, rightLocation) >= 0.5;
}

function isMeaningfulValue(value: unknown): boolean {
  if (typeof value === 'number') {
    return Number.isFinite(value) && value > 0;
  }

  return String(value ?? '').trim().length > 0;
}

function completenessScore(record: VerdictRecord): number {
  const fieldScore = [
    record.caseName,
    record.year,
    record.state,
    record.county,
    record.court,
    record.industry,
    record.caseType,
    record.totalVerdict,
    record.compensatory,
    record.punitive,
    record.sourceUrl,
    record.notes
  ].filter(isMeaningfulValue).length;

  const verificationBoost =
    record.verificationStatus === 'verdict_reporter'
      ? 6
      : record.verificationStatus === 'news_reported'
        ? 3
        : 0;

  return fieldScore + verificationBoost;
}

function choosePrimaryRecord(left: VerdictRecord, right: VerdictRecord): VerdictRecord {
  return completenessScore(left) >= completenessScore(right) ? left : right;
}

function mergeText(primary: string, secondary: string): string {
  return primary || secondary;
}

function mergeNumber(primary: number, secondary: number): number {
  return primary > 0 ? primary : secondary;
}

function mergeVerificationStatus(left: string, right: string): string {
  if (left === 'verdict_reporter' || right === 'verdict_reporter') {
    return 'verdict_reporter';
  }

  if (left === 'news_reported' || right === 'news_reported') {
    return 'news_reported';
  }

  return left || right;
}

function mergeNotes(left: string, right: string): string {
  if (!left) return right;
  if (!right) return left;
  if (left.includes(right)) return left;
  if (right.includes(left)) return right;
  return `${left} | ${right}`.slice(0, 1200);
}

function mergeRecords(left: VerdictRecord, right: VerdictRecord): VerdictRecord {
  const primary = choosePrimaryRecord(left, right);
  const secondary = primary === left ? right : left;

  const merged: VerdictRecord = {
    ...primary,
    caseName: mergeText(primary.caseName, secondary.caseName),
    year: mergeNumber(primary.year, secondary.year),
    state: mergeText(primary.state, secondary.state),
    county: mergeText(primary.county, secondary.county),
    jurisdiction: mergeText(primary.jurisdiction, secondary.jurisdiction),
    court: mergeText(primary.court, secondary.court),
    industry: mergeText(primary.industry, secondary.industry),
    caseType: mergeText(primary.caseType, secondary.caseType),
    totalVerdict: mergeNumber(primary.totalVerdict, secondary.totalVerdict),
    compensatory: mergeNumber(primary.compensatory, secondary.compensatory),
    compensatoryDamages: mergeNumber(primary.compensatoryDamages, secondary.compensatoryDamages),
    punitive: mergeNumber(primary.punitive, secondary.punitive),
    punitiveDamages: mergeNumber(primary.punitiveDamages, secondary.punitiveDamages),
    hasPunitive: primary.hasPunitive || secondary.hasPunitive,
    source: mergeText(primary.source, secondary.source),
    sourceLabel: mergeText(primary.sourceLabel, secondary.sourceLabel),
    sourceUrl: mergeText(primary.sourceUrl, secondary.sourceUrl),
    verificationStatus: mergeVerificationStatus(primary.verificationStatus, secondary.verificationStatus),
    updatedAt: mergeText(primary.updatedAt, secondary.updatedAt),
    verdictBucket: mergeText(primary.verdictBucket, secondary.verdictBucket),
    captionType: mergeText(primary.captionType, secondary.captionType),
    notes: mergeNotes(primary.notes, secondary.notes)
  };

  return merged;
}

function arePotentialDuplicates(left: VerdictRecord, right: VerdictRecord): boolean {
  if (!left.caseName || !right.caseName) {
    return false;
  }

  if (left.year !== right.year) {
    return false;
  }

  const nameScore = caseNameSimilarity(left.caseName, right.caseName);
  if (nameScore < 0.82) {
    return false;
  }

  if (!amountSimilarity(left.totalVerdict, right.totalVerdict)) {
    return false;
  }

  return locationSimilarity(left, right);
}

export function dedupeVerdicts(records: VerdictRecord[]): VerdictRecord[] {
  const deduped: VerdictRecord[] = [];

  records.forEach((record) => {
    const matchIndex = deduped.findIndex((existing) => arePotentialDuplicates(existing, record));

    if (matchIndex === -1) {
      deduped.push(record);
      return;
    }

    deduped[matchIndex] = mergeRecords(deduped[matchIndex], record);
  });

  return deduped.sort((left, right) => {
    if (right.year !== left.year) {
      return right.year - left.year;
    }

    return right.totalVerdict - left.totalVerdict;
  });
}

export function findDuplicateVerdict(record: VerdictRecord, existingRecords: VerdictRecord[]): VerdictRecord | undefined {
  return existingRecords.find((existing) => arePotentialDuplicates(existing, record));
}
