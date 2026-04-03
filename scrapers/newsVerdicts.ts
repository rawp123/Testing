import { type ScraperResult } from './baseScraper.js';
import { LegalReportingPageScraper } from './legalReportingPage.js';

export class NewsVerdictsScraper extends LegalReportingPageScraper {
  constructor() {
    super({
      sourceName: 'News Verdicts',
      startUrls: [
      'https://verdictsearch.com/verdicts',
      'https://www.law.com/verdict-search/'
      ]
    });
  }
}

export type { ScraperResult };
