import * as cheerio from 'cheerio';
import { type AnyNode } from 'domhandler';

import { BaseScraper, type RawVerdict, type ScraperResult } from './baseScraper.js';
import { extractPunitiveAmount, inferCaseType, inferIndustry, parseMoneyAmount } from '../lib/verdictInference.js';

const SEARCH_PATTERNS = [
  'jury awards',
  'jury verdict',
  'punitive damages',
  '$ million verdict'
] as const;

const INDUSTRY_HEURISTICS: Array<[string, string]> = [
  ['energy', 'Energy'],
  ['refinery', 'Energy'],
  ['pharmaceutical', 'Pharmaceutical'],
  ['pharma', 'Pharmaceutical'],
  ['automotive', 'Automotive'],
  ['vehicle', 'Automotive'],
  ['medical malpractice', 'Medical malpractice'],
  ['malpractice', 'Medical malpractice'],
  ['products liability', 'Products liability'],
  ['product liability', 'Products liability'],
  ['employment', 'Employment'],
  ['worker', 'Employment'],
  ['premises liability', 'Premises liability'],
  ['premises', 'Premises liability']
];

interface SearchTarget {
  sourceName: string;
  searchUrlTemplate: string;
}

const SEARCH_TARGETS: SearchTarget[] = [
  {
    sourceName: 'Law.com',
    searchUrlTemplate: 'https://www.law.com/search/?query={query}'
  },
  {
    sourceName: 'VerdictSearch',
    searchUrlTemplate: 'https://verdictsearch.com/?s={query}'
  }
];

function inferIndustryCategory(text: string): string {
  const normalized = text.toLowerCase();

  for (const [needle, label] of INDUSTRY_HEURISTICS) {
    if (normalized.includes(needle)) {
      return label;
    }
  }

  return inferIndustry(text);
}

function parseDefendant(caseName: string): string {
  const cleaned = caseName.replace(/\s+/g, ' ').trim();
  const separatorMatch = cleaned.match(/\bv\.?\b/i);

  if (!separatorMatch || separatorMatch.index === undefined) {
    return '';
  }

  return cleaned.slice(separatorMatch.index + separatorMatch[0].length).trim();
}

export class NewsSearchVerdictsScraper extends BaseScraper {
  constructor() {
    super(
      'News Search Verdicts',
      SEARCH_TARGETS.map((target) => target.searchUrlTemplate)
    );
  }

  private buildSearchUrl(template: string, query: string): string {
    return template.replace('{query}', encodeURIComponent(query));
  }

  private getTextFromDocument($: cheerio.CheerioAPI, selectors: string[]): string {
    for (const selector of selectors) {
      const text = $(selector).first().text().replace(/\s+/g, ' ').trim();
      if (text) {
        return text;
      }
    }

    return '';
  }

  private getSearchResultLinks($: cheerio.CheerioAPI, pageUrl: string): string[] {
    const links = new Set<string>();

    $('.search-result a[href], .result-card a[href], article a[href], .listing-row a[href], .search-item a[href]').each((_, element) => {
      const href = ($(element).attr('href') || '').trim();
      const absoluteUrl = this.absolutizeUrl(href, pageUrl);
      if (absoluteUrl.startsWith('http')) {
        links.add(absoluteUrl);
      }
    });

    return [...links];
  }

  private extractArticleVerdict($: cheerio.CheerioAPI, articleUrl: string, sourceName: string, query: string): RawVerdict | null {
    const headline = this.getTextFromDocument($, ['h1', '.headline', '.article-title', '.entry-title']);
    const bodyText = $('article, main, .article-body, .entry-content, body')
      .first()
      .text()
      .replace(/\s+/g, ' ')
      .trim();

    const combinedText = [headline, bodyText].filter(Boolean).join(' ');
    if (!combinedText) {
      return null;
    }

    const caseName =
      headline ||
      combinedText.match(/([A-Z][A-Za-z0-9&.,'\-\s]+?\s+v\.?\s+[A-Z][A-Za-z0-9&.,'\-\s]+)/)?.[1] ||
      '';

    const verdictAmount = parseMoneyAmount(combinedText);
    if (!caseName || !verdictAmount) {
      return null;
    }

    const punitive = extractPunitiveAmount(combinedText);
    const locationMatch = combinedText.match(/([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*,\s*[A-Z]{2})/);
    const courtMatch = combinedText.match(/((?:Superior|District|Circuit|County|State|Federal)\s+Court[^.,;]*)/i);
    const dateText = this.getTextFromDocument($, ['time', '.date', '.published', '.article-date', 'meta[property="article:published_time"]']);
    const year = this.parseYear(dateText || combinedText);
    const location = locationMatch?.[1] || '';
    const court = courtMatch?.[1] || '';
    const caseType = inferCaseType(combinedText);
    const industry = inferIndustryCategory(combinedText);

    return {
      source: sourceName,
      sourceLabel: `${sourceName} search`,
      sourceUrl: articleUrl,
      query,
      caseName,
      defendant: parseDefendant(caseName),
      location,
      state: location.split(',').pop()?.trim() || '',
      county: location.split(',')[0]?.trim() || '',
      jurisdiction: location || court,
      court,
      year,
      date: dateText,
      industry,
      caseType,
      totalVerdict: verdictAmount,
      punitive,
      notes: combinedText.slice(0, 500)
    };
  }

  async scrape(): Promise<ScraperResult> {
    const rawVerdicts: RawVerdict[] = [];

    for (const target of SEARCH_TARGETS) {
      for (const query of SEARCH_PATTERNS) {
        const searchUrl = this.buildSearchUrl(target.searchUrlTemplate, query);

        try {
          const $search = await this.fetchHtml(searchUrl);
          const articleUrls = this.getSearchResultLinks($search, searchUrl).slice(0, 12);

          for (const articleUrl of articleUrls) {
            try {
              const $article = await this.fetchHtml(articleUrl);
              const rawVerdict = this.extractArticleVerdict($article, articleUrl, target.sourceName, query);

              if (rawVerdict) {
                rawVerdicts.push(rawVerdict);
              }
            } catch (error) {
              console.warn(`[${target.sourceName}] failed to scrape article ${articleUrl}:`, error);
            }
          }
        } catch (error) {
          console.warn(`[${target.sourceName}] failed search for "${query}":`, error);
        }
      }
    }

    return {
      scraper: this.sourceName,
      rawVerdicts
    };
  }
}
