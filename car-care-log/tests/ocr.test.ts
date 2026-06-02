import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { OCR_MAX_BYTES, canUseNativePdfPreviewFallback, isOcrSupportedMime, ocrUnavailableReason, runLocalOcr } from '../backend/ocr';

const execFileMock = vi.hoisted(() =>
  vi.fn((...args: unknown[]) => {
    const callback = args.at(-1);
    if (typeof callback === 'function') {
      callback(new Error('mocked local PDF preview failure'), '', '');
    }
  })
);
const recognizedImagePaths = vi.hoisted(() => [] as string[]);
const tesseractRecognizeMock = vi.hoisted(() =>
  vi.fn(async (filePath: string) => {
    recognizedImagePaths.push(filePath);
    const pageMatch = filePath.match(/page-(\d+)\.png$/);
    return {
      data: {
        text: pageMatch ? `Scanned PDF page ${pageMatch[1]} coolant service` : 'Local image OCR text'
      }
    };
  })
);
const createWorkerMock = vi.hoisted(() => vi.fn());

vi.mock('node:child_process', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:child_process')>();
  return {
    ...actual,
    execFile: execFileMock
  };
});

vi.mock('tesseract.js', () => ({
  createWorker: createWorkerMock
}));

let tempRoot = '';

beforeEach(() => {
  vi.clearAllMocks();
  createWorkerMock.mockImplementation(async () => ({
    setParameters: vi.fn(async () => {}),
    recognize: tesseractRecognizeMock,
    terminate: vi.fn(async () => {})
  }));
  recognizedImagePaths.length = 0;
  tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'car-care-log-ocr-test-'));
});

afterEach(() => {
  fs.rmSync(tempRoot, { recursive: true, force: true });
});

function escapePdfText(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

function createSimplePdf(lines: string[]): Buffer {
  const content = ['BT /F1 14 Tf 72 720 Td', ...lines.map((line, index) => `${index === 0 ? '' : '0 -20 Td '}(${escapePdfText(line)}) Tj`), 'ET'].join('\n');
  const objects = [
    '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n',
    '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n',
    '3 0 obj\n<< /Type /Page /Parent 2 0 R /Resources << /Font << /F1 4 0 R >> >> /MediaBox [0 0 612 792] /Contents 5 0 R >>\nendobj\n',
    '4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n',
    `5 0 obj\n<< /Length ${Buffer.byteLength(content, 'utf8')} >>\nstream\n${content}\nendstream\nendobj\n`
  ];
  let pdf = '%PDF-1.4\n';
  const offsets = [0];

  for (const object of objects) {
    offsets.push(Buffer.byteLength(pdf, 'utf8'));
    pdf += object;
  }

  const xrefOffset = Buffer.byteLength(pdf, 'utf8');
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  pdf += offsets
    .slice(1)
    .map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`)
    .join('');
  pdf += `trailer\n<< /Root 1 0 R /Size ${objects.length + 1} >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return Buffer.from(pdf, 'utf8');
}

function createBlankPdf(pageCount: number): Buffer {
  const pageRefs = Array.from({ length: pageCount }, (_value, index) => `${3 + index * 2} 0 R`).join(' ');
  const objects = [
    '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n',
    `2 0 obj\n<< /Type /Pages /Kids [${pageRefs}] /Count ${pageCount} >>\nendobj\n`
  ];

  for (let index = 0; index < pageCount; index += 1) {
    const pageObjectNumber = 3 + index * 2;
    const contentObjectNumber = pageObjectNumber + 1;
    objects.push(
      `${pageObjectNumber} 0 obj\n<< /Type /Page /Parent 2 0 R /Resources << >> /MediaBox [0 0 612 792] /Contents ${contentObjectNumber} 0 R >>\nendobj\n`,
      `${contentObjectNumber} 0 obj\n<< /Length 0 >>\nstream\n\nendstream\nendobj\n`
    );
  }

  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  for (const object of objects) {
    offsets.push(Buffer.byteLength(pdf, 'utf8'));
    pdf += object;
  }

  const xrefOffset = Buffer.byteLength(pdf, 'utf8');
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  pdf += offsets
    .slice(1)
    .map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`)
    .join('');
  pdf += `trailer\n<< /Root 1 0 R /Size ${objects.length + 1} >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return Buffer.from(pdf, 'utf8');
}

describe('local OCR service guardrails', () => {
  it('only allows native PDF preview fallback on macOS', () => {
    expect(canUseNativePdfPreviewFallback('darwin')).toBe(true);
    expect(canUseNativePdfPreviewFallback('linux')).toBe(false);
    expect(canUseNativePdfPreviewFallback('win32')).toBe(false);
  });

  it('rejects oversized files before reading or processing document contents', async () => {
    const filePath = path.join(tempRoot, 'oversized-receipt.txt');
    fs.writeFileSync(filePath, 'small placeholder');

    const result = await runLocalOcr(filePath, 'text/plain', OCR_MAX_BYTES + 1);

    expect(result.status).toBe('failed');
    expect(result.text).toBe('');
    expect(result.error).toContain('size limit');
    expect(execFileMock).not.toHaveBeenCalled();
  });

  it('extracts text files locally without network services', async () => {
    const filePath = path.join(tempRoot, 'receipt.txt');
    fs.writeFileSync(filePath, 'Northside Auto\\nCoolant flush\\nTotal $189.40');

    const result = await runLocalOcr(filePath, 'text/plain', fs.statSync(filePath).size);

    expect(result.status).toBe('extracted');
    expect(result.text).toContain('Coolant flush');
    expect(result.error).toBe('');
  });

  it('handles unusual local filenames without changing OCR behavior', async () => {
    const filePath = path.join(tempRoot, 'receipt .. final [copy] #1.txt');
    fs.writeFileSync(filePath, 'Southside Auto\\nBrake inspection\\nTotal $88.00');

    const result = await runLocalOcr(filePath, 'text/plain', fs.statSync(filePath).size);

    expect(result.status).toBe('extracted');
    expect(result.text).toContain('Brake inspection');
    expect(result.error).toBe('');
  });

  it('fails safely when the local OCR worker cannot start', async () => {
    createWorkerMock.mockRejectedValueOnce(new Error("worker failed while opening '/Users/example/private/receipt.png'"));
    const filePath = path.join(tempRoot, 'receipt.png');
    fs.writeFileSync(filePath, 'placeholder');

    const result = await runLocalOcr(filePath, 'image/png', fs.statSync(filePath).size);

    expect(result.status).toBe('failed');
    expect(result.text).toBe('');
    expect(result.error).not.toContain('/Users/example');
    expect(result.error).toContain('[local file]');
  });

  it('extracts embedded PDF text locally without uploading documents', async () => {
    const filePath = path.join(tempRoot, 'receipt.pdf');
    fs.writeFileSync(
      filePath,
      createSimplePdf(['NORTHSIDE AUTO', 'Invoice Date 03/12/2026', 'Coolant flush and inspection', 'Total $189.40'])
    );

    const result = await runLocalOcr(filePath, 'application/pdf', fs.statSync(filePath).size);

    expect(isOcrSupportedMime('application/pdf')).toBe(true);
    expect(result.status).toBe('extracted');
    expect(result.text).toContain('Coolant flush');
    expect(result.error).toBe('');
  });

  it('OCRs multiple scanned PDF pages locally with a bounded page limit', async () => {
    const filePath = path.join(tempRoot, 'scanned-receipt.pdf');
    fs.writeFileSync(filePath, createBlankPdf(4));

    const result = await runLocalOcr(filePath, 'application/pdf', fs.statSync(filePath).size);

    expect(result.status).toBe('partial');
    expect(result.text).toContain('Scanned PDF page 1');
    expect(result.text).toContain('Scanned PDF page 2');
    expect(result.text).toContain('Scanned PDF page 3');
    expect(result.text).not.toContain('Scanned PDF page 4');
    expect(result.detail).toContain('first 3 of 4 pages');
    expect(recognizedImagePaths).toHaveLength(3);
    expect(execFileMock).not.toHaveBeenCalled();
    for (const imagePath of recognizedImagePaths) {
      expect(fs.existsSync(imagePath)).toBe(false);
    }
  });

  it('fails corrupt PDFs locally without falling back to upload-style processing', async () => {
    const filePath = path.join(tempRoot, 'corrupt-receipt.pdf');
    fs.writeFileSync(filePath, '%PDF-1.4\\nthis is not a valid document body\\n%%EOF');

    const result = await runLocalOcr(filePath, 'application/pdf', fs.statSync(filePath).size);

    expect(result.status).toBe('failed');
    expect(result.text).toBe('');
    if (canUseNativePdfPreviewFallback()) {
      expect(result.error).toContain('mocked local PDF preview failure');
      expect(execFileMock).toHaveBeenCalled();
      expect(execFileMock.mock.calls.map((call) => call[0])).toEqual(['/usr/bin/sips', '/usr/bin/qlmanage']);
    } else {
      expect(execFileMock).not.toHaveBeenCalled();
    }
  });

  it('marks unsupported document types as unavailable instead of uploading them', async () => {
    const filePath = path.join(tempRoot, 'receipt.heic');
    fs.writeFileSync(filePath, 'placeholder');

    const result = await runLocalOcr(filePath, 'image/heic', fs.statSync(filePath).size);

    expect(isOcrSupportedMime('image/heic')).toBe(false);
    expect(result.status).toBe('unavailable');
    expect(result.error).toContain('conversion');
    expect(ocrUnavailableReason('image/heic')).toContain('conversion');
  });

  it('keeps other unsupported image formats unavailable with local-only messaging', async () => {
    const webpPath = path.join(tempRoot, 'receipt.webp');
    const gifPath = path.join(tempRoot, 'receipt.gif');
    fs.writeFileSync(webpPath, 'placeholder');
    fs.writeFileSync(gifPath, 'placeholder');

    const webpResult = await runLocalOcr(webpPath, 'image/webp', fs.statSync(webpPath).size);
    const gifResult = await runLocalOcr(gifPath, 'image/gif', fs.statSync(gifPath).size);

    expect(isOcrSupportedMime('image/webp')).toBe(false);
    expect(isOcrSupportedMime('image/gif')).toBe(false);
    expect(webpResult).toMatchObject({
      status: 'unavailable',
      text: ''
    });
    expect(gifResult).toMatchObject({
      status: 'unavailable',
      text: ''
    });
    expect(webpResult.error).toContain('stored locally');
    expect(gifResult.error).toContain('stored locally');
  });
});
