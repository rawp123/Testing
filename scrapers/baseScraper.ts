import axios, { type AxiosInstance } from 'axios';
import * as cheerio from 'cheerio';
import { type AnyNode } from 'domhandler';

import { parseMoneyAmount } from '../lib/verdictInference.js';

export type RawVerdict = Record<string, unknown>;

export interface VerdictRecord {
  id: string;
  caseName: string;
  year: number;
  state: string;
  county: string;
  jurisdiction: string;
  court: string;
  industry: string;
  caseType: string;
  totalVerdict: number;
  compensatory: number;
  compensatoryDamages: number;
  punitive: number;
  punitiveDamages: number;
  hasPunitive: boolean;
  source: string;
  sourceLabel: string;
  sourceUrl: string;
  verificationStatus: string;
  updatedAt: string;
  verdictBucket: string;
  captionType: string;
  notes: string;
}

export interface ScraperResult {
  scraper: string;
  rawVerdicts: RawVerdict[];
}

export abstract class BaseScraper {
  protected readonly client: AxiosInstance;

  constructor(
    public readonly sourceName: string,
    public readonly startUrls: string[]
  ) {
    this.client = axios.create({
      timeout: 20000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; NuclearVerdictTrackerBot/1.0; +https://example.com)'
      }
    });
  }

  protected async fetchHtml(url: string): Promise<cheerio.CheerioAPI> {
    const response = await this.client.get<string>(url);
    return cheerio.load(response.data);
  }

  protected getText($root: cheerio.Cheerio<AnyNode>, selector: string): string {
    return $root.find(selector).first().text().replace(/\s+/g, ' ').trim();
  }

  protected getAttr($root: cheerio.Cheerio<AnyNode>, selector: string, attr: string): string {
    return ($root.find(selector).first().attr(attr) || '').trim();
  }

  protected parseMoney(value: string): number {
    return parseMoneyAmount(value);
  }

  protected parseYear(value: string): number {
    const match = value.match(/(19|20)\d{2}/);
    return match ? Number(match[0]) : 0;
  }

  protected absolutizeUrl(url: string, baseUrl: string): string {
    if (!url) {
      return '';
    }

    try {
      return new URL(url, baseUrl).toString();
    } catch {
      return url;
    }
  }

  abstract scrape(): Promise<ScraperResult>;
}
