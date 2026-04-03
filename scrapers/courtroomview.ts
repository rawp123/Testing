import { BaseScraper, type RawVerdict, type ScraperResult } from './baseScraper.js';

export class CourtroomViewScraper extends BaseScraper {
  constructor() {
    super('Courtroom View', [
      'https://www.courtroomview.com/verdicts'
    ]);
  }

  async scrape(): Promise<ScraperResult> {
    const rawVerdicts: RawVerdict[] = [];

    for (const url of this.startUrls) {
      try {
        const $ = await this.fetchHtml(url);

        $('.verdict-card, .verdict-listing, article.verdict').each((_, element) => {
          const $card = $(element);
          const detailUrl = this.absolutizeUrl(
            this.getAttr($card, 'a[href]', 'href'),
            url
          );

          rawVerdicts.push({
            source: this.sourceName,
            sourceUrl: detailUrl || url,
            caseName: this.getText($card, '.verdict-title, .case-title, h2, h3'),
            year: this.parseYear(this.getText($card, '.verdict-date, .date, .meta')),
            state: this.getText($card, '.state, .venue-state'),
            county: this.getText($card, '.county, .venue-county'),
            court: this.getText($card, '.court, .venue-court'),
            jurisdiction: this.getText($card, '.jurisdiction, .venue, .county'),
            industry: this.getText($card, '.industry, .practice-industry'),
            caseType: this.getText($card, '.case-type, .practice-area'),
            totalVerdict: this.parseMoney(this.getText($card, '.total-verdict, .verdict-amount, .award')),
            compensatory: this.parseMoney(this.getText($card, '.compensatory, .comp-damages')),
            punitive: this.parseMoney(this.getText($card, '.punitive, .punitive-damages')),
            notes: this.getText($card, '.summary, .excerpt, .description')
          });
        });
      } catch (error) {
        console.warn(`[${this.sourceName}] failed to scrape ${url}:`, error);
      }
    }

    return {
      scraper: this.sourceName,
      rawVerdicts
    };
  }
}
