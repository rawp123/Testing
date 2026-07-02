const { app, BrowserWindow } = require("electron");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");

const appUrl = process.env.QA_APP_URL || "http://127.0.0.1:3102";
const appTheme = ["light", "dark", "system"].includes(process.env.QA_APP_THEME) ? process.env.QA_APP_THEME : "";
const outputDir = path.resolve(process.env.QA_OUTPUT_DIR || path.join(__dirname, "..", "release", "qa"));
const userDataDir = path.join(os.tmpdir(), `home-basis-tracker-beta-qa-${process.pid}`);
const downloadDir = path.join(userDataDir, "downloads");

app.setPath("userData", userDataDir);
app.commandLine.appendSwitch("disable-features", "LocalNetworkAccessChecks");
app.on("window-all-closed", (event) => {
  event.preventDefault();
});

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function loadUrlWithRetry(window, url) {
  let lastError;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      await window.loadURL(url);
      return;
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => {
        setTimeout(resolve, 500);
      });
    }
  }
  throw lastError;
}

async function createWindow() {
  const window = new BrowserWindow({
    width: 1280,
    height: 900,
    show: false,
    backgroundColor: "#f4f6f2",
    webPreferences: {
      allowRunningInsecureContent: false,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    },
  });
  window.webContents.session.on("will-download", (_event, item) => {
    item.setSavePath(path.join(downloadDir, item.getFilename()));
  });
  await loadUrlWithRetry(window, appUrl);
  await window.webContents.executeJavaScript("document.fonts?.ready || Promise.resolve()", true);
  return window;
}

async function runPageScript(window, source) {
  return window.webContents.executeJavaScript(source, true);
}

async function clearBrowserStorage(window) {
  await runPageScript(window, `
    (async () => {
      localStorage.clear();
      localStorage.setItem("home-ledger:disable-temp-sample-records", "true");
      ${appTheme ? `localStorage.setItem("home-ledger:theme-preference", ${JSON.stringify(appTheme)});` : ""}
      if (indexedDB.databases) {
        const databases = await indexedDB.databases();
        await Promise.all(databases.map((database) => new Promise((resolve, reject) => {
          const request = indexedDB.deleteDatabase(database.name);
          request.onsuccess = () => resolve();
          request.onerror = () => reject(request.error);
          request.onblocked = () => resolve();
        })));
      } else {
        await new Promise((resolve, reject) => {
          const request = indexedDB.deleteDatabase("home-ledger-documents");
          request.onsuccess = () => resolve();
          request.onerror = () => reject(request.error);
          request.onblocked = () => resolve();
        });
      }
    })()
  `);
  await window.reload();
  await window.webContents.executeJavaScript("document.fonts?.ready || Promise.resolve()", true);
}

async function seedRecordsWithAttachment(window) {
  return runPageScript(window, `
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
      const submit = async (selector) => {
        const form = document.querySelector(selector);
        assert(form, "Missing form: " + selector);
        const button = form.querySelector('button[type="submit"]');
        assert(button, "Missing submit button for form: " + selector);
        button.click();
        await sleep(200);
      };
      const bodyIncludes = (text) => document.body.innerText.includes(text);
      const waitForSlow = async (predicate, label) => {
        for (let attempt = 0; attempt < 240; attempt += 1) {
          if (predicate()) return;
          await sleep(250);
        }
        const records = JSON.parse(localStorage.getItem("home-ledger:v1") || "{}");
        const localText = records.documents?.[0]?.ocrText || "";
        const previewText = document.querySelector(".document-preview-modal")?.innerText || "";
        throw new Error(
          "Timed out waiting for " + label +
          ": savedText=" + JSON.stringify(localText).slice(0, 500) +
          " preview=" + JSON.stringify(previewText).slice(0, 700) +
          " body=" + document.body.innerText.slice(0, 1200)
        );
      };
      const encodeAscii = (value) => new TextEncoder().encode(value);
      const concatBytes = (...chunks) => {
        const totalLength = chunks.reduce((total, chunk) => total + chunk.length, 0);
        const combined = new Uint8Array(totalLength);
        let offset = 0;
        chunks.forEach((chunk) => {
          combined.set(chunk, offset);
          offset += chunk.length;
        });
        return combined;
      };
      const base64ToBytes = (value) => Uint8Array.from(atob(value), (character) => character.charCodeAt(0));
      const makePdfObject = (number, body) => concatBytes(
        encodeAscii(number + " 0 obj\\n"),
        typeof body === "string" ? encodeAscii(body) : body,
        encodeAscii("\\nendobj\\n"),
      );
      const buildScannedPdfBytes = async () => {
        const canvas = document.createElement("canvas");
        canvas.width = 900;
        canvas.height = 260;
        const context = canvas.getContext("2d");
        assert(context, "Missing canvas context for QA PDF.");
        context.fillStyle = "#ffffff";
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.fillStyle = "#111111";
        context.font = "700 68px Arial";
        context.fillText("BETA PDF OCR", 92, 125);
        context.font = "600 34px Arial";
        context.fillText("INVOICE 3487", 270, 185);

        const jpegBytes = base64ToBytes(canvas.toDataURL("image/jpeg", 0.95).split(",")[1]);
        const contentStream = "q\\n" + canvas.width + " 0 0 " + canvas.height + " 0 0 cm\\n/Im0 Do\\nQ\\n";
        const objects = [
          "<< /Type /Catalog /Pages 2 0 R >>",
          "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
          "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 " + canvas.width + " " + canvas.height + "] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>",
          concatBytes(
            encodeAscii("<< /Type /XObject /Subtype /Image /Width " + canvas.width + " /Height " + canvas.height + " /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length " + jpegBytes.length + " >>\\nstream\\n"),
            jpegBytes,
            encodeAscii("\\nendstream"),
          ),
          "<< /Length " + encodeAscii(contentStream).length + " >>\\nstream\\n" + contentStream + "endstream",
        ];

        const header = encodeAscii("%PDF-1.4\\n");
        const chunks = [header];
        const offsets = [];
        let byteOffset = header.length;
        objects.forEach((body, index) => {
          offsets.push(byteOffset);
          const objectBytes = makePdfObject(index + 1, body);
          chunks.push(objectBytes);
          byteOffset += objectBytes.length;
        });

        const xrefOffset = byteOffset;
        const xref = [
          "xref",
          "0 " + (objects.length + 1),
          "0000000000 65535 f ",
          ...offsets.map((offset) => String(offset).padStart(10, "0") + " 00000 n "),
          "trailer",
          "<< /Size " + (objects.length + 1) + " /Root 1 0 R >>",
          "startxref",
          String(xrefOffset),
          "%%EOF",
          "",
        ].join("\\n");
        return concatBytes(...chunks, encodeAscii(xref));
      };

      window.confirm = () => true;

      await click('[data-action="add-property"]');
      await setValue("name", "Beta QA Home");
      await setValue("address", "14 Stable Lane, Portland, OR 97201");
      await setValue("purchaseDate", "2021-04-15");
      await setValue("purchasePrice", "510000");
      await submit('[data-form="property"]');
      await waitFor(() => bodyIncludes("Property saved.") && bodyIncludes("Beta QA Home"), "property save");

      await click('[data-tab="projects"]');
      await click('[data-action="manage-vendors"]');
      await click('[data-action="add-vendor"]');
      await setValue("name", "Beta Stone Co.");
      await setValue("category", "kitchen");
      await submit('[data-form="vendor"]');
      await waitFor(() => bodyIncludes("Vendor saved.") && bodyIncludes("Beta Stone Co."), "vendor save");
      await click('[data-action="close-vendor-manager"]');

      await click('[data-action="add-project"]');
      await setValue("name", "Kitchen counters");
      await setValue("category", "kitchen");
      await setValue("status", "completed");
      const vendorOption = Array.from(document.querySelectorAll('[name="vendorId"] option')).find((option) => option.textContent.includes("Beta Stone Co."));
      assert(vendorOption, "Missing vendor option for project.");
      await setValue("vendorId", vendorOption.value);
      await submit('[data-form="project"]');
      await waitFor(() => bodyIncludes("Project saved.") && bodyIncludes("Kitchen counters"), "project save");

      await click('[data-tab="expenses"]');
      await click('[data-action="add-expense"]');
      await setValue("date", "2025-02-18");
      await setValue("amount", "3487.42");
      await setValue("description", "Quartz countertop installation");
      await setValue("classification", "potential basis addition");
      await setValue("category", "kitchen");
      await setValue("documentationStatus", "invoice attached");
      const projectOption = document.querySelector('[name="projectId"] option:not([value=""])');
      if (projectOption) await setValue("projectId", projectOption.value);
      await setValue("vendorId", vendorOption.value);
      await submit('[data-form="expense"]');
      await waitFor(() => bodyIncludes("Expense saved.") && bodyIncludes("Quartz countertop installation"), "expense save");

      await click('[data-tab="documents"]');
      await click('[data-action="add-document"]');
      await setValue("displayName", "Countertop invoice");
      await setValue("documentType", "invoice");
      const expenseOption = document.querySelector('[name="expenseId"] option:not([value=""])');
      assert(expenseOption, "Missing expense option for document.");
      await setValue("expenseId", expenseOption.value);
      await setValue("notes", "Attachment path should be sanitized: /Users/private/countertop-invoice.pdf");
      const fileInput = document.querySelector('[data-form="document"] input[name="file"]');
      assert(fileInput, "Missing document file input.");
      const dataTransfer = new DataTransfer();
      const pdfBytes = await buildScannedPdfBytes();
      dataTransfer.items.add(new File(
        [pdfBytes],
        "/Users/private/countertop-invoice.pdf",
        { type: "application/pdf", lastModified: 1739836800000 },
      ));
      fileInput.files = dataTransfer.files;
      fileInput.dispatchEvent(new Event("change", { bubbles: true }));
      await submit('[data-form="document"]');
      await waitFor(() => bodyIncludes("Document and attached file saved.") && bodyIncludes("Countertop invoice"), "document save");
      await waitFor(() => {
        const savedRecords = JSON.parse(localStorage.getItem("home-ledger:v1"));
        return savedRecords.documents.length === 1 && savedRecords.documents[0].hasFile;
      }, "document persistence");
      let records = JSON.parse(localStorage.getItem("home-ledger:v1"));
      const savedDocumentId = records.documents[0].id;
      const previewButton = document.querySelector('[data-action="preview-document-file"][data-id="' + savedDocumentId + '"]');
      assert(previewButton?.textContent.trim() === "View file", "Stored document should expose a clear View file action.");

      await click('[data-action="preview-document-file"][data-id="' + savedDocumentId + '"]');
      await waitFor(() => {
        const button = document.querySelector('.document-preview-modal [data-action="run-document-ocr"]');
        return button && !button.disabled;
      }, "document preview");
      assert(document.querySelector("#document-preview-title")?.textContent.trim() === "Countertop invoice", "Document reader title should match the selected document.");
      assert(Boolean(document.querySelector(".document-preview-frame iframe")), "Document reader should show the stored PDF frame.");
      const readerNotes = document.querySelector('.document-preview-modal textarea[name="notes"]');
      assert(readerNotes, "Document reader should expose editable notes.");
      readerNotes.value = "Reader note saved locally. /Users/private/reader-note.pdf";
      readerNotes.dispatchEvent(new Event("input", { bubbles: true }));
      const saveReaderNotes = document.querySelector('.document-preview-modal button[type="submit"]');
      assert(saveReaderNotes, "Document reader should expose a Save notes action.");
      saveReaderNotes.click();
      await waitFor(() => {
        const records = JSON.parse(localStorage.getItem("home-ledger:v1"));
        return records.documents[0]?.notes === "Reader note saved locally. [local file path removed]";
      }, "reader note save");
      await click('[data-action="run-document-ocr"]');
      await waitForSlow(() => {
        const records = JSON.parse(localStorage.getItem("home-ledger:v1"));
        const ocrText = records.documents[0]?.ocrText || "";
        return /BETA|PDF|OCR|INVOICE|3487/i.test(ocrText);
      }, "PDF local text extraction");
      await click('[data-action="close-document-preview"]');
      await click('[data-tab="calculators"]');
      await click('[data-tab="dashboard"]');
      await click('[data-action="set-dashboard-subtab"][data-dashboard-subtab="attention"]');
      await waitFor(() =>
        bodyIncludes("Items to review") &&
        bodyIncludes("Type\tRecord\tIssue\tResolve") &&
        bodyIncludes("Project item") &&
        bodyIncludes("4"),
        "dashboard canonical follow-ups",
      );
      await click('[data-tab="calculators"]');
      await setValue("salePrice", "900000");
      await setValue("mortgagePayoff", "300000");
      await setValue("sellingCostsRate", "6");
      await setValue("sellingCostsAmount", "");
      await setValue("exclusionAmount", "250000");
      await submit('[data-form="sale-scenario"]');
      await waitFor(() => bodyIncludes("Estimated gain before tax review") && bodyIncludes("$82,512.58") && bodyIncludes("$546,000.00"), "sale scenario estimate");

      records = JSON.parse(localStorage.getItem("home-ledger:v1"));
      assert(records.properties.length === 1, "Expected one property.");
      assert(records.vendors.length === 1, "Expected one vendor.");
      assert(records.projects.length === 1, "Expected one project.");
      assert(records.expenses.length === 1, "Expected one expense.");
      assert(records.projects[0].vendorId === records.vendors[0].id, "Project should link to vendor.");
      assert(records.expenses[0].vendorId === records.vendors[0].id, "Expense should link to vendor.");
      assert(records.documents.length === 1, "Expected one document.");
      const documentRecord = records.documents[0];
      assert(documentRecord.hasFile, "Document should have a stored file.");
      assert(documentRecord.fileName === "countertop-invoice.pdf", "File name should be sanitized.");
      assert(/BETA|PDF|OCR|INVOICE|3487/i.test(documentRecord.ocrText || ""), "PDF OCR text was not saved with the document.");
      assert(!JSON.stringify(records).includes("/Users/private"), "Raw local path leaked into stored records.");
      const database = await new Promise((resolve, reject) => {
        const request = indexedDB.open("home-ledger-documents", 1);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      const storedFile = await new Promise((resolve, reject) => {
        const request = database.transaction("files", "readonly").objectStore("files").get(documentRecord.fileId);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      assert(storedFile?.blob, "Stored attachment blob was missing.");
      assert(storedFile.blob.type === "application/pdf", "Stored attachment type should be application/pdf.");
      assert(storedFile.blob.size > 1000, "Stored PDF attachment was unexpectedly small.");
      assert((await storedFile.blob.text()).startsWith("%PDF-1.4"), "Stored attachment was not a PDF.");
      database.close();

      return {
        documentFileId: documentRecord.fileId,
        documentFileName: documentRecord.fileName,
        ocrText: documentRecord.ocrText,
      };
    })()
  `);
}

async function downloadBackup(window) {
  await fs.mkdir(downloadDir, { recursive: true });
  const beforeFiles = new Set(await fs.readdir(downloadDir).catch(() => []));
  await runPageScript(window, `
    (async () => {
      const sleep = (ms = 75) => new Promise((resolve) => setTimeout(resolve, ms));
      document.querySelector('[data-tab="export"]').click();
      await sleep();
      document.querySelector('[data-action="download-full-backup"]').click();
    })()
  `);

  for (let attempt = 0; attempt < 100; attempt += 1) {
    const files = await fs.readdir(downloadDir).catch(() => []);
    const newFile = files.find((fileName) => !beforeFiles.has(fileName) && fileName.endsWith(".json"));
    if (newFile) {
      const backupPath = path.join(downloadDir, newFile);
      const backupText = await fs.readFile(backupPath, "utf8");
      const backup = JSON.parse(backupText);
      assert(backup.app === "home-basis-tracker", "Backup app id did not match.");
      assert(backup.data.documents.length === 1, "Backup should include one document.");
      assert(/BETA|PDF|OCR|INVOICE|3487/i.test(backup.data.documents[0].ocrText || ""), "Backup should include local PDF text.");
      assert(backup.files.length === 1, "Backup should include one attachment file.");
      assert(backup.files[0].dataUrl.startsWith("data:application/pdf"), "Backup attachment should be encoded as a PDF data URL.");
      return { backupPath, backupText, backup };
    }
    await new Promise((resolve) => {
      setTimeout(resolve, 100);
    });
  }

  throw new Error("Timed out waiting for full backup download.");
}

async function restoreBackup(window, backupText) {
  return runPageScript(window, `
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

      window.confirm = () => true;
      document.querySelector('[data-tab="export"]').click();
      await sleep();
      const restoreInput = document.querySelector("[data-restore-input]");
      assert(restoreInput, "Missing restore input.");
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(new File(
        [${JSON.stringify(backupText)}],
        "home-basis-tracker-beta-qa-backup.json",
        { type: "application/json" },
      ));
      restoreInput.files = dataTransfer.files;
      restoreInput.dispatchEvent(new Event("change", { bubbles: true }));
      await waitFor(() => document.body.innerText.includes("Backup restored."), "backup restore");

      const records = JSON.parse(localStorage.getItem("home-ledger:v1"));
      assert(records.properties.length === 1, "Restored backup should have one property.");
      assert(records.vendors.length === 1, "Restored backup should have one vendor.");
      assert(records.projects.length === 1, "Restored backup should have one project.");
      assert(records.expenses.length === 1, "Restored backup should have one expense.");
      assert(records.documents.length === 1, "Restored backup should have one document.");
      assert(records.projects[0].vendorId === records.vendors[0].id, "Restored project should link to vendor.");
      assert(records.expenses[0].vendorId === records.vendors[0].id, "Restored expense should link to vendor.");
      const documentRecord = records.documents[0];
      assert(documentRecord.hasFile, "Restored document should have an attached file.");
      assert(documentRecord.fileName === "countertop-invoice.pdf", "Restored file name should stay sanitized.");
      assert(/BETA|PDF|OCR|INVOICE|3487/i.test(documentRecord.ocrText || ""), "Restored document should keep local PDF text.");
      assert(records.expenses[0].documentationStatus === "invoice attached", "Restored expense should be marked invoice attached.");
      assert(!JSON.stringify(records).includes("/Users/private"), "Raw local path leaked after restore.");

      const database = await new Promise((resolve, reject) => {
        const request = indexedDB.open("home-ledger-documents", 1);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      const storedFile = await new Promise((resolve, reject) => {
        const request = database.transaction("files", "readonly").objectStore("files").get(documentRecord.fileId);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      assert(storedFile?.blob, "Restored attachment blob was missing.");
      assert(storedFile.blob.type === "application/pdf", "Restored attachment type should be application/pdf.");
      assert(storedFile.blob.size > 1000, "Restored PDF attachment was unexpectedly small.");
      assert((await storedFile.blob.text()).startsWith("%PDF-1.4"), "Restored attachment was not a PDF.");
      database.close();

      return {
        properties: records.properties.length,
        vendors: records.vendors.length,
        projects: records.projects.length,
        expenses: records.expenses.length,
        documents: records.documents.length,
        restoredFileName: documentRecord.fileName,
        ocrText: documentRecord.ocrText,
      };
    })()
  `);
}

async function captureBetaScreens(window) {
  if (!appTheme) return [];
  await fs.mkdir(outputDir, { recursive: true });
  const screens = [
    { name: "beta-dashboard", script: "document.querySelector('[data-tab=\"dashboard\"]')?.click(); document.querySelector('[data-action=\"set-dashboard-subtab\"][data-dashboard-subtab=\"activity\"]')?.click(); document.querySelector('[data-action=\"toggle-dashboard-property\"]')?.click();" },
    { name: "beta-property", script: "document.querySelector('[data-tab=\"property\"]')?.click();" },
    { name: "beta-projects", script: "document.querySelector('[data-tab=\"projects\"]')?.click();" },
    { name: "beta-project-file", script: "document.querySelector('[data-tab=\"projects\"]')?.click(); await new Promise((resolve) => setTimeout(resolve, 80)); document.querySelector('[data-action=\"select-project\"]')?.click();" },
    { name: "beta-expenses", script: "document.querySelector('[data-tab=\"expenses\"]')?.click();" },
    { name: "beta-documents", script: "document.querySelector('[data-tab=\"documents\"]')?.click();" },
    { name: "beta-document-form", script: "document.querySelector('[data-tab=\"documents\"]')?.click(); await new Promise((resolve) => setTimeout(resolve, 80)); document.querySelector('[data-action=\"edit-document\"]')?.click();" },
    { name: "beta-calculators", script: "document.querySelector('[data-tab=\"calculators\"]')?.click();" },
    { name: "beta-settings", script: "document.querySelector('[data-action=\"open-settings\"]')?.click();" },
  ];
  const screenshotPaths = [];

  for (const screen of screens) {
    await runPageScript(window, `
      (async () => {
        document.querySelector('[data-action="close-project-file"]')?.click();
        document.querySelector('[data-action="close-expense-form"]')?.click();
        document.querySelector('[data-action="close-document-form"]')?.click();
        document.querySelector('[data-action="close-records-to-finish"]')?.click();
        document.querySelector('[data-action="close-follow-up-resolution"]')?.click();
        ${screen.script}
        await new Promise((resolve) => setTimeout(resolve, 180));
        window.scrollTo(0, 0);
      })()
    `);
    const image = await window.webContents.capturePage();
    const screenshotPath = path.join(outputDir, `${screen.name}-${appTheme}.png`);
    await fs.writeFile(screenshotPath, image.toPNG());
    screenshotPaths.push(screenshotPath);
  }

  return screenshotPaths;
}

async function main() {
  const window = await createWindow();
  try {
    await clearBrowserStorage(window);
    const seeded = await seedRecordsWithAttachment(window);
    const screenshotPaths = await captureBetaScreens(window);
    const backupResult = await downloadBackup(window);
    await clearBrowserStorage(window);
    const restored = await restoreBackup(window, backupResult.backupText);
    console.log(`Home Ledger browser beta QA passed: ${restored.properties} property, ${restored.projects} project, ${restored.expenses} expense, ${restored.documents} document, restored ${restored.restoredFileName}.`);
    console.log(`Backup verified: ${backupResult.backupPath}`);
    if (screenshotPaths.length) console.log(`Dark UI screenshots: ${screenshotPaths.join(", ")}`);
    assert(seeded.documentFileName === restored.restoredFileName, "Restored file name changed unexpectedly.");
    assert(seeded.ocrText === restored.ocrText, "Restored local document text changed unexpectedly.");
  } finally {
    window.destroy();
  }
}

app.whenReady()
  .then(main)
  .catch((error) => {
    console.error(`Home Ledger browser beta QA failed: ${error?.message || error}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await fs.rm(userDataDir, { recursive: true, force: true });
    } catch {
      // Cleanup should not hide the QA result.
    }
    app.exit(process.exitCode || 0);
  });
