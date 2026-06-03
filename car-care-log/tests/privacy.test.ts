import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CarCareDatabase, getStoragePaths } from '../backend/database';

let tempRoot = '';
let db: CarCareDatabase;

beforeEach(async () => {
  tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'car-care-log-privacy-test-'));
  db = new CarCareDatabase(getStoragePaths(tempRoot));
  await db.initialize();
});

afterEach(() => {
  fs.rmSync(tempRoot, { recursive: true, force: true });
});

function readSourceFiles(dir: string): string {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  return entries
    .flatMap((entry) => {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) return readSourceFiles(fullPath);
      if (!/\.(ts|tsx|html|css)$/.test(entry.name)) return '';
      return fs.readFileSync(fullPath, 'utf8');
    })
    .join('\\n');
}

function createServiceRecord(): string {
  const vehicle = db.createVehicle({
    nickname: 'Security Test Car',
    year: null,
    make: '',
    model: '',
    trim: '',
    vin: '',
    licensePlate: '',
    purchaseDate: '',
    startingMileage: null,
    currentMileage: null,
    notes: ''
  });
  const service = db.createServiceRecord({
    vehicleId: vehicle.id,
    serviceDate: '2026-03-12',
    mileage: null,
    shop: '',
    category: 'Other',
    description: 'Document intake security test',
    totalCost: null,
    notes: '',
    nextRecommendedDate: '',
    nextRecommendedMileage: null
  });
  return service.id;
}

describe('privacy and local-only OCR posture', () => {
  it('does not add browser network APIs or cloud OCR endpoints to source code', () => {
    const source = ['backend', 'desktop', 'frontend', 'shared', 'website']
      .map((directory) => readSourceFiles(path.join(process.cwd(), directory)))
      .join('\\n');

    expect(source).not.toMatch(/\bfetch\s*\(/);
    expect(source).not.toMatch(/\bXMLHttpRequest\b/);
    expect(source).not.toMatch(/\baxios\b/);
    expect(source).not.toMatch(/\bnavigator\.sendBeacon\b|\bWebSocket\b|\bEventSource\b/);
    expect(source).not.toMatch(/from\s+['"]node:https?['"]|require\(['"]node:https?['"]\)/);
    expect(source).not.toMatch(
      /vision\.google|google-cloud\/vision|\btextract\b|\baws-sdk\b|@azure\/ai-form-recognizer|@azure-rest\/ai-document-intelligence|formrecognizer|documentintelligence|\bopenai\b|api\.ocr|ocr\.space/i
    );
  });

  it('does not add cloud OCR client packages', () => {
    const packageJson = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf8')) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    const dependencyNames = Object.keys({
      ...(packageJson.dependencies ?? {}),
      ...(packageJson.devDependencies ?? {})
    });

    expect(dependencyNames).not.toEqual(
      expect.arrayContaining([
        '@google-cloud/vision',
        '@aws-sdk/client-textract',
        '@azure/ai-form-recognizer',
        '@azure-rest/ai-document-intelligence',
        'aws-sdk',
        'openai',
        'ocr-space-api-wrapper'
      ])
    );
  });

  it('keeps traversal-looking document filenames inside app-managed attachment storage', () => {
    const serviceRecordId = createServiceRecord();
    const sourcePath = path.join(tempRoot, 'receipt-source.txt');
    fs.writeFileSync(sourcePath, 'Local receipt text');

    const attachment = db.addAttachmentFromLocalFile(
      { serviceRecordId, label: '', type: 'receipt' },
      sourcePath,
      '../../private/../receipts/escaped-receipt.pdf'
    );
    const stored = db.getAttachmentFileForOcr(attachment.id);
    const attachmentsDir = path.resolve(getStoragePaths(tempRoot).attachmentsDir);
    const relativeStoredPath = path.relative(attachmentsDir, stored.filePath);

    expect(stored.originalFileName).toBe('escaped-receipt.pdf');
    expect(path.resolve(stored.filePath).startsWith(`${attachmentsDir}${path.sep}`)).toBe(true);
    expect(relativeStoredPath).not.toContain('..');
    expect(path.basename(stored.filePath)).toMatch(new RegExp(`^${attachment.id}\\.pdf$`));
    expect(fs.existsSync(stored.filePath)).toBe(true);
  });

  it('strips control characters from original attachment filename metadata', () => {
    const serviceRecordId = createServiceRecord();
    const sourcePath = path.join(tempRoot, 'receipt-source.txt');
    fs.writeFileSync(sourcePath, 'Local receipt text');

    const attachment = db.addAttachmentFromLocalFile(
      { serviceRecordId, label: '', type: 'receipt' },
      sourcePath,
      'vehicle\\receipts\\oil\u0000-change\ninvoice\t2026.PDF'
    );
    const stored = db.getAttachmentFileForOcr(attachment.id);

    expect(stored.originalFileName).toBe('oil-changeinvoice2026.PDF');
    expect([...stored.originalFileName].some((char) => {
      const code = char.charCodeAt(0);
      return code < 32 || code === 127;
    })).toBe(false);
    expect(path.basename(stored.filePath)).toMatch(new RegExp(`^${attachment.id}\\.pdf$`));
  });
});
