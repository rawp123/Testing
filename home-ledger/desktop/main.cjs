const { app, BrowserWindow, ipcMain, dialog } = require("electron");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const {
  cleanText,
  getSafeFileName,
  getSafeId,
  requireSafeId,
  toBuffer,
} = require("./storage-helpers.cjs");

const IS_PACKAGED = app.isPackaged;
const PRELOAD_SCRIPT = path.join(__dirname, "preload.cjs");
const APP_DIR = IS_PACKAGED
  ? path.join(process.resourcesPath, "home-ledger")
  : path.resolve(__dirname, "..");
const APP_INDEX = path.join(APP_DIR, "frontend", "index.html");
const STORAGE_VERSION = 1;
const MAX_RECORDS_BYTES = 15 * 1024 * 1024;
const MAX_DOCUMENT_BYTES = 25 * 1024 * 1024;
const MAX_BACKUP_BYTES = 500 * 1024 * 1024;
const MAX_REVIEW_HTML_BYTES = 5 * 1024 * 1024;
const MAX_REVIEW_PDF_BYTES = 50 * 1024 * 1024;
const RECORDS_FILE = "records.json";
const ATTACHMENTS_FILE = "attachments.json";
const DOCUMENTS_DIR = "documents";
const IS_SMOKE_TEST = process.env.HOME_LEDGER_DESKTOP_SMOKE === "1";
const SMOKE_USER_DATA_DIR = process.env.HOME_LEDGER_TEST_USER_DATA ||
  path.join(os.tmpdir(), `home-ledger-smoke-${process.pid}`);

let modelModulePromise;

if (IS_SMOKE_TEST) {
  app.setPath("userData", SMOKE_USER_DATA_DIR);
}

const hasSingleInstanceLock = IS_SMOKE_TEST || app.requestSingleInstanceLock();
if (!hasSingleInstanceLock) {
  app.quit();
  process.exit(0);
}

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
  return path.join(getDocumentsDir(), `${requireSafeId(fileId)}.blob`);
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
    title: "Home Ledger",
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

  window.webContents.session.setPermissionRequestHandler((_webContents, _permission, callback) => {
    callback(false);
  });
  window.webContents.on("will-attach-webview", (event) => {
    event.preventDefault();
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
      setTimeout(() => {
        void runDesktopSmoke(window);
      }, 500);
    });
    window.webContents.once("did-fail-load", (_event, _code, description) => {
      console.error(`Home Ledger desktop smoke failed: ${description}`);
      void finishDesktopSmoke(1);
    });
  }

  window.loadURL(getStartUrl());
}

async function runDesktopSmoke(window) {
  try {
    const result = await window.webContents.executeJavaScript(`
      (async () => {
        const sleep = (ms = 75) => new Promise((resolve) => setTimeout(resolve, ms));
        const assert = (condition, message) => {
          if (!condition) throw new Error(message);
        };
        const waitFor = async (predicate, label) => {
          for (let attempt = 0; attempt < 80; attempt += 1) {
            if (predicate()) return;
            await sleep();
          }
          throw new Error("Timed out waiting for " + label + ": " + document.body.innerText.slice(0, 800));
        };
        const click = async (selector) => {
          const element = document.querySelector(selector);
          assert(element, "Missing clickable element: " + selector);
          element.click();
          await sleep();
        };
        const setValue = async (name, value) => {
          const fields = Array.from(document.querySelectorAll('form [name="' + name + '"]'));
          const element = fields.find((field) => field.closest("form")?.offsetParent !== null) || fields.at(-1);
          assert(element, "Missing form field: " + name);
          element.value = value;
          element.dispatchEvent(new Event("input", { bubbles: true }));
          element.dispatchEvent(new Event("change", { bubbles: true }));
          await sleep();
        };
        const setSelect = setValue;
        const submit = async (selector) => {
          const form = document.querySelector(selector);
          assert(form, "Missing form: " + selector);
          const button = form.querySelector('button[type="submit"]');
          assert(button, "Missing submit button for form: " + selector);
          button.click();
          await sleep(150);
        };
        const bodyIncludes = (text) => document.body.innerText.includes(text);

        assert(window.homeLedgerDesktop?.isDesktop, "Desktop bridge was not available.");
        assert(typeof window.homeLedgerDesktop.saveCpaReviewPdf === "function", "Desktop PDF save bridge was not available.");
        window.confirm = () => true;
        await window.homeLedgerDesktop.saveData({ properties: [], projects: [], expenses: [], documents: [] });
        assert(bodyIncludes("Home Ledger"), "App shell did not render.");

        await click('[data-action="add-property"]');
        await setValue("name", "Smoke Test Home");
        await setValue("address", "123 Smoke Test St, NY 10001, /Users/private/hidden-home-address");
        await setValue("purchaseDate", "2020-05-01");
        await setValue("purchasePrice", "425000");
        await submit('[data-form="property"]');
        await waitFor(() => bodyIncludes("Property saved.") && bodyIncludes("Smoke Test Home"), "property save");

        await click('[data-tab="projects"]');
        await click('[data-action="manage-vendors"]');
        await click('[data-action="add-vendor"]');
        await setValue("name", "Smoke Roofing LLC");
        await setSelect("category", "roof");
        await submit('[data-form="vendor"]');
        await waitFor(() => bodyIncludes("Vendor saved.") && bodyIncludes("Smoke Roofing LLC"), "vendor save");
        await click('[data-action="close-vendor-manager"]');

        await click('[data-action="add-project"]');
        await setValue("name", "Roof replacement");
        await setSelect("category", "roof");
        await setSelect("status", "completed");
        const vendorOption = Array.from(document.querySelectorAll('[name="vendorId"] option')).find((option) => option.textContent.includes("Smoke Roofing LLC"));
        assert(vendorOption, "Missing smoke vendor option.");
        await setSelect("vendorId", vendorOption.value);
        await submit('[data-form="project"]');
        await waitFor(() => bodyIncludes("Project saved.") && bodyIncludes("Roof replacement"), "project save");

        await click('[data-tab="expenses"]');
        await click('[data-action="add-expense"]');
        await setValue("date", "2024-03-15");
        await setValue("amount", "12850.50");
        await setValue("description", "Full roof replacement");
        await setSelect("classification", "potential basis addition");
        await setSelect("category", "roof");
        await setSelect("documentationStatus", "no document yet");
        const projectOption = document.querySelector('[name="projectId"] option:not([value=""])');
        if (projectOption) await setSelect("projectId", projectOption.value);
        await setSelect("vendorId", vendorOption.value);
        const expenseForm = document.querySelector('[data-form="expense"]');
        assert(expenseForm.elements.date.value === "2024-03-15", "Expense date was not filled.");
        assert(expenseForm.elements.amount.value === "12850.50", "Expense amount was not filled.");
        assert(expenseForm.elements.vendorId.value === vendorOption.value, "Expense vendor was not filled.");
        assert(expenseForm.elements.description.value === "Full roof replacement", "Expense description was not filled.");
        await submit('[data-form="expense"]');
        await waitFor(() => bodyIncludes("Expense saved.") && bodyIncludes("Full roof replacement"), "expense save");

        await click('[data-tab="documents"]');
        await click('[data-action="add-document"]');
        await setValue("displayName", "Roof invoice note");
        await setSelect("documentType", "invoice");
        const expenseOption = document.querySelector('[name="expenseId"] option:not([value=""])');
        if (expenseOption) await setSelect("expenseId", expenseOption.value);
        await setValue("notes", "Stored file will be checked through desktop storage.");
        await submit('[data-form="document"]');
        await waitFor(() => bodyIncludes("Document saved.") && bodyIncludes("Roof invoice note"), "document save");

        const payload = new TextEncoder().encode("smoke receipt file").buffer;
        const storedFile = await window.homeLedgerDesktop.saveDocumentFile({
          id: "file_smoke_private_beta",
          data: payload,
          name: "/Users/private/roof-invoice.pdf",
          type: "application/pdf",
          size: payload.byteLength,
          lastModified: 1710460800000,
          storedAt: new Date().toISOString(),
        });
        assert(storedFile.name === "roof-invoice.pdf", "Stored file name was not sanitized.");
        const retrievedFile = await window.homeLedgerDesktop.getDocumentFile("file_smoke_private_beta");
        const retrievedText = new TextDecoder().decode(retrievedFile.data);
        assert(retrievedText === "smoke receipt file", "Stored file contents could not be read back.");
        const storageInfo = await window.homeLedgerDesktop.getStorageInfo();
        assert(storageInfo.documentCount === 1, "Desktop storage did not report the stored file.");
        await window.homeLedgerDesktop.deleteDocumentFile("file_smoke_private_beta");
        const filesAfterDelete = await window.homeLedgerDesktop.listDocumentFiles();
        assert(!filesAfterDelete.some((fileRecord) => fileRecord.id === "file_smoke_private_beta"), "Stored file was not deleted.");

        await click('[data-tab="export"]');
        await waitFor(() => bodyIncludes("Packet preview"), "packet preview");
        const previewSummary = document.querySelector(".export-preview-panel > summary");
        assert(previewSummary, "Missing review packet preview summary.");
        previewSummary.click();
        await sleep();
        await waitFor(() => bodyIncludes("Smoke Roofing LLC"), "expanded review packet preview");
        const csvButton = document.querySelector('[data-action="download-csv"]');
        assert(csvButton && !csvButton.disabled, "CSV export button should be enabled after adding an expense.");
        const pdfButton = document.querySelector('[data-action="download-cpa-pdf"]');
        assert(pdfButton && !pdfButton.disabled, "Review packet export button should be enabled after adding records.");
        pdfButton.click();
        await waitFor(() => bodyIncludes("Review packet saved."), "review packet save");
        assert(!document.body.innerText.includes("/Users/private"), "Raw local path leaked into the UI.");

        const savedData = await window.homeLedgerDesktop.loadData();
        assert(savedData.properties.length === 1, "Expected one saved property.");
        assert(savedData.projects.length === 1, "Expected one saved project.");
        assert(savedData.expenses.length === 1, "Expected one saved expense.");
        assert(savedData.documents.length === 1, "Expected one saved document.");
        assert(savedData.properties[0].address.includes("[local file path removed]"), "Local path stripping was not applied to saved data.");

        await click('[data-tab="property"]');
        await click('[data-action="add-property"]');
        await setValue("name", "Temporary delete test");
        await submit('[data-form="property"]');
        await waitFor(() => bodyIncludes("Temporary delete test"), "temporary property save");
        await click('[data-action="delete-property"]');
        await waitFor(() => bodyIncludes("Property deleted.") && !bodyIncludes("Temporary delete test"), "property delete");
        const afterDeleteData = await window.homeLedgerDesktop.loadData();
        assert(afterDeleteData.properties.length === 1, "Property delete should leave the original test property only.");
        assert(afterDeleteData.properties[0].name === "Smoke Test Home", "Property delete removed the wrong property.");

        return {
          properties: savedData.properties.length,
          projects: savedData.projects.length,
          expenses: savedData.expenses.length,
          documents: savedData.documents.length,
        };
      })()
    `);
    console.log(`Home Ledger desktop smoke passed: ${result.properties} property, ${result.projects} project, ${result.expenses} expense, ${result.documents} document.`);
    await finishDesktopSmoke(0);
  } catch (error) {
    console.error(`Home Ledger desktop smoke failed: ${serializeError(error).message}`);
    await finishDesktopSmoke(1);
  }
}

async function finishDesktopSmoke(code) {
  if (IS_SMOKE_TEST && !process.env.HOME_LEDGER_TEST_USER_DATA) {
    try {
      await fs.rm(SMOKE_USER_DATA_DIR, { recursive: true, force: true });
    } catch {
      // Smoke cleanup is best effort; failing cleanup should not hide the workflow result.
    }
  }
  if (code === 0) {
    app.quit();
    return;
  }
  app.exit(code);
}

async function ensureStorageReady() {
  await fs.mkdir(getAppDataDir(), { recursive: true, mode: 0o700 });
  await fs.mkdir(getDocumentsDir(), { recursive: true, mode: 0o700 });
  await chmodBestEffort(getAppDataDir(), 0o700);
  await chmodBestEffort(getDocumentsDir(), 0o700);
}

async function readJsonFile(filePath, fallback) {
  try {
    const text = await fs.readFile(filePath, "utf8");
    return JSON.parse(text);
  } catch (error) {
    if (error.code === "ENOENT") return fallback;
    try {
      const backupText = await fs.readFile(`${filePath}.bak`, "utf8");
      return JSON.parse(backupText);
    } catch {
      // Surface the original read/parse problem so the renderer can block unsafe writes.
    }
    throw error;
  }
}

async function writeJsonFile(filePath, value) {
  const text = `${JSON.stringify(value, null, 2)}\n`;
  await preserveReadableJsonBackup(filePath);
  await writeUtf8FileAtomic(filePath, text, {
    maxBytes: MAX_RECORDS_BYTES,
    tooLargeMessage: "The records file is too large to save.",
  });
}

async function preserveReadableJsonBackup(filePath) {
  try {
    const currentText = await fs.readFile(filePath, "utf8");
    JSON.parse(currentText);
    const backupPath = `${filePath}.bak`;
    await fs.writeFile(backupPath, currentText, "utf8");
    await chmodBestEffort(backupPath, 0o600);
    await fsyncFileBestEffort(backupPath);
  } catch (error) {
    if (error.code === "ENOENT" || error instanceof SyntaxError) return;
    throw error;
  }
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

async function writeUtf8FileAtomic(filePath, contents, options = {}) {
  const text = String(contents || "");
  const maxBytes = Number(options.maxBytes) || 0;
  if (maxBytes && Buffer.byteLength(text, "utf8") > maxBytes) {
    throw new Error(options.tooLargeMessage || "The file is too large to save.");
  }

  const directory = path.dirname(filePath);
  const baseName = path.basename(filePath);
  const tempPath = path.join(directory, `.${baseName}.${process.pid}.${Date.now()}.tmp`);
  try {
    await fs.writeFile(tempPath, text, "utf8");
    await chmodBestEffort(tempPath, 0o600);
    await fsyncFileBestEffort(tempPath);
    await fs.rename(tempPath, filePath);
    await chmodBestEffort(filePath, 0o600);
    await fsyncDirectoryBestEffort(directory);
  } catch (error) {
    await fs.rm(tempPath, { force: true }).catch(() => {});
    throw error;
  }
}

async function writeBinaryFileAtomic(filePath, contents, options = {}) {
  const buffer = Buffer.isBuffer(contents) ? contents : Buffer.from(contents);
  const maxBytes = Number(options.maxBytes) || 0;
  if (maxBytes && buffer.byteLength > maxBytes) {
    throw new Error(options.tooLargeMessage || "The file is too large to save.");
  }

  const directory = path.dirname(filePath);
  const baseName = path.basename(filePath);
  const tempPath = path.join(directory, `.${baseName}.${process.pid}.${Date.now()}.tmp`);
  try {
    await fs.writeFile(tempPath, buffer);
    await chmodBestEffort(tempPath, 0o600);
    await fsyncFileBestEffort(tempPath);
    await fs.rename(tempPath, filePath);
    await chmodBestEffort(filePath, 0o600);
    await fsyncDirectoryBestEffort(directory);
  } catch (error) {
    await fs.rm(tempPath, { force: true }).catch(() => {});
    throw error;
  }
}

async function getFileSize(filePath) {
  try {
    return (await fs.stat(filePath)).size;
  } catch (error) {
    if (error.code === "ENOENT") return 0;
    throw error;
  }
}

async function chmodBestEffort(filePath, mode) {
  try {
    await fs.chmod(filePath, mode);
  } catch {
    // Some filesystems ignore POSIX modes; storage still works without hiding the main result.
  }
}

async function fsyncFileBestEffort(filePath) {
  let fileHandle;
  try {
    fileHandle = await fs.open(filePath, "r");
    await fileHandle.sync();
  } catch {
    // Best-effort crash durability; unsupported platforms should not break normal saves.
  } finally {
    if (fileHandle) {
      await fileHandle.close().catch(() => {});
    }
  }
}

async function fsyncDirectoryBestEffort(directoryPath) {
  let directoryHandle;
  try {
    directoryHandle = await fs.open(directoryPath, "r");
    await directoryHandle.sync();
  } catch {
    // Directory fsync is not available everywhere.
  } finally {
    if (directoryHandle) {
      await directoryHandle.close().catch(() => {});
    }
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

async function getModelModule() {
  if (!modelModulePromise) {
    modelModulePromise = import(pathToFileURL(path.join(APP_DIR, "backend", "domain", "model.js")).toString());
  }
  return modelModulePromise;
}

async function sanitizeAppData(value) {
  const { sanitizeData } = await getModelModule();
  return sanitizeData(value);
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

function serializeError(error) {
  return {
    message: error?.message || "Unknown desktop storage error.",
  };
}

function ensurePdfFileName(filename) {
  const safeName = getSafeFileName(filename || "home-ledger-review-packet.pdf");
  return safeName.toLowerCase().endsWith(".pdf") ? safeName : `${safeName}.pdf`;
}

function ensurePdfFilePath(filePath) {
  return String(filePath || "").toLowerCase().endsWith(".pdf") ? filePath : `${filePath}.pdf`;
}

function isAllowedPdfRenderUrl(targetUrl) {
  try {
    return new URL(targetUrl).protocol === "data:";
  } catch {
    return false;
  }
}

async function renderHtmlToPdfBuffer(html) {
  const pdfWindow = new BrowserWindow({
    show: false,
    width: 816,
    height: 1056,
    backgroundColor: "#ffffff",
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
    },
  });

  pdfWindow.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  pdfWindow.webContents.on("will-navigate", (event, url) => {
    if (!isAllowedPdfRenderUrl(url)) {
      event.preventDefault();
    }
  });
  pdfWindow.webContents.on("will-redirect", (event, url) => {
    if (!isAllowedPdfRenderUrl(url)) {
      event.preventDefault();
    }
  });

  try {
    await pdfWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
    await pdfWindow.webContents.executeJavaScript("document.fonts?.ready ? document.fonts.ready.then(() => true) : true", true).catch(() => true);
    return await pdfWindow.webContents.printToPDF({
      printBackground: true,
      pageSize: "Letter",
      margins: {
        marginType: "default",
      },
    });
  } finally {
    if (!pdfWindow.isDestroyed()) {
      pdfWindow.destroy();
    }
  }
}

async function getPdfSaveTarget(filename) {
  if (IS_SMOKE_TEST) {
    return {
      canceled: false,
      filePath: path.join(SMOKE_USER_DATA_DIR, ensurePdfFileName(filename)),
    };
  }

  return dialog.showSaveDialog({
    title: "Save Home Ledger review packet",
    defaultPath: filename,
    buttonLabel: "Save PDF",
    filters: [{ name: "PDF document", extensions: ["pdf"] }],
    properties: ["createDirectory", "showOverwriteConfirmation"],
  });
}

function assertTrustedSender(event) {
  const frameUrl = event?.senderFrame?.url || "";
  if (!isAllowedNavigation(frameUrl)) {
    throw new Error("Desktop storage request came from an unexpected app page.");
  }
}

function registerIpcHandlers() {
  ipcMain.handle("home-ledger:get-storage-info", async (event) => {
    assertTrustedSender(event);
    await ensureStorageReady();
    const documentSummary = await getDocumentStorageSummary();
    return {
      mode: "desktop",
      recordsPathLabel: "App support records file",
      documentsPathLabel: "App-managed documents folder",
      storageDescription: "Records and document copies are managed by the Mac app.",
      recordsBytes: await getFileSize(getRecordsPath()),
      ...documentSummary,
    };
  });

  ipcMain.handle("home-ledger:load-data", async (event) => {
    assertTrustedSender(event);
    await ensureStorageReady();
    return sanitizeAppData(await readJsonFile(getRecordsPath(), { properties: [], projects: [], expenses: [], documents: [] }));
  });

  ipcMain.handle("home-ledger:save-data", async (event, data) => {
    assertTrustedSender(event);
    await ensureStorageReady();
    await writeJsonFile(getRecordsPath(), await sanitizeAppData(data));
    return { ok: true };
  });

  ipcMain.handle("home-ledger:save-backup-file", async (event, record) => {
    assertTrustedSender(event);
    const filename = getSafeFileName(record?.filename || "home-ledger-backup.json");
    const contents = String(record?.contents || "");
    if (Buffer.byteLength(contents, "utf8") > MAX_BACKUP_BYTES) {
      throw new Error("Backup file is too large.");
    }

    const result = await dialog.showSaveDialog({
      title: "Save private Home Ledger backup",
      defaultPath: filename,
      buttonLabel: "Save backup",
      filters: [{ name: "JSON backup", extensions: ["json"] }],
      properties: ["createDirectory", "showOverwriteConfirmation"],
    });

    if (result.canceled || !result.filePath) {
      return { canceled: true };
    }

    await writeUtf8FileAtomic(result.filePath, contents, {
      maxBytes: MAX_BACKUP_BYTES,
      tooLargeMessage: "Backup file is too large.",
    });
    return { canceled: false };
  });

  ipcMain.handle("home-ledger:save-cpa-review-pdf", async (event, record) => {
    assertTrustedSender(event);
    const filename = ensurePdfFileName(record?.filename);
    const html = String(record?.html || "");
    if (!html.trim()) {
      throw new Error("Review packet content was empty.");
    }
    if (Buffer.byteLength(html, "utf8") > MAX_REVIEW_HTML_BYTES) {
      throw new Error("Review packet content is too large.");
    }

    const result = await getPdfSaveTarget(filename);

    if (result.canceled || !result.filePath) {
      return { canceled: true };
    }

    const pdfBuffer = await renderHtmlToPdfBuffer(html);
    await writeBinaryFileAtomic(ensurePdfFilePath(result.filePath), pdfBuffer, {
      maxBytes: MAX_REVIEW_PDF_BYTES,
      tooLargeMessage: "Review packet is too large to save.",
    });
    return { canceled: false };
  });

  ipcMain.handle("home-ledger:save-document-file", async (event, record) => {
    assertTrustedSender(event);
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
    await chmodBestEffort(tempPath, 0o600);
    await fsyncFileBestEffort(tempPath);
    await fs.rename(tempPath, documentPath);
    await chmodBestEffort(documentPath, 0o600);
    await fsyncDirectoryBestEffort(path.dirname(documentPath));
    const manifest = await readAttachmentsManifest();
    manifest.files = [
      storedRecord,
      ...manifest.files.filter((fileRecord) => fileRecord.id !== id),
    ];
    await writeAttachmentsManifest(manifest);
    return storedRecord;
  });

  ipcMain.handle("home-ledger:get-document-file", async (event, fileId) => {
    assertTrustedSender(event);
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

  ipcMain.handle("home-ledger:delete-document-file", async (event, fileId) => {
    assertTrustedSender(event);
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

  ipcMain.handle("home-ledger:list-document-files", async (event) => {
    assertTrustedSender(event);
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
    dialog.showErrorBox("Home Ledger could not open", serializeError(error).message);
    app.quit();
    return;
  }

  createWindow();

  app.on("second-instance", () => {
    const [existingWindow] = BrowserWindow.getAllWindows();
    if (!existingWindow) return;
    if (existingWindow.isMinimized()) existingWindow.restore();
    existingWindow.focus();
  });

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
