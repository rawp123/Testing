const INDUSTRY_KEYWORDS: Array<[string, string]> = [
  ['trucking', 'Transportation'],
  ['transit', 'Transportation'],
  ['delivery', 'Transportation'],
  ['energy', 'Energy'],
  ['refinery', 'Energy'],
  ['oilfield', 'Energy'],
  ['medical malpractice', 'Medical malpractice'],
  ['medical', 'Healthcare'],
  ['hospital', 'Healthcare'],
  ['pharmaceutical', 'Pharmaceutical'],
  ['pharma', 'Life sciences'],
  ['drugmaker', 'Pharmaceutical'],
  ['drug', 'Life sciences'],
  ['device', 'Medical device'],
  ['construction', 'Construction'],
  ['chemical', 'Manufacturing'],
  ['manufactur', 'Manufacturing'],
  ['apartment', 'Real estate'],
  ['property', 'Real estate'],
  ['casino', 'Hospitality'],
  ['hotel', 'Hospitality'],
  ['nursing', 'Senior living'],
  ['automotive', 'Automotive'],
  ['vehicle', 'Automotive'],
  ['products liability', 'Product liability'],
  ['product liability', 'Product liability'],
  ['employment', 'Employment'],
  ['wrongful termination', 'Employment'],
  ['premises liability', 'Premises liability'],
  ['slip and fall', 'Premises liability']
] as const;

const CASE_TYPE_KEYWORDS: Array<[string, string]> = [
  ['wrongful death', 'Wrongful death'],
  ['medical malpractice', 'Medical malpractice'],
  ['malpractice', 'Medical malpractice'],
  ['premises liability', 'Premises liability'],
  ['product liability', 'Product liability'],
  ['products liability', 'Product liability'],
  ['failure to warn', 'Product liability'],
  ['toxic', 'Toxic tort'],
  ['exposure', 'Toxic tort'],
  ['truck', 'Auto and trucking'],
  ['auto', 'Auto and trucking'],
  ['vehicle', 'Auto and trucking'],
  ['workplace', 'Workplace injury'],
  ['worksite', 'Workplace injury'],
  ['birth injury', 'Medical malpractice'],
  ['employment', 'Employment'],
  ['discrimination', 'Employment'],
  ['personal injury', 'Personal injury'],
  ['catastrophic injury', 'Personal injury']
] as const;

export const VERDICT_BUCKETS = [
  '$100M+',
  '$50M-$99M',
  '$25M-$49M',
  '$10M-$24M',
  'Under $10M'
] as const;

function inferFromKeywords(value: string, keywords: ReadonlyArray<readonly [string, string]>, fallback: string): string {
  const text = value.toLowerCase();

  for (const [needle, label] of keywords) {
    if (text.includes(needle)) {
      return label;
    }
  }

  return fallback;
}

export function parseMoneyAmount(value: string): number {
  const text = String(value ?? '').trim().toLowerCase();
  if (!text) {
    return 0;
  }

  const match = text.match(/\$?\s*([\d,.]+)\s*(billion|bn|million|mm|m|thousand|k)?/i);
  if (!match) {
    return 0;
  }

  const numeric = Number(match[1].replace(/,/g, ''));
  if (!Number.isFinite(numeric)) {
    return 0;
  }

  const unit = (match[2] || '').toLowerCase();
  let multiplier = 1;

  if (unit === 'billion' || unit === 'bn') multiplier = 1_000_000_000;
  if (unit === 'million' || unit === 'mm' || unit === 'm') multiplier = 1_000_000;
  if (unit === 'thousand' || unit === 'k') multiplier = 1_000;

  return Math.round(numeric * multiplier);
}

export function extractPunitiveAmount(value: string): number {
  const text = String(value ?? '');
  if (!text) {
    return 0;
  }

  const patterns = [
    /(punitive(?: damages?)?[^$]{0,30}\$[\d,.]+\s*(?:billion|bn|million|mm|m|thousand|k)?)/i,
    /(\$[\d,.]+\s*(?:billion|bn|million|mm|m|thousand|k)?[^.]{0,30}punitive(?: damages?)?)/i
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      return parseMoneyAmount(match[1]);
    }
  }

  return 0;
}

export function inferIndustry(value: string): string {
  return inferFromKeywords(value, INDUSTRY_KEYWORDS, 'Unspecified');
}

export function inferCaseType(value: string): string {
  return inferFromKeywords(value, CASE_TYPE_KEYWORDS, 'Uncategorized');
}

export function deriveVerdictBucket(totalVerdict: number): string {
  if (totalVerdict >= 100000000) return '$100M+';
  if (totalVerdict >= 50000000) return '$50M-$99M';
  if (totalVerdict >= 25000000) return '$25M-$49M';
  if (totalVerdict >= 10000000) return '$10M-$24M';
  return 'Under $10M';
}
