const fs = require('fs/promises');
const path = require('path');
const os = require('os');
const { execFile } = require('child_process');
const { promisify } = require('util');

const execFileAsync = promisify(execFile);

const ROOT_DIR = path.resolve(__dirname, '..', '..');
const DATA_DIR = path.join(ROOT_DIR, 'data');
const MDL_DIR = path.join(DATA_DIR, 'mdl');
const PDF_DIR = path.join(DATA_DIR, 'pdfs');
const METADATA_PATH = path.join(DATA_DIR, 'jpml-listing-metadata.json');

const JPML_BASE_URL = 'https://www.jpml.uscourts.gov';
const JPML_SOURCE_PAGES = [
  `${JPML_BASE_URL}/pending-mdls-0`,
  `${JPML_BASE_URL}/pending-mdl-statistics-0`,
  `${JPML_BASE_URL}/pending-mdls`,
  `${JPML_BASE_URL}/pending-mdl-reports-archive`
];
const DEFAULT_HEADERS = {
  'user-agent': 'jpml-dashboard-updater/1.0'
};

const MONTH_MAP = new Map([
  ['january', 1],
  ['february', 2],
  ['march', 3],
  ['april', 4],
  ['may', 5],
  ['june', 6],
  ['july', 7],
  ['august', 8],
  ['september', 9],
  ['october', 10],
  ['november', 11],
  ['december', 12]
]);

const DEFAULT_METADATA = {
  importedReportDate: null,
  importedSourceUrl: null,
  importedFileName: null,
  lastCheckedAt: null,
  lastCheckStatus: null,
  lastCheckMessage: null,
  lastImportAt: null,
  lastImportStatus: 'idle',
  lastImportError: null
};

function isoFromParts(year, month, day) {
  return [
    String(year).padStart(4, '0'),
    String(month).padStart(2, '0'),
    String(day).padStart(2, '0')
  ].join('-');
}

function compareIsoDates(left, right) {
  if (!left && !right) return 0;
  if (!left) return -1;
  if (!right) return 1;
  return left.localeCompare(right);
}

function safeUrl(rawUrl) {
  try {
    return new URL(rawUrl).toString();
  } catch {
    return null;
  }
}

function filenameFromUrl(rawUrl) {
  try {
    const url = new URL(rawUrl);
    return decodeURIComponent(path.basename(url.pathname));
  } catch {
    return null;
  }
}

function normalizeFilename(filename) {
  return filename ? filename.replace(/_\d+(?=\.pdf$)/i, '') : filename;
}

function dateFromFilename(filename) {
  if (!filename) return null;
  const normalized = normalizeFilename(filename);
  const match = normalized.match(
    /Pending_MDL_Dockets_By_District-([A-Za-z]+)-(\d{1,2})-(\d{4})\.pdf$/i
  );
  if (!match) return null;

  const [, monthName, day, year] = match;
  const month = MONTH_MAP.get(monthName.toLowerCase());
  if (!month) return null;
  return isoFromParts(Number(year), month, Number(day));
}

function formatSourceUrlFromFilename(filename) {
  if (!filename) return null;
  return `${JPML_BASE_URL}/sites/jpml/files/${encodeURIComponent(filename)}`;
}

function isNewerCandidate(candidateDate, importedDate, candidateUrl, importedUrl) {
  const dateComparison = compareIsoDates(candidateDate, importedDate);
  if (dateComparison > 0) return true;
  if (dateComparison < 0) return false;
  return Boolean(candidateUrl && importedUrl && candidateUrl !== importedUrl);
}

async function readJson(filePath, fallback) {
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    return JSON.parse(raw);
  } catch (error) {
    if (error.code === 'ENOENT') {
      return fallback;
    }
    throw error;
  }
}

async function writeJson(filePath, data) {
  await fs.writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

async function ensureDirectory(directoryPath) {
  await fs.mkdir(directoryPath, { recursive: true });
}

async function deriveImportedStateFromData() {
  const months = await readJson(path.join(MDL_DIR, 'index.json'), []);
  const pdfs = await readJson(path.join(PDF_DIR, 'index.json'), []);
  const latestMonth = Array.isArray(months) && months.length ? months[months.length - 1] : null;

  if (!latestMonth) {
    return {
      importedReportDate: null,
      importedSourceUrl: null,
      importedFileName: null
    };
  }

  const matchingFile =
    pdfs.find((filename) => dateFromFilename(filename) === latestMonth) ||
    null;

  return {
    importedReportDate: latestMonth,
    importedSourceUrl: matchingFile ? formatSourceUrlFromFilename(matchingFile) : null,
    importedFileName: matchingFile
  };
}

async function getMetadata() {
  const [stored, derived] = await Promise.all([
    readJson(METADATA_PATH, null),
    deriveImportedStateFromData()
  ]);

  const metadata = {
    ...DEFAULT_METADATA,
    ...(stored || {})
  };

  const shouldPromoteDerived =
    compareIsoDates(derived.importedReportDate, metadata.importedReportDate) > 0 ||
    (!metadata.importedReportDate && Boolean(derived.importedReportDate));

  if (shouldPromoteDerived) {
    metadata.importedReportDate = derived.importedReportDate;
    metadata.importedSourceUrl = derived.importedSourceUrl;
    metadata.importedFileName = derived.importedFileName;
  } else {
    if (!metadata.importedFileName && derived.importedReportDate === metadata.importedReportDate) {
      metadata.importedFileName = derived.importedFileName;
    }
    if (!metadata.importedSourceUrl && derived.importedReportDate === metadata.importedReportDate) {
      metadata.importedSourceUrl = derived.importedSourceUrl;
    }
  }

  const storedString = JSON.stringify(stored || {});
  const nextString = JSON.stringify(metadata);
  if (storedString !== nextString) {
    await writeJson(METADATA_PATH, metadata);
  }

  return metadata;
}

async function saveMetadata(partial) {
  const current = await getMetadata();
  const next = {
    ...current,
    ...partial
  };
  await writeJson(METADATA_PATH, next);
  return next;
}

function absoluteCandidateUrl(href, pageUrl) {
  try {
    return new URL(href, pageUrl).toString();
  } catch {
    return null;
  }
}

function extractPdfCandidates(html, pageUrl) {
  const hrefRegex = /href\s*=\s*["']([^"']+)["']/gi;
  const candidates = new Map();
  let match;

  while ((match = hrefRegex.exec(html))) {
    const href = match[1];
    if (!/Pending_MDL_Dockets_By_District-[^"'?#]+\.pdf/i.test(href)) {
      continue;
    }

    const url = absoluteCandidateUrl(href, pageUrl);
    const fileName = filenameFromUrl(url);
    if (!url || !fileName) continue;

    candidates.set(url, {
      sourceUrl: url,
      fileName,
      fileDate: dateFromFilename(fileName),
      discoveredFrom: pageUrl
    });
  }

  return Array.from(candidates.values()).sort((left, right) => {
    const dateComparison = compareIsoDates(right.fileDate, left.fileDate);
    if (dateComparison !== 0) return dateComparison;
    return right.fileName.localeCompare(left.fileName);
  });
}

async function fetchText(url) {
  const response = await fetch(url, { headers: DEFAULT_HEADERS, redirect: 'follow' });
  if (!response.ok) {
    throw new Error(`JPML request failed (${response.status}) for ${url}`);
  }
  return response.text();
}

async function discoverLatestCandidate() {
  const errors = [];

  for (const pageUrl of JPML_SOURCE_PAGES) {
    try {
      const html = await fetchText(pageUrl);
      const candidates = extractPdfCandidates(html, pageUrl);
      if (candidates.length) {
        return {
          candidate: candidates[0],
          checkedPages: [pageUrl]
        };
      }
      errors.push(`No matching PDF links found on ${pageUrl}`);
    } catch (error) {
      errors.push(error.message);
    }
  }

  throw new Error(errors.join(' | '));
}

async function runPythonScript(scriptPath, args) {
  const pythonBinaries = [process.env.PYTHON_BIN, 'python', 'python3'].filter(Boolean);
  let lastError = null;

  for (const binary of pythonBinaries) {
    try {
      return await execFileAsync(binary, [scriptPath, ...args], {
        cwd: ROOT_DIR,
        maxBuffer: 1024 * 1024 * 8
      });
    } catch (error) {
      lastError = error;
      if (error.code !== 'ENOENT') {
        break;
      }
    }
  }

  throw lastError || new Error('Unable to execute Python helper.');
}

async function extractReportDateFromPdf(pdfPath) {
  const scriptPath = path.join(ROOT_DIR, 'scripts', 'extract_jpml_report_date.py');
  const { stdout } = await runPythonScript(scriptPath, [pdfPath]);
  const parsed = JSON.parse(stdout || '{}');
  return parsed.reportDate || null;
}

async function downloadPdfToTemp(sourceUrl) {
  const response = await fetch(sourceUrl, {
    headers: DEFAULT_HEADERS,
    redirect: 'follow'
  });

  if (!response.ok) {
    throw new Error(`PDF fetch failed (${response.status}) for ${sourceUrl}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'jpml-updater-'));
  const fileName = filenameFromUrl(sourceUrl) || `jpml-${Date.now()}.pdf`;
  const tempPath = path.join(tempDir, fileName);
  await fs.writeFile(tempPath, Buffer.from(arrayBuffer));
  return { tempDir, tempPath, fileName };
}

async function cleanupTemp(tempDir) {
  if (!tempDir) return;
  await fs.rm(tempDir, { recursive: true, force: true });
}

function serializeState(metadata, checkResult = null) {
  return {
    current: {
      reportDate: metadata.importedReportDate,
      sourceUrl: metadata.importedSourceUrl,
      fileName: metadata.importedFileName
    },
    metadata: {
      lastCheckedAt: metadata.lastCheckedAt,
      lastCheckStatus: metadata.lastCheckStatus,
      lastCheckMessage: metadata.lastCheckMessage,
      lastImportAt: metadata.lastImportAt,
      lastImportStatus: metadata.lastImportStatus,
      lastImportError: metadata.lastImportError
    },
    remote: checkResult ? checkResult.remote : null,
    updaterStatus: checkResult ? checkResult.status : 'idle',
    updaterMessage: checkResult ? checkResult.message : 'JPML updater ready.'
  };
}

async function getCurrentStatus() {
  const metadata = await getMetadata();
  return serializeState(metadata);
}

async function checkForUpdates() {
  const metadata = await getMetadata();
  const checkedAt = new Date().toISOString();

  try {
    const { candidate } = await discoverLatestCandidate();
    let reportDate = candidate.fileDate;
    let dateSource = reportDate ? 'filename' : 'unknown';

    const shouldConfirmFromPdf =
      !metadata.importedReportDate ||
      isNewerCandidate(candidate.fileDate, metadata.importedReportDate, candidate.sourceUrl, metadata.importedSourceUrl);

    if (shouldConfirmFromPdf) {
      try {
        const tempDownload = await downloadPdfToTemp(candidate.sourceUrl);
        try {
          const extractedDate = await extractReportDateFromPdf(tempDownload.tempPath);
          if (extractedDate) {
            reportDate = extractedDate;
            dateSource = 'pdf';
          }
        } finally {
          await cleanupTemp(tempDownload.tempDir);
        }
      } catch (error) {
        console.warn('[JPML updater] Unable to confirm report date from PDF:', error.message);
      }
    }

    const remote = {
      sourceUrl: candidate.sourceUrl,
      fileName: candidate.fileName,
      reportDate,
      dateSource,
      discoveredFrom: candidate.discoveredFrom
    };

    const updateAvailable = isNewerCandidate(
      remote.reportDate || candidate.fileDate,
      metadata.importedReportDate,
      remote.sourceUrl,
      metadata.importedSourceUrl
    );

    const status = updateAvailable ? 'update-available' : 'up-to-date';
    const message = updateAvailable
      ? 'A newer JPML listing is available.'
      : 'You have the latest JPML listing.';

    const nextMetadata = await saveMetadata({
      lastCheckedAt: checkedAt,
      lastCheckStatus: status,
      lastCheckMessage: message
    });

    console.log(
      `[JPML updater] Check complete: ${status} (local=${metadata.importedReportDate || 'none'}, remote=${remote.reportDate || remote.fileName})`
    );

    return serializeState(nextMetadata, { status, message, remote });
  } catch (error) {
    const message = 'Could not verify JPML listing status.';
    const nextMetadata = await saveMetadata({
      lastCheckedAt: checkedAt,
      lastCheckStatus: 'unknown',
      lastCheckMessage: `${message} ${error.message}`
    });

    console.warn('[JPML updater] Check failed:', error.message);

    return serializeState(nextMetadata, {
      status: 'unknown',
      message,
      remote: null
    });
  }
}

async function importListing({ sourceUrl } = {}) {
  const importStartedAt = new Date().toISOString();
  let metadata = await getMetadata();
  let targetUrl = safeUrl(sourceUrl);

  if (sourceUrl && !targetUrl) {
    throw new Error('Please provide a valid JPML PDF URL.');
  }

  if (!targetUrl) {
    const status = await checkForUpdates();
    targetUrl = status.remote?.sourceUrl || null;
    metadata = await getMetadata();

    if (!targetUrl) {
      throw new Error('No JPML PDF URL was available to import.');
    }

    if (status.updaterStatus === 'up-to-date') {
      return {
        ...status,
        updaterMessage: 'You already have the latest JPML listing.'
      };
    }
  }

  console.log(`[JPML updater] Import starting from ${targetUrl}`);

  try {
    const tempDownload = await downloadPdfToTemp(targetUrl);
    try {
      const reportDate =
        (await extractReportDateFromPdf(tempDownload.tempPath)) ||
        dateFromFilename(tempDownload.fileName);

      if (!reportDate) {
        throw new Error('Unable to determine the JPML report date from the PDF.');
      }

      await ensureDirectory(PDF_DIR);
      await ensureDirectory(MDL_DIR);

      const finalPdfPath = path.join(PDF_DIR, tempDownload.fileName);
      await fs.copyFile(tempDownload.tempPath, finalPdfPath);

      const outputJsonPath = path.join(MDL_DIR, `${reportDate}.json`);
      const parserPath = path.join(ROOT_DIR, 'scripts', 'parse_mdls.py');
      await runPythonScript(parserPath, [finalPdfPath, outputJsonPath]);

      metadata = await saveMetadata({
        importedReportDate: reportDate,
        importedSourceUrl: targetUrl,
        importedFileName: tempDownload.fileName,
        lastCheckedAt: importStartedAt,
        lastCheckStatus: 'up-to-date',
        lastCheckMessage: 'You have the latest JPML listing.',
        lastImportAt: new Date().toISOString(),
        lastImportStatus: 'success',
        lastImportError: null
      });

      console.log(`[JPML updater] Import succeeded for ${tempDownload.fileName} (${reportDate})`);

      return serializeState(metadata, {
        status: 'up-to-date',
        message: 'JPML listing imported successfully.',
        remote: {
          sourceUrl: targetUrl,
          fileName: tempDownload.fileName,
          reportDate,
          dateSource: 'pdf',
          discoveredFrom: null
        }
      });
    } finally {
      await cleanupTemp(tempDownload.tempDir);
    }
  } catch (error) {
    metadata = await saveMetadata({
      lastImportAt: new Date().toISOString(),
      lastImportStatus: 'failed',
      lastImportError: error.message
    });

    console.error('[JPML updater] Import failed:', error.message);
    throw Object.assign(new Error(`JPML import failed: ${error.message}`), {
      updaterState: serializeState(metadata, {
        status: 'error',
        message: 'Import failed.',
        remote: null
      })
    });
  }
}

module.exports = {
  JPML_SOURCE_PAGES,
  checkForUpdates,
  getCurrentStatus,
  importListing
};
