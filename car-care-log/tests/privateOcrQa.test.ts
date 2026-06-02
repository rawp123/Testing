import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { isOcrSupportedMime, runLocalOcr } from '../backend/ocr';

const PRIVATE_QA_ENABLED = process.env.CAR_CARE_LOG_PRIVATE_OCR_QA === '1';
const privateFixtureDir = path.resolve('fixtures/private-documents');

function mimeFromExtension(filePath: string): string {
  const extension = path.extname(filePath).toLowerCase();
  const map: Record<string, string> = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.heic': 'image/heic',
    '.pdf': 'application/pdf',
    '.txt': 'text/plain',
    '.csv': 'text/csv'
  };
  return map[extension] ?? 'application/octet-stream';
}

function listPrivateFiles(root: string): string[] {
  if (!fs.existsSync(root)) return [];
  return fs.readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(root, entry.name);
    if (entry.isDirectory()) return listPrivateFiles(fullPath);
    if (!entry.isFile()) return [];
    return [fullPath];
  });
}

describe.skipIf(!PRIVATE_QA_ENABLED)('private local OCR QA harness', () => {
  it(
    'runs local OCR against ignored private documents without snapshotting text',
    async () => {
      const files = listPrivateFiles(privateFixtureDir);
      if (files.length === 0) {
        console.warn(`No private OCR QA files found in ${privateFixtureDir}. Add ignored local fixtures to exercise this harness.`);
        expect(files).toHaveLength(0);
        return;
      }

      const summaries = [];
      for (const filePath of files) {
        const mimeType = mimeFromExtension(filePath);
        const sizeBytes = fs.statSync(filePath).size;
        const result = await runLocalOcr(filePath, mimeType, sizeBytes);
        summaries.push({
          file: path.relative(privateFixtureDir, filePath),
          mimeType,
          supported: isOcrSupportedMime(mimeType),
          status: result.status,
          textLength: result.text.length,
          hasError: Boolean(result.error)
        });
      }

      console.table(summaries);
      expect(summaries.length).toBeGreaterThan(0);
    },
    180000
  );
});
