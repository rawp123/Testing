const fs = require('fs/promises');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..', '..', '..');
const DATA_DIR = path.join(ROOT_DIR, 'data');
const MDL_INDEX_PATH = path.join(DATA_DIR, 'mdl', 'index.json');
const PDF_INDEX_PATH = path.join(DATA_DIR, 'pdfs', 'index.json');
const METADATA_PATH = path.join(DATA_DIR, 'jpml-listing-metadata.json');
const JPML_BASE_URL = 'https://www.jpml.uscourts.gov';

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

function formatSourceUrlFromFilename(fileName) {
  return fileName
    ? `${JPML_BASE_URL}/sites/jpml/files/${encodeURIComponent(fileName)}`
    : null;
}

function dateFromFilename(fileName) {
  if (!fileName) return null;

  const match = fileName.match(
    /Pending_MDL_Dockets_By_District-([A-Za-z]+)-(\d{1,2})-(\d{4})\.pdf$/i
  );
  if (!match) return null;

  const months = {
    january: '01',
    february: '02',
    march: '03',
    april: '04',
    may: '05',
    june: '06',
    july: '07',
    august: '08',
    september: '09',
    october: '10',
    november: '11',
    december: '12'
  };

  const [, monthName, day, year] = match;
  const month = months[monthName.toLowerCase()];
  if (!month) return null;

  return `${year}-${month}-${String(Number(day)).padStart(2, '0')}`;
}

async function getCurrentState() {
  const [metadata, months, pdfs] = await Promise.all([
    readJson(METADATA_PATH, {}),
    readJson(MDL_INDEX_PATH, []),
    readJson(PDF_INDEX_PATH, [])
  ]);

  const latestMonth = Array.isArray(months) && months.length ? months[months.length - 1] : null;
  const matchingPdf = Array.isArray(pdfs)
    ? pdfs.find((fileName) => dateFromFilename(fileName) === latestMonth) || null
    : null;

  return {
    current: {
      reportDate: metadata.importedReportDate || latestMonth,
      sourceUrl: metadata.importedSourceUrl || formatSourceUrlFromFilename(matchingPdf),
      fileName: metadata.importedFileName || matchingPdf
    },
    metadata: {
      lastCheckedAt: metadata.lastCheckedAt || null,
      lastCheckStatus: 'unknown',
      lastCheckMessage: 'Automatic JPML checks are disabled on Vercel.',
      lastImportAt: metadata.lastImportAt || null,
      lastImportStatus: metadata.lastImportStatus || 'idle',
      lastImportError: metadata.lastImportError || null
    },
    remote: null,
    updaterStatus: 'unknown',
    updaterMessage:
      'Automatic JPML update checks and imports are disabled on Vercel because the deployment filesystem is read-only.'
  };
}

async function sendCurrentState(res, statusCode = 200) {
  const payload = await getCurrentState();
  res.status(statusCode).json(payload);
}

module.exports = {
  getCurrentState,
  sendCurrentState
};
