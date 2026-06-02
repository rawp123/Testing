import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { createRequire } from 'node:module';
import { promisify } from 'node:util';
import { createCanvas } from '@napi-rs/canvas';
import { createWorker } from 'tesseract.js';
import type { OcrStatus } from '../shared/types';
import { userSafeErrorMessage } from '../shared/safeErrors';
import { preferUnpackedPath } from './runtimePaths';

export const OCR_MAX_BYTES = 15 * 1024 * 1024;
export const PDF_TEXT_PAGE_LIMIT = 8;
export const PDF_SCANNED_PAGE_OCR_LIMIT = 3;
export const PDF_RENDER_SCALE = 2;
export const OCR_TEXT_MAX_CHARS = 250000;

const SUPPORTED_IMAGE_MIME_TYPES = new Set(['image/png', 'image/jpeg']);
const SUPPORTED_TEXT_MIME_TYPES = new Set(['text/plain', 'text/csv']);
const SUPPORTED_PDF_MIME_TYPES = new Set(['application/pdf']);
const execFileAsync = promisify(execFile);

export interface LocalOcrResult {
  status: OcrStatus;
  text: string;
  error: string;
  detail?: string;
}

interface PdfTextExtractionResult {
  text: string;
  pageCount: number;
  pagesRead: number;
}

interface PdfRenderResult {
  imagePaths: string[];
  tempDir: string;
  pageCount: number;
  pagesRendered: number;
}

export function isOcrSupportedMime(mimeType: string): boolean {
  return SUPPORTED_IMAGE_MIME_TYPES.has(mimeType) || SUPPORTED_TEXT_MIME_TYPES.has(mimeType) || SUPPORTED_PDF_MIME_TYPES.has(mimeType);
}

export function ocrUnavailableReason(mimeType: string): string {
  if (mimeType === 'image/heic') {
    return 'HEIC images need a local conversion step before OCR can run.';
  }
  if (mimeType === 'image/webp' || mimeType === 'image/gif') {
    return 'This image type is stored locally, but OCR is currently limited to PNG and JPEG files.';
  }
  return 'This file type is stored locally, but OCR is not available for it yet.';
}

async function recognizeImage(filePath: string): Promise<LocalOcrResult> {
  const require = createRequire(import.meta.url);
  const englishData = require('@tesseract.js-data/eng') as { langPath: string; gzip: boolean };
  let worker: Awaited<ReturnType<typeof createWorker>> | null = null;

  try {
    worker = await createWorker('eng', undefined, {
      langPath: preferUnpackedPath(englishData.langPath),
      gzip: englishData.gzip,
      cacheMethod: 'none',
      logger: () => {}
    });
    await worker.setParameters({
      preserve_interword_spaces: '1'
    });
    const result = await worker.recognize(filePath);
    const text = (result.data.text ?? '').trim();
    return {
      status: text ? 'extracted' : 'failed',
      text,
      error: text ? '' : 'No readable text was found in this image.'
    };
  } catch (error) {
    return {
      status: 'failed',
      text: '',
      error: userSafeErrorMessage(error, 'Text extraction failed locally. Try another file or a clearer scan.')
    };
  } finally {
    await worker?.terminate();
  }
}

async function extractPdfText(filePath: string): Promise<PdfTextExtractionResult> {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const require = createRequire(import.meta.url);
  const pdfjsRoot = path.dirname(require.resolve('pdfjs-dist/package.json'));
  const standardFontDataUrl = preferUnpackedPath(path.join(pdfjsRoot, 'standard_fonts')) + path.sep;
  const data = new Uint8Array(fs.readFileSync(filePath));
  const loadingTask = pdfjs.getDocument({
    data,
    disableFontFace: true,
    standardFontDataUrl,
    useWorkerFetch: false
  });
  const pdf = await loadingTask.promise;
  const pageCount = Math.min(pdf.numPages, PDF_TEXT_PAGE_LIMIT);
  const totalPages = pdf.numPages;
  const chunks: string[] = [];

  for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item: unknown) => {
        if (typeof item === 'object' && item !== null && 'str' in item && typeof item.str === 'string') {
          return item.str;
        }
        return '';
      })
      .filter(Boolean)
      .join(' ');
    if (pageText.trim()) chunks.push(pageText.trim());
  }

  await loadingTask.destroy();
  return {
    text: chunks.join('\n').trim(),
    pageCount: totalPages,
    pagesRead: pageCount
  };
}

async function renderPdfPagesWithPdfJs(filePath: string): Promise<PdfRenderResult> {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const require = createRequire(import.meta.url);
  const pdfjsRoot = path.dirname(require.resolve('pdfjs-dist/package.json'));
  const standardFontDataUrl = preferUnpackedPath(path.join(pdfjsRoot, 'standard_fonts')) + path.sep;
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'car-care-log-pdf-ocr-'));
  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(fs.readFileSync(filePath)),
    disableFontFace: true,
    standardFontDataUrl,
    useWorkerFetch: false
  });

  try {
    const pdf = await loadingTask.promise;
    const pagesRendered = Math.min(pdf.numPages, PDF_SCANNED_PAGE_OCR_LIMIT);
    const imagePaths: string[] = [];

    for (let pageNumber = 1; pageNumber <= pagesRendered; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const viewport = page.getViewport({ scale: PDF_RENDER_SCALE });
      const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
      const canvasContext = canvas.getContext('2d');
      await page
        .render({
          canvas: null,
          canvasContext: canvasContext as unknown as CanvasRenderingContext2D,
          viewport,
          background: 'rgb(255,255,255)'
        })
        .promise;

      const imagePath = path.join(tempDir, `page-${pageNumber}.png`);
      fs.writeFileSync(imagePath, canvas.toBuffer('image/png'));
      imagePaths.push(imagePath);
    }

    return {
      imagePaths,
      tempDir,
      pageCount: pdf.numPages,
      pagesRendered
    };
  } catch (error) {
    fs.rmSync(tempDir, { recursive: true, force: true });
    throw error;
  } finally {
    await loadingTask.destroy();
  }
}

async function rasterizePdfFirstPageWithMacPreview(filePath: string): Promise<PdfRenderResult> {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'car-care-log-pdf-ocr-'));
  const outputPath = path.join(tempDir, 'page-1.png');

  try {
    await execFileAsync('/usr/bin/sips', ['-s', 'format', 'png', filePath, '--out', outputPath], {
      timeout: 30000,
      maxBuffer: 1024 * 1024
    });
    if (fs.existsSync(outputPath)) {
      return { imagePaths: [outputPath], tempDir, pageCount: 1, pagesRendered: 1 };
    }
  } catch {
    // Fall through to Quick Look thumbnail generation below.
  }

  await execFileAsync('/usr/bin/qlmanage', ['-t', '-s', '1400', '-o', tempDir, filePath], {
    timeout: 30000,
    maxBuffer: 1024 * 1024
  });
  const quickLookOutput = path.join(tempDir, `${path.basename(filePath)}.png`);
  if (!fs.existsSync(quickLookOutput)) {
    fs.rmSync(tempDir, { recursive: true, force: true });
    throw new Error('The local PDF preview image could not be created.');
  }
  return { imagePaths: [quickLookOutput], tempDir, pageCount: 1, pagesRendered: 1 };
}

export function canUseNativePdfPreviewFallback(platform: NodeJS.Platform = process.platform): boolean {
  return platform === 'darwin';
}

async function renderPdfPagesForOcr(filePath: string): Promise<PdfRenderResult> {
  try {
    return await renderPdfPagesWithPdfJs(filePath);
  } catch (error) {
    if (!canUseNativePdfPreviewFallback()) {
      throw error;
    }
    return rasterizePdfFirstPageWithMacPreview(filePath);
  }
}

async function recognizeImages(imagePaths: string[], totalPageCount: number, pagesRendered: number): Promise<LocalOcrResult> {
  const chunks: string[] = [];
  const failedPages: number[] = [];

  for (let index = 0; index < imagePaths.length; index += 1) {
    const result = await recognizeImage(imagePaths[index]);
    if (result.text) {
      chunks.push(`Page ${index + 1}\n${result.text}`);
    } else {
      failedPages.push(index + 1);
    }
  }

  const text = chunks.join('\n\n').trim();
  if (!text) {
    return {
      status: 'failed',
      text: '',
      error: `No readable text was found in the first ${pagesRendered} page${pagesRendered === 1 ? '' : 's'} of this PDF.`
    };
  }

  const limitNote =
    totalPageCount > pagesRendered
      ? ` Scanned PDF OCR read the first ${pagesRendered} of ${totalPageCount} pages for this version.`
      : '';
  const failedNote =
    failedPages.length > 0 ? ` OCR could not read page${failedPages.length === 1 ? '' : 's'} ${failedPages.join(', ')}.` : '';

  return {
    status: limitNote || failedNote ? 'partial' : 'extracted',
    text: text.slice(0, OCR_TEXT_MAX_CHARS),
    error: `${limitNote}${failedNote}`.trim(),
    detail: `${limitNote}${failedNote}`.trim()
  };
}

async function runLocalPdfOcr(filePath: string): Promise<LocalOcrResult> {
  try {
    const embedded = await extractPdfText(filePath);
    if (embedded.text.length >= 20) {
      const limitNote =
        embedded.pageCount > embedded.pagesRead
          ? `Embedded PDF text extraction read the first ${embedded.pagesRead} of ${embedded.pageCount} pages for this version.`
          : '';
      return {
        status: limitNote ? 'partial' : 'extracted',
        text: embedded.text.slice(0, OCR_TEXT_MAX_CHARS),
        error: limitNote,
        detail: limitNote
      };
    }
  } catch {
    // Some scanned PDFs do not expose text. Raster OCR below keeps the workflow local.
  }

  let rendered: PdfRenderResult | null = null;
  try {
    rendered = await renderPdfPagesForOcr(filePath);
    return await recognizeImages(rendered.imagePaths, rendered.pageCount, rendered.pagesRendered);
  } catch (error) {
    return {
      status: 'failed',
      text: '',
      error: userSafeErrorMessage(error, 'Text extraction failed locally. Try another file or a clearer scan.')
    };
  } finally {
    if (rendered) {
      fs.rmSync(rendered.tempDir, { recursive: true, force: true });
    }
  }
}

export async function runLocalOcr(filePath: string, mimeType: string, sizeBytes: number): Promise<LocalOcrResult> {
  if (sizeBytes > OCR_MAX_BYTES) {
    return {
      status: 'failed',
      text: '',
      error: 'This file is larger than the local OCR size limit for this version.'
    };
  }

  if (!isOcrSupportedMime(mimeType)) {
    return {
      status: 'unavailable',
      text: '',
      error: ocrUnavailableReason(mimeType)
    };
  }

  if (SUPPORTED_TEXT_MIME_TYPES.has(mimeType)) {
    return {
      status: 'extracted',
      text: fs.readFileSync(filePath, 'utf8').slice(0, OCR_TEXT_MAX_CHARS),
      error: ''
    };
  }

  if (SUPPORTED_PDF_MIME_TYPES.has(mimeType)) {
    return runLocalPdfOcr(filePath);
  }

  return recognizeImage(filePath);
}
