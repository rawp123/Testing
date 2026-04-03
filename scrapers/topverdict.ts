import * as cheerio from 'cheerio';

import { BaseScraper, type RawVerdict, type ScraperResult } from './baseScraper.js';
import { inferCaseType, inferIndustry, parseMoneyAmount } from '../lib/verdictInference.js';

const START_YEARS = [2024, 2023, 2022];

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function cleanLabelValue(value: string): string {
  return normalizeWhitespace(
    value
      .replace(/^[:|-]+/, '')
      .replace(/\bVisit:\b/gi, '')
  );
}

function splitTopVerdictEntries(pageText: string): string[] {
  const normalized = normalizeWhitespace(pageText)
    .replace(/NO SCREENSHOTS ALLOWED!/gi, ' ')
    .replace(/\bVisit:\b/gi, ' ')
    .replace(/\bBack to all lists\b/gi, ' ');

  return normalized
    .split(/\s(?=\d{1,3}\s+Amount:\s*\|?\s*\$)/)
    .map((entry) => entry.trim())
    .filter((entry) => /^\d{1,3}\s+Amount:\s*\|?\s*\$/i.test(entry));
}

function parseTopVerdictEntry(entryText: string, pageUrl: string, pageTitle: string, fallbackYear: number, fallbackState: string): RawVerdict | null {
  const amountMatch = entryText.match(/Amount:\s*\|?\s*(\$[\d,.\sA-Za-z]+)/i);
  const caseMatch = entryText.match(/Case:\s*\|?\s*(.+?)(?=\s+(?:Type:|State:|County:|Court:|Attorneys:|$))/i);
  const typeMatch = entryText.match(/Type:\s*\|?\s*(.+?)(?=\s+(?:State:|County:|Court:|Attorneys:|Case:|$))/i);
  const stateMatch = entryText.match(/State:\s*\|?\s*([A-Za-z][A-Za-z\s.&'-]+?)(?=\s+(?:County:|Court:|Attorneys:|Case:|$))/i);
  const countyMatch = entryText.match(/County:\s*\|?\s*([A-Za-z][A-Za-z\s.&'-]+?)(?=\s+(?:Court:|Attorneys:|Case:|$))/i);
  const courtMatch = entryText.match(/Court:\s*\|?\s*(.+?)(?=\s+(?:Attorneys:|Case:|$))/i);

  const totalVerdict = parseMoneyAmount(amountMatch?.[1] || '');
  const caseName = cleanLabelValue(caseMatch?.[1] || '');
  if (!caseName || !totalVerdict) {
    return null;
  }

  const caseTypeText = cleanLabelValue(typeMatch?.[1] || '');
  const state = cleanLabelValue(stateMatch?.[1] || fallbackState);
  const county = cleanLabelValue(countyMatch?.[1] || '');
  const court = cleanLabelValue(courtMatch?.[1] || '');
  const combinedText = [pageTitle, entryText].filter(Boolean).join(' ');
  const year = fallbackYear || Number(pageTitle.match(/\b(19|20)\d{2}\b/) || 0);

  return {
    source: 'TopVerdict',
    sourceLabel: 'TopVerdict',
    sourceUrl: pageUrl,
    caseName,
    year,
    state,
    county,
    court,
    jurisdiction: county || court || state,
    industry: inferIndustry(combinedText),
    caseType: caseTypeText || inferCaseType(combinedText),
    totalVerdict,
    notes: cleanLabelValue(entryText)
  };
}

export class TopVerdictScraper extends BaseScraper {
  constructor() {
    super(
      'TopVerdict',
      START_YEARS.map((year) => `https://topverdict.com/lists/${year}/united-states/`)
    );
  }

  private getFallbackState(pageTitle: string): string {
    const title = normalizeWhitespace(pageTitle);
    const stateMatch = title.match(/(?:in|of)\s+([A-Z][A-Za-z\s]+)\s+in\s+(19|20)\d{2}$/i);
    const location = cleanLabelValue(stateMatch?.[1] || '');
    if (location && location.toLowerCase() !== 'the united states' && location.toLowerCase() !== 'united states') {
      return location;
    }

    return '';
  }

  private getListLinks($: cheerio.CheerioAPI, pageUrl: string): string[] {
    const links = new Set<string>();

    $('a[href]').each((_, element) => {
      const href = ($(element).attr('href') || '').trim();
      const text = normalizeWhitespace($(element).text());
      const absoluteUrl = this.absolutizeUrl(href, pageUrl);

      if (!absoluteUrl.startsWith('https://topverdict.com/lists/')) {
        return;
      }

      if (!/verdict/i.test(text) && !/\/verdicts/i.test(absoluteUrl)) {
        return;
      }

      if (/settlement|bench award/i.test(text) || /\/settlements|\/bench-awards/i.test(absoluteUrl)) {
        return;
      }

      if (/number 1/i.test(text) || /top\s+(10|20|50|100)/i.test(text)) {
        links.add(absoluteUrl.replace(/\/+$/, ''));
      }
    });

    return [...links];
  }

  private extractFromListPage($: cheerio.CheerioAPI, pageUrl: string): RawVerdict[] {
    const pageTitle = normalizeWhitespace($('h1').first().text());
    const pageText = normalizeWhitespace($('body').text());
    const fallbackYear = Number(pageTitle.match(/\b(19|20)\d{2}\b/)?.[0] || 0);
    const fallbackState = this.getFallbackState(pageTitle);

    return splitTopVerdictEntries(pageText)
      .map((entry) => parseTopVerdictEntry(entry, pageUrl, pageTitle, fallbackYear, fallbackState))
      .filter(Boolean) as RawVerdict[];
  }

  async scrape(): Promise<ScraperResult> {
    const rawVerdicts: RawVerdict[] = [];
    const visitedListPages = new Set<string>();

    for (const indexUrl of this.startUrls) {
      try {
        const $index = await this.fetchHtml(indexUrl);
        const listUrls = this.getListLinks($index, indexUrl);

        for (const listUrl of listUrls) {
          if (visitedListPages.has(listUrl)) {
            continue;
          }

          visitedListPages.add(listUrl);

          try {
            const $list = await this.fetchHtml(listUrl);
            rawVerdicts.push(...this.extractFromListPage($list, listUrl));
          } catch (error) {
            console.warn(`[${this.sourceName}] failed to scrape list ${listUrl}:`, error);
          }
        }
      } catch (error) {
        console.warn(`[${this.sourceName}] failed to scrape index ${indexUrl}:`, error);
      }
    }

    return {
      scraper: this.sourceName,
      rawVerdicts
    };
  }
}
