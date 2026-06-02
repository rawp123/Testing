const { app, BrowserWindow } = require("electron");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");

const appUrl = process.env.QA_APP_URL || "http://127.0.0.1:3102";
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

      window.confirm = () => true;

      await click('[data-action="add-property"]');
      await setValue("name", "Beta QA Home");
      await setValue("address", "14 Stable Lane, Portland, OR 97201");
      await setValue("purchaseDate", "2021-04-15");
      await setValue("purchasePrice", "510000");
      await submit('[data-form="property"]');
      await waitFor(() => bodyIncludes("Property saved.") && bodyIncludes("Beta QA Home"), "property save");

      await click('[data-tab="projects"]');
      await click('[data-action="add-project"]');
      await setValue("name", "Kitchen counters");
      await setValue("category", "kitchen");
      await setValue("status", "completed");
      await setValue("contractor", "Beta Stone Co.");
      await submit('[data-form="project"]');
      await waitFor(() => bodyIncludes("Project saved.") && bodyIncludes("Kitchen counters"), "project save");

      await click('[data-tab="expenses"]');
      await click('[data-action="add-expense"]');
      await setValue("date", "2025-02-18");
      await setValue("amount", "3487.42");
      await setValue("vendor", "Beta Stone Co.");
      await setValue("description", "Quartz countertop installation");
      await setValue("classification", "potential basis addition");
      await setValue("category", "kitchen");
      await setValue("documentationStatus", "no document yet");
      const projectOption = document.querySelector('[name="projectId"] option:not([value=""])');
      if (projectOption) await setValue("projectId", projectOption.value);
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
      dataTransfer.items.add(new File(
        ["beta qa invoice file contents"],
        "/Users/private/countertop-invoice.pdf",
        { type: "application/pdf", lastModified: 1739836800000 },
      ));
      fileInput.files = dataTransfer.files;
      fileInput.dispatchEvent(new Event("change", { bubbles: true }));
      await submit('[data-form="document"]');
      await waitFor(() => bodyIncludes("Document and local file saved.") && bodyIncludes("Countertop invoice"), "document save");

      const records = JSON.parse(localStorage.getItem("home-ledger:v1"));
      assert(records.properties.length === 1, "Expected one property.");
      assert(records.projects.length === 1, "Expected one project.");
      assert(records.expenses.length === 1, "Expected one expense.");
      assert(records.documents.length === 1, "Expected one document.");
      const documentRecord = records.documents[0];
      assert(documentRecord.hasFile, "Document should have a stored file.");
      assert(documentRecord.fileName === "countertop-invoice.pdf", "File name should be sanitized.");
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
      assert(await storedFile.blob.text() === "beta qa invoice file contents", "Stored attachment contents did not match.");
      database.close();

      return {
        documentFileId: documentRecord.fileId,
        documentFileName: documentRecord.fileName,
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
      assert(records.projects.length === 1, "Restored backup should have one project.");
      assert(records.expenses.length === 1, "Restored backup should have one expense.");
      assert(records.documents.length === 1, "Restored backup should have one document.");
      const documentRecord = records.documents[0];
      assert(documentRecord.hasFile, "Restored document should have an attached file.");
      assert(documentRecord.fileName === "countertop-invoice.pdf", "Restored file name should stay sanitized.");
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
      assert(await storedFile.blob.text() === "beta qa invoice file contents", "Restored attachment contents did not match.");
      database.close();

      return {
        properties: records.properties.length,
        projects: records.projects.length,
        expenses: records.expenses.length,
        documents: records.documents.length,
        restoredFileName: documentRecord.fileName,
      };
    })()
  `);
}

async function main() {
  const window = await createWindow();
  try {
    await clearBrowserStorage(window);
    const seeded = await seedRecordsWithAttachment(window);
    const backupResult = await downloadBackup(window);
    await clearBrowserStorage(window);
    const restored = await restoreBackup(window, backupResult.backupText);
    console.log(`Home Basis Tracker browser beta QA passed: ${restored.properties} property, ${restored.projects} project, ${restored.expenses} expense, ${restored.documents} document, restored ${restored.restoredFileName}.`);
    console.log(`Backup verified: ${backupResult.backupPath}`);
    assert(seeded.documentFileName === restored.restoredFileName, "Restored file name changed unexpectedly.");
  } finally {
    window.destroy();
  }
}

app.whenReady()
  .then(main)
  .catch((error) => {
    console.error(`Home Basis Tracker browser beta QA failed: ${error?.message || error}`);
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
