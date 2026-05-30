const { app, BrowserWindow, ipcMain, dialog } = require("electron");
const fs = require("node:fs/promises");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const IS_PACKAGED = app.isPackaged;
const PRELOAD_SCRIPT = path.join(__dirname, "preload.cjs");
const APP_INDEX = IS_PACKAGED
  ? path.join(process.resourcesPath, "home-ledger", "index.html")
  : path.resolve(__dirname, "../index.html");
const STORAGE_VERSION = 1;
const MAX_RECORDS_BYTES = 15 * 1024 * 1024;
const MAX_DOCUMENT_BYTES = 25 * 1024 * 1024;
const RECORDS_FILE = "records.json";
const ATTACHMENTS_FILE = "attachments.json";
const DOCUMENTS_DIR = "documents";
const IS_SMOKE_TEST = process.env.HOME_LEDGER_DESKTOP_SMOKE === "1";

const PROJECT_STATUSES = ["planned", "in progress", "completed"];
const CLASSIFICATIONS = ["potential basis addition", "repair or maintenance", "unclear / ask CPA"];
const EXPENSE_CATEGORIES = [
  "kitchen",
  "bathroom",
  "roof",
  "HVAC",
  "windows/doors",
  "flooring",
  "landscaping",
  "addition/structural",
  "plumbing",
  "electrical",
  "appliances",
  "other",
];
const DOCUMENT_STATUSES = ["receipt attached", "invoice attached", "no document yet", "needs follow-up"];
const DOCUMENT_TYPES = ["receipt", "invoice", "permit", "photo", "contract", "other"];

function getAppDataDir() {
  return app.getPath("userData");
}

function getRecordsPath() {
  return path.join(getAppDataDir(), RECORDS_FILE);
}

function getAttachmentsManifestPath() {
  return path.join(getAppDataDir(), ATTACHMENTS_FILE);
}

function getDocumentsDir() {
  return path.join(getAppDataDir(), DOCUMENTS_DIR);
}

function getDocumentPath(fileId) {
  return path.join(getDocumentsDir(), `${getSafeId(fileId)}.blob`);
}

function getStartUrl() {
  return pathToFileURL(APP_INDEX).toString();
}

function isAllowedNavigation(targetUrl) {
  let parsedUrl;
  try {
    parsedUrl = new URL(targetUrl);
  } catch {
    return false;
  }

  return parsedUrl.protocol === "file:" && path.normalize(decodeURIComponent(parsedUrl.pathname)) === path.normalize(APP_INDEX);
}

function createWindow() {
  const window = new BrowserWindow({
    width: 1320,
    height: 900,
    minWidth: 980,
    minHeight: 700,
    title: "Home Basis Tracker",
    backgroundColor: "#f4f6f2",
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
      preload: PRELOAD_SCRIPT,
    },
  });

  window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  window.webContents.on("will-navigate", (event, url) => {
    if (!isAllowedNavigation(url)) {
      event.preventDefault();
    }
  });
  window.webContents.on("will-redirect", (event, url) => {
    if (!isAllowedNavigation(url)) {
      event.preventDefault();
    }
  });
  if (IS_SMOKE_TEST) {
    window.webContents.once("did-finish-load", () => {
      setTimeout(async () => {
        try {
          const ready = await window.webContents.executeJavaScript(
            "(async () => { const data = await window.homeLedgerDesktop?.loadData(); const info = await window.homeLedgerDesktop?.getStorageInfo(); return Boolean(info?.mode === 'desktop' && Array.isArray(data?.properties) && document.body.innerText.includes('Home Basis Tracker')); })()",
          );
          if (!ready) {
            console.error("Home Basis Tracker desktop smoke failed: renderer did not expose the desktop app.");
            app.exit(1);
            return;
          }
          console.log("Home Basis Tracker desktop smoke loaded.");
          app.quit();
        } catch (error) {
          console.error(`Home Basis Tracker desktop smoke failed: ${serializeError(error).message}`);
          app.exit(1);
        }
      }, 500);
    });
    window.webContents.once("did-fail-load", (_event, _code, description) => {
      console.error(`Home Basis Tracker desktop smoke failed: ${description}`);
      app.exit(1);
    });
  }

  window.loadURL(getStartUrl());
}

async function ensureStorageReady() {
  await fs.mkdir(getAppDataDir(), { recursive: true });
  await fs.mkdir(getDocumentsDir(), { recursive: true });
}

async function readJsonFile(filePath, fallback) {
  try {
    const text = await fs.readFile(filePath, "utf8");
    return JSON.parse(text);
  } catch (error) {
    if (error.code === "ENOENT") return fallback;
    throw error;
  }
}

async function writeJsonFile(filePath, value) {
  const text = `${JSON.stringify(value, null, 2)}\n`;
  if (Buffer.byteLength(text, "utf8") > MAX_RECORDS_BYTES) {
    throw new Error("The local records file is too large to save.");
  }

  const tempPath = `${filePath}.tmp`;
  await fs.writeFile(tempPath, text, "utf8");
  await fs.rename(tempPath, filePath);
}

async function readAttachmentsManifest() {
  const manifest = await readJsonFile(getAttachmentsManifestPath(), { version: STORAGE_VERSION, files: [] });
  return {
    version: STORAGE_VERSION,
    files: Array.isArray(manifest?.files) ? manifest.files.map(sanitizeAttachmentRecord).filter(Boolean) : [],
  };
}

async function writeAttachmentsManifest(manifest) {
  await writeJsonFile(getAttachmentsManifestPath(), {
    version: STORAGE_VERSION,
    files: Array.isArray(manifest.files) ? manifest.files.map(sanitizeAttachmentRecord).filter(Boolean) : [],
  });
}

async function getFileSize(filePath) {
  try {
    return (await fs.stat(filePath)).size;
  } catch (error) {
    if (error.code === "ENOENT") return 0;
    throw error;
  }
}

async function getDocumentStorageSummary() {
  const manifest = await readAttachmentsManifest();
  return manifest.files.reduce(
    (summary, fileRecord) => ({
      documentBytes: summary.documentBytes + (Number(fileRecord.size) || 0),
      documentCount: summary.documentCount + 1,
    }),
    { documentBytes: 0, documentCount: 0 },
  );
}

function sanitizeAppData(value) {
  const sanitized = {
    properties: Array.isArray(value?.properties) ? value.properties.map(sanitizeProperty) : [],
    projects: Array.isArray(value?.projects) ? value.projects.map(sanitizeProject) : [],
    expenses: Array.isArray(value?.expenses) ? value.expenses.map(sanitizeExpense) : [],
    documents: Array.isArray(value?.documents) ? value.documents.map(sanitizeDocument) : [],
  };
  return normalizeRelationships(sanitized);
}

function sanitizeProperty(property) {
  return {
    id: cleanText(property?.id),
    name: removeLocalPaths(property?.name || ""),
    address: removeLocalPaths(property?.address || ""),
    purchaseDate: cleanDate(property?.purchaseDate),
    purchasePrice: parseAmount(property?.purchasePrice),
    notes: removeLocalPaths(property?.notes || ""),
  };
}

function sanitizeProject(project) {
  return {
    id: cleanText(project?.id),
    propertyId: cleanText(project?.propertyId),
    name: removeLocalPaths(project?.name || ""),
    category: allowedValue(EXPENSE_CATEGORIES, project?.category, "other"),
    startDate: cleanDate(project?.startDate),
    completionDate: cleanDate(project?.completionDate),
    contractor: removeLocalPaths(project?.contractor || ""),
    status: allowedValue(PROJECT_STATUSES, project?.status, "planned"),
    notes: removeLocalPaths(project?.notes || ""),
  };
}

function sanitizeExpense(expense) {
  return {
    id: cleanText(expense?.id),
    propertyId: cleanText(expense?.propertyId),
    projectId: cleanText(expense?.projectId),
    date: cleanDate(expense?.date),
    vendor: removeLocalPaths(expense?.vendor || ""),
    description: removeLocalPaths(expense?.description || ""),
    amount: parseAmount(expense?.amount),
    classification: allowedValue(CLASSIFICATIONS, expense?.classification, "unclear / ask CPA"),
    category: allowedValue(EXPENSE_CATEGORIES, expense?.category, "other"),
    documentationStatus: allowedValue(DOCUMENT_STATUSES, expense?.documentationStatus, "no document yet"),
    notes: removeLocalPaths(expense?.notes || ""),
  };
}

function sanitizeDocument(document) {
  return {
    id: cleanText(document?.id),
    propertyId: cleanText(document?.propertyId),
    projectId: cleanText(document?.projectId),
    expenseId: cleanText(document?.expenseId),
    displayName: removeLocalPaths(document?.displayName || ""),
    documentType: allowedValue(DOCUMENT_TYPES, document?.documentType, "other"),
    addedDate: cleanDate(document?.addedDate),
    notes: removeLocalPaths(document?.notes || ""),
    hasFile: Boolean(document?.hasFile),
    fileId: cleanText(document?.fileId),
    fileName: document?.fileName ? getSafeFileName(document.fileName) : "",
    mimeType: cleanText(document?.mimeType || ""),
    fileSize: Number(document?.fileSize) || 0,
    fileLastModified: document?.fileLastModified || null,
    fileStoredAt: cleanText(document?.fileStoredAt || ""),
  };
}

function normalizeRelationships(cleanData) {
  const properties = cleanData.properties.filter((property) => property.id && property.name);
  const propertyIds = new Set(properties.map((property) => property.id));
  const fallbackPropertyId = properties[0]?.id || "";

  const projects = cleanData.projects
    .filter((project) => project.id && project.name)
    .map((project) => ({
      ...project,
      propertyId: propertyIds.has(project.propertyId) ? project.propertyId : fallbackPropertyId,
    }))
    .filter((project) => project.propertyId);
  const projectIds = new Set(projects.map((project) => project.id));

  const expenses = cleanData.expenses
    .filter((expense) => expense.id && expense.vendor && expense.description)
    .map((expense) => {
      const propertyId = propertyIds.has(expense.propertyId) ? expense.propertyId : fallbackPropertyId;
      const linkedProject = projects.find((project) => project.id === expense.projectId && project.propertyId === propertyId);
      return {
        ...expense,
        propertyId,
        projectId: linkedProject?.id || "",
      };
    })
    .filter((expense) => expense.propertyId);
  const expenseIds = new Set(expenses.map((expense) => expense.id));

  const documents = cleanData.documents
    .filter((document) => document.id && document.displayName)
    .map((document) => {
      const linkedExpense = expenses.find((expense) => expense.id === document.expenseId);
      if (linkedExpense) {
        return {
          ...document,
          propertyId: linkedExpense.propertyId,
          projectId: linkedExpense.projectId,
          expenseId: linkedExpense.id,
        };
      }

      const propertyId = propertyIds.has(document.propertyId) ? document.propertyId : fallbackPropertyId;
      const linkedProject = projects.find((project) => project.id === document.projectId && project.propertyId === propertyId);
      return {
        ...document,
        propertyId,
        projectId: linkedProject?.id || "",
        expenseId: expenseIds.has(document.expenseId) ? document.expenseId : "",
      };
    })
    .filter((document) => document.propertyId);

  return {
    properties,
    projects: projects.filter((project) => projectIds.has(project.id)),
    expenses,
    documents,
  };
}

function sanitizeAttachmentRecord(record) {
  const id = getSafeId(record?.id);
  if (!id) return null;
  return {
    id,
    name: getSafeFileName(record?.name),
    type: cleanText(record?.type) || "application/octet-stream",
    size: Number(record?.size) || 0,
    lastModified: record?.lastModified || null,
    storedAt: record?.storedAt || new Date().toISOString(),
  };
}

function getSafeId(value) {
  return String(value || "").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 120);
}

function getSafeFileName(name) {
  const fileName = String(name || "").split(/[\\/]/).filter(Boolean).pop();
  return cleanText(fileName || "Attached file").slice(0, 180) || "Attached file";
}

function cleanText(value) {
  return String(value || "").replace(/[\u0000-\u001f\u007f]/g, "").trim();
}

function removeLocalPaths(value) {
  return String(value ?? "")
    .replace(/file:\/\/(?:localhost)?\/[^\r\n,;)]*/gi, "[local file path removed]")
    .replace(/\/(?:Users|Volumes|private|var|tmp|home)\/[^\r\n,;)]*/gi, "[local file path removed]")
    .replace(/[A-Z]:\\[^\r\n,;)]*/gi, "[local file path removed]")
    .replace(/\\\\[^\\/:*?"<>|\r\n]+\\[^\r\n,;)]*/g, "[local file path removed]");
}

function cleanDate(value) {
  const text = String(value || "").trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : "";
}

function parseAmount(value) {
  const numericValue = Number(String(value ?? "").replace(/[$,\s]/g, ""));
  if (!Number.isFinite(numericValue)) return 0;
  return Math.round(numericValue * 100) / 100;
}

function allowedValue(options, value, fallback) {
  return options.includes(value) ? value : fallback;
}

function toBuffer(data) {
  if (data instanceof ArrayBuffer) {
    return Buffer.from(data);
  }
  if (ArrayBuffer.isView(data)) {
    return Buffer.from(data.buffer, data.byteOffset, data.byteLength);
  }
  throw new Error("Document data was not in the expected format.");
}

function serializeError(error) {
  return {
    message: error?.message || "Unknown desktop storage error.",
  };
}

function registerIpcHandlers() {
  ipcMain.handle("home-ledger:get-storage-info", async () => {
    await ensureStorageReady();
    const documentSummary = await getDocumentStorageSummary();
    return {
      mode: "desktop",
      recordsPathLabel: "App support records file",
      documentsPathLabel: "App-managed documents folder",
      storageDescription: "Records and document copies are stored locally by the Mac app.",
      recordsBytes: await getFileSize(getRecordsPath()),
      ...documentSummary,
    };
  });

  ipcMain.handle("home-ledger:load-data", async () => {
    await ensureStorageReady();
    return sanitizeAppData(await readJsonFile(getRecordsPath(), { properties: [], projects: [], expenses: [], documents: [] }));
  });

  ipcMain.handle("home-ledger:save-data", async (_event, data) => {
    await ensureStorageReady();
    await writeJsonFile(getRecordsPath(), sanitizeAppData(data));
    return { ok: true };
  });

  ipcMain.handle("home-ledger:save-document-file", async (_event, record) => {
    await ensureStorageReady();
    const id = getSafeId(record?.id);
    if (!id) {
      throw new Error("Document file id is required.");
    }

    const buffer = toBuffer(record?.data);
    if (buffer.byteLength > MAX_DOCUMENT_BYTES) {
      throw new Error("Document file is too large.");
    }

    const storedRecord = sanitizeAttachmentRecord({
      id,
      name: record?.name,
      type: record?.type,
      size: buffer.byteLength,
      lastModified: record?.lastModified,
      storedAt: record?.storedAt || new Date().toISOString(),
    });

    const documentPath = getDocumentPath(id);
    const tempPath = `${documentPath}.tmp`;
    await fs.writeFile(tempPath, buffer);
    await fs.rename(tempPath, documentPath);
    const manifest = await readAttachmentsManifest();
    manifest.files = [
      storedRecord,
      ...manifest.files.filter((fileRecord) => fileRecord.id !== id),
    ];
    await writeAttachmentsManifest(manifest);
    return storedRecord;
  });

  ipcMain.handle("home-ledger:get-document-file", async (_event, fileId) => {
    await ensureStorageReady();
    const id = getSafeId(fileId);
    if (!id) return null;

    const manifest = await readAttachmentsManifest();
    const metadata = manifest.files.find((fileRecord) => fileRecord.id === id) || {
      id,
      name: "Attached file",
      type: "application/octet-stream",
      size: 0,
      lastModified: null,
      storedAt: "",
    };

    try {
      const buffer = await fs.readFile(getDocumentPath(id));
      return {
        ...metadata,
        size: metadata.size || buffer.byteLength,
        data: buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength),
      };
    } catch (error) {
      if (error.code === "ENOENT") return null;
      throw error;
    }
  });

  ipcMain.handle("home-ledger:delete-document-file", async (_event, fileId) => {
    await ensureStorageReady();
    const id = getSafeId(fileId);
    if (!id) return { ok: true };

    const manifest = await readAttachmentsManifest();
    try {
      await fs.unlink(getDocumentPath(id));
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
    manifest.files = manifest.files.filter((fileRecord) => fileRecord.id !== id);
    await writeAttachmentsManifest(manifest);
    return { ok: true };
  });

  ipcMain.handle("home-ledger:list-document-files", async () => {
    await ensureStorageReady();
    const manifest = await readAttachmentsManifest();
    return manifest.files;
  });
}

registerIpcHandlers();

app.whenReady().then(async () => {
  app.on("web-contents-created", (_event, contents) => {
    contents.setWindowOpenHandler(() => ({ action: "deny" }));
  });

  try {
    await ensureStorageReady();
  } catch (error) {
    dialog.showErrorBox("Home Basis Tracker could not open", serializeError(error).message);
    app.quit();
    return;
  }

  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
