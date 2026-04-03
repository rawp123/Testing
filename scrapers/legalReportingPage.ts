import * as cheerio from 'cheerio';
import { type AnyNode } from 'domhandler';

import { BaseScraper, type RawVerdict, type ScraperResult } from './baseScraper.js';
import {
  extractPunitiveAmount,
  inferCaseType,
  inferIndustry,
  parseMoneyAmount
} from '../lib/verdictInference.js';

interface LegalReportingScraperOptions {
  sourceName: string;
  startUrls: string[];
}

export class LegalReportingPageScraper extends BaseScraper {
  constructor(options: LegalReportingScraperOptions) {
    super(options.sourceName, options.startUrls);
  }

  private getCardText($card: cheerio.Cheerio<AnyNode>): string {
    return $card.text().replace(/\s+/g, ' ').trim();
  }

  private extractLocation($card: cheerio.Cheerio<AnyNode>, cardText: string): { location: string; state: string; county: string; court: string; jurisdiction: string } {
    const location = this.getText($card, '.location, .venue, .jurisdiction, .court-location') || cardText.match(/([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*,\s*[A-Z]{2})/)?.[1] || '';
    const county = this.getText($card, '.county, .venue-county') || location;
    const court = this.getText($card, '.court, .venue-court');
    const state = this.getText($card, '.state, .venue-state') || location.split(',').pop()?.trim() || '';
    const jurisdiction = this.getText($card, '.jurisdiction, .venue') || county || court || location;

    return { location, state, county, court, jurisdiction };
  }

  private extractVerdictCard($: cheerio.CheerioAPI, element: AnyNode, pageUrl: string): RawVerdict | null {
    const $card = $(element);
    const cardText = this.getCardText($card);
    const caseName = this.getText($card, '.case-title, .verdict-title, .result-title, .headline, h2, h3, h4');

    if (!caseName) {
      return null;
    }

    const amountText =
      this.getText($card, '.verdict-amount, .amount, .award, .damages, .result-amount') ||
      cardText.match(/\$[\d,.]+\s*(?:billion|bn|million|mm|m|thousand|k)?/i)?.[0] ||
      '';

    const { location, state, county, court, jurisdiction } = this.extractLocation($card, cardText);
    const sourceUrl = this.absolutizeUrl(this.getAttr($card, 'a[href]', 'href'), pageUrl) || pageUrl;
    const caseType = this.getText($card, '.case-type, .practice-area, .category') || inferCaseType(cardText);
    const industry = this.getText($card, '.industry, .sector') || inferIndustry(cardText);

    return {
      source: this.sourceName,
      sourceUrl,
      caseName,
      location,
      state,
      county,
      court,
      jurisdiction,
      industry,
      caseType,
      totalVerdict: parseMoneyAmount(amountText),
      punitive: extractPunitiveAmount(cardText),
      notes: this.getText($card, '.summary, .excerpt, .dek, .description, p'),
      year: this.parseYear(this.getText($card, '.date, .year, time, .meta') || cardText),
      sourceLabel: this.sourceName
    };
  }

  async scrape(): Promise<ScraperResult> {
    const rawVerdicts: RawVerdict[] = [];

    for (const pageUrl of this.startUrls) {
      try {
        const $ = await this.fetchHtml(pageUrl);
        $('.search-result, .result-card, .verdict-card, .verdict-listing, .listing-row, article').each((_, element) => {
          const verdict = this.extractVerdictCard($, element, pageUrl);
          if (verdict) {
            rawVerdicts.push(verdict);
          }
        });
      } catch (error) {
        console.warn(`[${this.sourceName}] failed to scrape ${pageUrl}:`, error);
      }
    }

    return {
      scraper: this.sourceName,
      rawVerdicts
    };
  }
}
