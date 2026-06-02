import { SERVICE_CATEGORIES, type ServiceCategory } from './serviceCategories';
import type { OcrConfidence, SuggestedField, SuggestedServiceFields } from './types';

const CATEGORY_RULES: Array<{ category: ServiceCategory; keywords: string[] }> = [
  { category: 'Brake fluid', keywords: ['brake fluid', 'brake flush', 'brake hydraulic', 'dot 3', 'dot 4', 'dot-3', 'dot-4', 'hydraulic fluid'] },
  {
    category: 'Oil change',
    keywords: [
      'oil change',
      'engine oil',
      'synthetic oil',
      'full synthetic',
      'conventional oil',
      'oil filter',
      'oil & filter',
      'oil and filter',
      'lube oil',
      'lube filter',
      'lube oil filter',
      'lube/oil/filter',
      'l.o.f',
      'lof',
      '5w-',
      '0w-',
      '5w20',
      '5w30',
      '0w20',
      '0w30',
      'dexos'
    ]
  },
  {
    category: 'Tire rotation',
    keywords: ['tire rotation', 'rotate tires', 'rotation and balance', 'rotate & balance', 'rotate and balance', 'rot & bal', 'tire rotate', 'balance and rotate']
  },
  {
    category: 'Transmission',
    keywords: [
      'transmission service',
      'transmission flush',
      'transmission fluid',
      'transmission drain',
      'automatic transmission',
      'transmission',
      'transaxle',
      'atf',
      'cvt fluid',
      'trans fluid'
    ]
  },
  {
    category: 'Coolant',
    keywords: ['coolant service', 'coolant exchange', 'coolant flush', 'coolant', 'antifreeze', 'radiator flush', 'radiator service', 'cooling system', 'dex-cool']
  },
  {
    category: 'Inspection/emissions',
    keywords: ['state inspection', 'safety inspection', 'vehicle inspection', 'emissions inspection', 'emissions test', 'emission test', 'emissions', 'emission', 'smog']
  },
  { category: 'Alignment', keywords: ['alignment', 'wheel align', 'toe adjustment', 'camber'] },
  { category: 'Battery', keywords: ['battery replacement', 'battery install', 'battery test', 'battery', 'cca', 'agm', 'alternator test', 'charging system'] },
  {
    category: 'Brakes',
    keywords: ['brake pads', 'brake rotor', 'brake rotors', 'pads and rotors', 'front brakes', 'rear brakes', 'rotors', 'brakes', 'caliper', 'brake job', 'brake service']
  },
  {
    category: 'Filters',
    keywords: ['cabin air filter', 'cabin air', 'cabin filter', 'engine air filter', 'engine air', 'air filter', 'air cleaner', 'fuel filter', 'pollen filter', 'filter replacement']
  },
  { category: 'Wipers', keywords: ['wiper', 'windshield blade', 'wiper blade'] },
  {
    category: 'Tires',
    keywords: ['new tires', 'tire install', 'tire replacement', 'mount and balance', 'mounted and balanced', 'tire balancing', 'tire repair', 'flat repair', 'tread', 'tpms sensor', 'tpms']
  }
];

const MONEY_PATTERN = /\$?\s*(-?\d+(?:,\d{3})*(?:\.\d{2}))/g;
const REPAIR_ORDER_VALUE_BLOCKLIST = new Set(['date', 'opened', 'open', 'closed', 'complete', 'completed', 'number', 'no', 'customer']);

const MONTHS: Record<string, string> = {
  jan: '01',
  january: '01',
  feb: '02',
  february: '02',
  mar: '03',
  march: '03',
  apr: '04',
  april: '04',
  may: '05',
  jun: '06',
  june: '06',
  jul: '07',
  july: '07',
  aug: '08',
  august: '08',
  sep: '09',
  sept: '09',
  september: '09',
  oct: '10',
  october: '10',
  nov: '11',
  november: '11',
  dec: '12',
  december: '12'
};

function field<T>(value: T, confidence: OcrConfidence, evidence = ''): SuggestedField<T> {
  return { value, confidence, evidence };
}

function normalizeText(text: string): string {
  return text.replace(/\r/g, '\n').replace(/[ \t]+/g, ' ').trim();
}

function linesFrom(text: string): string[] {
  return normalizeText(text)
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

function normalizeYear(year: number): number {
  if (year < 100) return year >= 70 ? 1900 + year : 2000 + year;
  return year;
}

function makeDate(year: number, month: number, day: number): string {
  const normalizedYear = normalizeYear(year);
  if (month < 1 || month > 12 || day < 1 || day > 31 || normalizedYear < 1980 || normalizedYear > 2100) return '';
  const date = new Date(Date.UTC(normalizedYear, month - 1, day));
  if (date.getUTCFullYear() !== normalizedYear || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return '';
  return `${normalizedYear}-${pad2(month)}-${pad2(day)}`;
}

function parseDateCandidate(text: string): string {
  const iso = text.match(/\b(20\d{2}|19\d{2})[-/](0?[1-9]|1[0-2])[-/](0?[1-9]|[12]\d|3[01])\b/);
  if (iso) return makeDate(Number(iso[1]), Number(iso[2]), Number(iso[3]));

  const numeric = text.match(/\b(0?[1-9]|1[0-2])[-/](0?[1-9]|[12]\d|3[01])[-/](\d{2,4})\b/);
  if (numeric) return makeDate(Number(numeric[3]), Number(numeric[1]), Number(numeric[2]));

  const monthName = text.match(
    /\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t|tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\.?\s+([0-3]?\d),?\s+(20\d{2}|19\d{2}|\d{2})\b/i
  );
  if (monthName) return makeDate(Number(monthName[3]), Number(MONTHS[monthName[1].toLowerCase()]), Number(monthName[2]));

  return '';
}

function searchableText(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function keywordMatches(text: string, keyword: string): boolean {
  const lower = text.toLowerCase();
  if (lower.includes(keyword)) return true;

  const cleanText = ` ${searchableText(text)} `;
  const cleanKeyword = searchableText(keyword);
  return cleanKeyword.length > 0 && cleanText.includes(` ${cleanKeyword} `);
}

function keywordScore(keyword: string): number {
  const words = searchableText(keyword).split(' ').filter(Boolean).length;
  if (words >= 3) return 4;
  if (words === 2) return 3;
  return 1;
}

export function classifyServiceCategory(text: string): SuggestedField<ServiceCategory> {
  let best: { category: ServiceCategory; score: number; evidence: string } = {
    category: 'Other',
    score: 0,
    evidence: ''
  };

  for (const rule of CATEGORY_RULES) {
    let score = 0;
    const hits: string[] = [];
    for (const keyword of rule.keywords) {
      if (keywordMatches(text, keyword)) {
        score += keywordScore(keyword);
        hits.push(keyword);
      }
    }
    if (score > best.score) {
      best = { category: rule.category, score, evidence: hits.slice(0, 3).join(', ') };
    }
  }

  if (best.score >= 4) return field(best.category, 'high', best.evidence);
  if (best.score > 0) return field(best.category, 'medium', best.evidence);
  return field('Other', 'low', 'No strong category keyword found.');
}

function extractDate(lines: string[], mode: 'service' | 'next'): SuggestedField<string> {
  if (mode === 'next') {
    const keywords = ['next', 'due', 'recommended', 'return', 'reminder'];
    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index];
      const lower = line.toLowerCase();
      if (!keywords.some((keyword) => lower.includes(keyword))) continue;
      const value = parseDateCandidate(`${line} ${lines[index + 1] ?? ''}`);
      if (value) return field(value, 'medium', line);
    }
    return field('', 'none', '');
  }

  const dateLabels: Array<{ label: RegExp; confidence: OcrConfidence; priority: number }> = [
    { label: /\b(?:completed|complete date|completion date|closed|close date|ro closed|r\/o closed)\b/i, confidence: 'high', priority: 100 },
    { label: /\b(?:service date|invoice date|paid date|delivered date|repair date)\b/i, confidence: 'high', priority: 90 },
    { label: /\b(?:opened|open date|ro opened|r\/o opened|date opened|write[- ]?up date|date in)\b/i, confidence: 'medium', priority: 70 },
    { label: /\b(?:repair order date|ro date|r\/o date|order date|date)\b/i, confidence: 'medium', priority: 50 }
  ];

  let best: SuggestedField<string> | null = null;
  let bestPriority = 0;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    for (const { label, confidence, priority } of dateLabels) {
      const match = line.match(label);
      if (!match) continue;

      const sameLineValue = parseDateCandidate(line.slice(match.index ?? 0));
      const nextLineValue = sameLineValue || parseDateCandidate(lines[index + 1] ?? '');
      if (nextLineValue && priority > bestPriority) {
        best = field(nextLineValue, confidence, line);
        bestPriority = priority;
      }
    }
  }

  if (best) return best;

  for (const line of lines.slice(0, 12)) {
    const value = parseDateCandidate(line);
    if (value) return field(value, 'medium', line);
  }

  return field('', 'none', '');
}

function parseNumber(value: string): number | null {
  const cleaned = value.replace(/[$,()]/g, '');
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

function findMileageNumber(text: string): number | null {
  const withoutDates = text
    .replace(/\b(20\d{2}|19\d{2})[-/](0?[1-9]|1[0-2])[-/](0?[1-9]|[12]\d|3[01])\b/g, ' ')
    .replace(/\b(0?[1-9]|1[0-2])[-/](0?[1-9]|[12]\d|3[01])[-/](\d{2,4})\b/g, ' ')
    .replace(
      /\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t|tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\.?\s+([0-3]?\d),?\s+(20\d{2}|19\d{2}|\d{2})\b/gi,
      ' '
    );
  const numbers = Array.from(withoutDates.matchAll(/\b(\d{1,3}(?:,\d{3})+|\d{4,7})\b/g))
    .map((match) => parseNumber(match[1]))
    .filter((value): value is number => typeof value === 'number' && value > 1000 && value < 1000000);

  return numbers[0] ?? null;
}

function extractMileage(lines: string[], mode: 'service' | 'next'): SuggestedField<number | null> {
  if (mode === 'next') {
    const keywords = ['next', 'due', 'recommended', 'return'];
    for (const line of lines) {
      const lower = `${line.toLowerCase()} `;
      if (!keywords.some((keyword) => lower.includes(keyword))) continue;
      if (!/(mile|mi|odometer)/i.test(line)) continue;
      const value = findMileageNumber(line);
      if (value) return field(value, 'medium', line);
    }

    return field(null, 'none', '');
  }

  const inOutPattern = /\b(?:odometer|odo|mileage|miles)\s*(?:in\s*\/\s*out|i\/o|in\s+out)\D+(\d{1,3}(?:,\d{3})+|\d{4,7})\D+(\d{1,3}(?:,\d{3})+|\d{4,7})\b/i;
  for (const line of lines) {
    const match = line.match(inOutPattern);
    if (!match) continue;
    const value = parseNumber(match[2]);
    if (value && value > 100) return field(value, 'high', line);
  }

  const labels: Array<{ label: RegExp; confidence: OcrConfidence; priority: number }> = [
    { label: /\b(?:odometer|odo|mileage|miles)?\s*out\b|\bout\s*(?:odometer|odo|mileage|miles)\b/i, confidence: 'high', priority: 100 },
    { label: /\b(?:odometer|odo|mileage|miles)?\s*closed\b|\bclosing\s*(?:odometer|odo|mileage|miles)\b/i, confidence: 'high', priority: 95 },
    { label: /\b(?:odometer|odo|mileage|miles)?\s*in\b|\bin\s*(?:odometer|odo|mileage|miles)\b|\bdate\/miles\s*in\b/i, confidence: 'medium', priority: 80 },
    { label: /\b(?:mileage|odometer|odo|vehicle miles|miles)\b/i, confidence: 'medium', priority: 60 }
  ];

  let best: SuggestedField<number | null> | null = null;
  let bestPriority = 0;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    for (const { label, confidence, priority } of labels) {
      const match = line.match(label);
      if (!match) continue;
      const value = findMileageNumber(`${line.slice(match.index ?? 0)} ${lines[index + 1] ?? ''}`);
      if (value && priority > bestPriority) {
        best = field(value, confidence, line);
        bestPriority = priority;
      }
    }
  }

  if (best) return best;
  return field(null, 'none', '');
}

function extractTotal(lines: string[]): SuggestedField<number | null> {
  const priority: Array<{ keyword: string; confidence: OcrConfidence }> = [
    { keyword: 'grand total', confidence: 'high' },
    { keyword: 'invoice total', confidence: 'high' },
    { keyword: 'repair order total', confidence: 'high' },
    { keyword: 'total charges', confidence: 'high' },
    { keyword: 'amount paid', confidence: 'high' },
    { keyword: 'paid amount', confidence: 'high' },
    { keyword: 'amount due', confidence: 'medium' },
    { keyword: 'total due', confidence: 'medium' },
    { keyword: 'balance due', confidence: 'medium' },
    { keyword: 'total', confidence: 'medium' },
    { keyword: 'paid', confidence: 'medium' },
    { keyword: 'payment', confidence: 'medium' },
    { keyword: 'credit card', confidence: 'medium' },
    { keyword: 'visa', confidence: 'medium' }
  ];

  for (const { keyword, confidence } of priority) {
    const candidates = lines
      .map((line, index) => ({ line, nextLine: lines[index + 1] ?? '' }))
      .filter(({ line }) => keywordMatches(line, keyword));

    for (const { line, nextLine } of candidates) {
      if (/subtotal|tax total|total tax|total parts|total labor/i.test(line) && keyword === 'total') continue;
      const keywordIndex = line.toLowerCase().indexOf(keyword);
      const sameLineSource = keywordIndex >= 0 ? line.slice(keywordIndex) : line;
      const sameLineAmounts = Array.from(sameLineSource.matchAll(MONEY_PATTERN))
        .map((match) => parseNumber(match[1]))
        .filter((value): value is number => typeof value === 'number');
      const amounts = sameLineAmounts.length > 0
        ? sameLineAmounts
        : Array.from(nextLine.matchAll(MONEY_PATTERN))
        .map((match) => parseNumber(match[1]))
        .filter((value): value is number => typeof value === 'number');
      if (amounts.length > 0) {
        return field(amounts[0], confidence, line);
      }
    }
  }

  return field(null, 'none', '');
}

function extractShop(lines: string[]): SuggestedField<string> {
  const ignored = /^(invoice|receipt|estimate|repair order|customer|vehicle|date|total|subtotal|tax|paid|balance)\b/i;
  const candidates = lines
    .slice(0, 8)
    .filter((line) => line.length >= 3 && line.length <= 64)
    .filter((line) => !ignored.test(line))
    .filter((line) => !/^page\s+\d+\b/i.test(line))
    .filter((line) => !/(^\(?\d{3}\)?[-.\s]\d{3}[-.\s]\d{4}\b|@|www\.|\b\d{5}(?:-\d{4})?\b)/i.test(line))
    .filter((line) => !/^\d+\s+[a-z0-9 .'-]+(?:street|st\.?|avenue|ave\.?|road|rd\.?|drive|dr\.?|lane|ln\.?|boulevard|blvd\.?)\b/i.test(line))
    .filter((line) => !/\$\s*\d/.test(line));

  if (candidates.length === 0) return field('', 'none', '');
  const best = candidates.find((line) => /auto|service|tire|garage|dealer|motors|lube|brake|repair/i.test(line)) ?? candidates[0];
  return field(best, /auto|service|tire|garage|dealer|motors|lube|brake|repair/i.test(best) ? 'medium' : 'low', best);
}

function extractRepairOrder(lines: string[]): SuggestedField<string> {
  const patterns = [
    /\b(?:repair\s*order|work\s*order|ro|r\/o|r\.o\.)\s*(?:number|num|no\.?|#)?\s*[:#-]?\s*([a-z0-9][a-z0-9-]{2,})\b/i,
    /\b(?:order|invoice)\s*#\s*([a-z0-9][a-z0-9-]{2,})\b/i
  ];

  for (const line of lines.slice(0, 24)) {
    for (const pattern of patterns) {
      const match = line.match(pattern);
      const value = match?.[1]?.replace(/[.,;:]$/, '') ?? '';
      if (!value || REPAIR_ORDER_VALUE_BLOCKLIST.has(value.toLowerCase())) continue;
      if (parseDateCandidate(value)) continue;
      return field(value, 'medium', line);
    }
  }

  return field('', 'none', '');
}

function isSectionHeader(line: string): boolean {
  return /^(labor|parts|job|operation|services performed|work performed|concern|cause|correction|customer concern|description)\b/i.test(line);
}

function isTotalsOrPaymentLine(line: string): boolean {
  return /\b(subtotal|tax|shop supplies|hazmat|grand total|amount paid|amount due|balance due|total due|payment|paid|visa|mastercard|amex|discover|cash|change)\b/i.test(line);
}

function isAdministrativeLine(line: string): boolean {
  return (
    isTotalsOrPaymentLine(line) ||
    /^(invoice|receipt|estimate|repair order|ro\b|r\/o\b|customer|vehicle|vin|plate|license|advisor|technician|date|opened|closed|completed|odometer|mileage|miles)\b/i.test(line) ||
    /(^\(?\d{3}\)?[-.\s]\d{3}[-.\s]\d{4}\b|@|www\.|\b\d{5}(?:-\d{4})?\b)/i.test(line) ||
    /^\d+\s+[a-z0-9 .'-]+(?:street|st\.?|avenue|ave\.?|road|rd\.?|drive|dr\.?|lane|ln\.?|boulevard|blvd\.?)\b/i.test(line)
  );
}

function isDeclinedOrDeferred(line: string): boolean {
  return /\b(declined|deferred|recommended only|recommend|estimate|quote)\b/i.test(line);
}

function hasCategoryKeyword(line: string, category: ServiceCategory): boolean {
  return CATEGORY_RULES.some((rule) => rule.category === category && rule.keywords.some((keyword) => keywordMatches(line, keyword)));
}

function cleanDescriptionLine(line: string): string {
  return line
    .replace(/^\s*(?:labor|parts|op|line|item)?\s*[\w-]{1,8}\s*[-:]\s+/i, '')
    .replace(/\s+\$?\d+(?:,\d{3})*(?:\.\d{2})\s*$/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function extractDescription(lines: string[], category: ServiceCategory): SuggestedField<string> {
  const lowerCategory = category.toLowerCase();
  const matchedIndexes = new Set<number>();

  lines.forEach((line, index) => {
    if (isAdministrativeLine(line) || isDeclinedOrDeferred(line)) return;
    const lower = line.toLowerCase();
    if (hasCategoryKeyword(line, category) || lower.includes(lowerCategory)) matchedIndexes.add(index);
  });

  for (const index of Array.from(matchedIndexes)) {
    for (const neighbor of [index - 1, index + 1]) {
      const line = lines[neighbor];
      if (!line || isAdministrativeLine(line) || isSectionHeader(line) || isDeclinedOrDeferred(line)) continue;
      if (line.length > 72 && !hasCategoryKeyword(line, category)) continue;
      matchedIndexes.add(neighbor);
    }
  }

  const serviceLines = Array.from(matchedIndexes)
    .sort((left, right) => left - right)
    .map((index) => cleanDescriptionLine(lines[index]))
    .filter((line, index, allLines) => line.length > 0 && allLines.indexOf(line) === index)
    .slice(0, 4);

  if (serviceLines.length > 0) {
    return field(serviceLines.slice(0, 3).join('; '), 'medium', serviceLines[0]);
  }

  if (category !== 'Other') return field(category, 'low', 'Category keyword found, but no clear description line.');
  return field('', 'none', '');
}

export function suggestServiceFieldsFromOcr(text: string): SuggestedServiceFields {
  const normalized = normalizeText(text);
  const lines = linesFrom(normalized);
  const category = classifyServiceCategory(normalized);
  const serviceDate = extractDate(lines, 'service');
  const mileage = extractMileage(lines, 'service');
  const totalCost = extractTotal(lines);
  const shop = extractShop(lines);
  const description = extractDescription(lines, category.value);
  const nextRecommendedDate = extractDate(lines, 'next');
  const nextRecommendedMileage = extractMileage(lines, 'next');
  const repairOrder = extractRepairOrder(lines);
  const noteParts = ['Suggested from document. Review before saving.'];
  if (repairOrder.value) noteParts.push(`Repair order ${repairOrder.value}.`);
  const notes = normalized
    ? field(noteParts.join(' '), 'low', repairOrder.evidence || 'OCR text is available for review.')
    : field('', 'none', '');

  return {
    serviceDate,
    mileage,
    shop,
    category,
    description,
    totalCost,
    notes,
    nextRecommendedDate,
    nextRecommendedMileage
  };
}

export function emptySuggestedServiceFields(): SuggestedServiceFields {
  return {
    serviceDate: field('', 'none', ''),
    mileage: field(null, 'none', ''),
    shop: field('', 'none', ''),
    category: field(SERVICE_CATEGORIES.includes('Other') ? 'Other' : SERVICE_CATEGORIES[0], 'none', ''),
    description: field('', 'none', ''),
    totalCost: field(null, 'none', ''),
    notes: field('', 'none', ''),
    nextRecommendedDate: field('', 'none', ''),
    nextRecommendedMileage: field(null, 'none', '')
  };
}
