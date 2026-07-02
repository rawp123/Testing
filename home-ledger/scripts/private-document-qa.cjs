const { app, BrowserWindow } = require("electron");
const fs = require("node:fs/promises");
const fsSync = require("node:fs");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");

const productRoot = path.resolve(__dirname, "..");
const fixtureDir = path.join(productRoot, "fixtures", "private-documents");
const userDataDir = path.join(os.tmpdir(), `home-basis-private-document-qa-${process.pid}`);
const maxQaBytes = Number(process.env.HOME_LEDGER_PRIVATE_QA_MAX_BYTES || 15 * 1024 * 1024);

const mimeTypes = new Map([
  [".bmp", "image/bmp"],
  [".csv", "text/csv"],
  [".gif", "image/gif"],
  [".jpeg", "image/jpeg"],
  [".jpg", "image/jpeg"],
  [".md", "text/markdown"],
  [".pdf", "application/pdf"],
  [".png", "image/png"],
  [".text", "text/plain"],
  [".tif", "image/tiff"],
  [".tiff", "image/tiff"],
  [".txt", "text/plain"],
  [".webp", "image/webp"],
]);

const contentTypes = new Map([
  [".css", "text/css; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".mjs", "text/javascript; charset=utf-8"],
  [".wasm", "application/wasm"],
]);

app.setPath("userData", userDataDir);
app.commandLine.appendSwitch("disable-features", "LocalNetworkAccessChecks");
app.on("window-all-closed", (event) => {
  event.preventDefault();
});

function resolveRequestPath(requestUrl, port) {
  const parsedUrl = new URL(requestUrl || "/", `http://127.0.0.1:${port}`);
  const pathname = decodeURIComponent(parsedUrl.pathname);
  let relativePath = pathname === "/" || pathname === "/index.html" ? "frontend/index.html" : pathname.replace(/^\/+/, "");
  if (relativePath === "app.js" || relativePath === "styles.css") {
    relativePath = `frontend/${relativePath}`;
  }
  let filePath = path.resolve(productRoot, relativePath);

  if (!filePath.startsWith(`${productRoot}${path.sep}`) && filePath !== productRoot) {
    return "";
  }
  if (fsSync.existsSync(filePath) && fsSync.statSync(filePath).isDirectory()) {
    filePath = path.join(filePath, "index.html");
  }
  return filePath;
}

function createStaticServer() {
  const server = http.createServer((request, response) => {
    const port = server.address().port;
    const filePath = resolveRequestPath(request.url, port);
    if (!filePath) {
      response.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Forbidden");
      return;
    }

    fs.readFile(filePath)
      .then((data) => {
        response.writeHead(200, {
          "Content-Type": contentTypes.get(path.extname(filePath)) || "application/octet-stream",
          "Cache-Control": "no-store",
        });
        response.end(data);
      })
      .catch((error) => {
        response.writeHead(error.code === "ENOENT" ? 404 : 500, {
          "Content-Type": "text/plain; charset=utf-8",
        });
        response.end(error.code === "ENOENT" ? "Not found" : "Server error");
      });
  });

  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolve(server));
  });
}

async function collectFixtureFiles(directory) {
  try {
    const entries = await fs.readdir(directory, { withFileTypes: true });
    const files = [];
    for (const entry of entries) {
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        files.push(...await collectFixtureFiles(entryPath));
      } else if (entry.isFile()) {
        files.push(entryPath);
      }
    }
    return files.sort();
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
}

async function createWindow(appUrl) {
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
  await window.loadURL(appUrl);
  await window.webContents.executeJavaScript("document.fonts?.ready || Promise.resolve()", true);
  return window;
}

function runPageScript(window, source) {
  return window.webContents.executeJavaScript(source, true);
}

async function clearBrowserStorage(window) {
  await runPageScript(window, `
    (async () => {
      localStorage.clear();
      await new Promise((resolve) => {
        const request = indexedDB.deleteDatabase("home-ledger-documents");
        request.onsuccess = () => resolve();
        request.onerror = () => resolve();
        request.onblocked = () => resolve();
      });
    })()
  `);
  await window.reload();
  await window.webContents.executeJavaScript("document.fonts?.ready || Promise.resolve()", true);
}

async function seedBaseRecords(window) {
  await runPageScript(window, `
    (async () => {
      const sleep = (ms = 75) => new Promise((resolve) => setTimeout(resolve, ms));
      const assert = (condition, message) => {
        if (!condition) throw new Error(message);
      };
      const waitFor = async (predicate, label) => {
        for (let attempt = 0; attempt < 100; attempt += 1) {
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
      await setValue("name", "Private Document QA Home");
      await setValue("address", "22 Review Lane, Portland, OR 97201");
      await setValue("purchaseDate", "2022-01-10");
      await setValue("purchasePrice", "575000");
      await submit('[data-form="property"]');
      await waitFor(() => bodyIncludes("Property saved.") && bodyIncludes("Private Document QA Home"), "property save");

      await click('[data-tab="projects"]');
      await click('[data-action="manage-vendors"]');
      await click('[data-action="add-vendor"]');
      await setValue("name", "Private QA Vendor");
      await setValue("category", "other");
      await submit('[data-form="vendor"]');
      await waitFor(() => bodyIncludes("Vendor saved.") && bodyIncludes("Private QA Vendor"), "vendor save");
      await click('[data-action="close-vendor-manager"]');

      await click('[data-action="add-project"]');
      await setValue("name", "Private document review");
      await setValue("category", "other");
      await setValue("status", "completed");
      const vendorOption = Array.from(document.querySelectorAll('[name="vendorId"] option')).find((option) => option.textContent.includes("Private QA Vendor"));
      assert(vendorOption, "Missing vendor option for private QA project.");
      await setValue("vendorId", vendorOption.value);
      await submit('[data-form="project"]');
      await waitFor(() => bodyIncludes("Project saved.") && bodyIncludes("Private document review"), "project save");

      await click('[data-tab="expenses"]');
      await click('[data-action="add-expense"]');
      await setValue("date", "2025-01-15");
      await setValue("amount", "100");
      await setValue("description", "Private document QA expense");
      await setValue("classification", "unclear / ask CPA");
      await setValue("category", "other");
      await setValue("documentationStatus", "no document yet");
      const projectOption = document.querySelector('[name="projectId"] option:not([value=""])');
      if (projectOption) await setValue("projectId", projectOption.value);
      await setValue("vendorId", vendorOption.value);
      await submit('[data-form="expense"]');
      await waitFor(() => bodyIncludes("Expense saved.") && bodyIncludes("Private document QA expense"), "expense save");
    })()
  `);
}

function documentTypeForMime(mimeType) {
  if (mimeType === "application/pdf") return "invoice";
  if (mimeType.startsWith("image/")) return "photo";
  return "other";
}

async function runDocumentQa(window, fixture) {
  const fileBuffer = await fs.readFile(fixture.path);
  const source = `
    (async () => {
      const fixture = ${JSON.stringify({
        name: fixture.name,
        base64: fileBuffer.toString("base64"),
        mimeType: fixture.mimeType,
        documentType: documentTypeForMime(fixture.mimeType),
        lastModified: fixture.lastModified,
      })};
      const sleep = (ms = 100) => new Promise((resolve) => setTimeout(resolve, ms));
      const assert = (condition, message) => {
        if (!condition) throw new Error(message);
      };
      const waitFor = async (predicate, label, attempts = 120, interval = 100) => {
        for (let attempt = 0; attempt < attempts; attempt += 1) {
          const value = predicate();
          if (value) return value;
          await sleep(interval);
        }
        throw new Error("Timed out waiting for " + label + ": " + document.body.innerText.slice(0, 900));
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
        await sleep(250);
      };
      const bytes = Uint8Array.from(atob(fixture.base64), (character) => character.charCodeAt(0));
      const beforeRecords = JSON.parse(localStorage.getItem("home-ledger:v1") || "{}");
      const beforeDocumentIds = new Set((beforeRecords.documents || []).map((document) => document.id));

      await click('[data-tab="documents"]');
      await click('[data-action="add-document"]');
      await setValue("displayName", "Private QA - " + fixture.name);
      await setValue("documentType", fixture.documentType);
      const expenseOption = document.querySelector('[name="expenseId"] option:not([value=""])');
      if (expenseOption) await setValue("expenseId", expenseOption.value);
      const fileInput = document.querySelector('[data-form="document"] input[name="file"]');
      assert(fileInput, "Missing document file input.");
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(new File([bytes], fixture.name, {
        type: fixture.mimeType,
        lastModified: fixture.lastModified,
      }));
      fileInput.files = dataTransfer.files;
      fileInput.dispatchEvent(new Event("change", { bubbles: true }));
      await submit('[data-form="document"]');
      await waitFor(() => document.body.innerText.includes("Document and local file saved."), "document save");

      const savedRecords = JSON.parse(localStorage.getItem("home-ledger:v1") || "{}");
      const documentRecord = (savedRecords.documents || []).find((document) => !beforeDocumentIds.has(document.id));
      assert(documentRecord?.hasFile, "Saved document did not keep an attached file.");
      assert(!JSON.stringify(documentRecord).includes("/Users/"), "Raw local path leaked into stored document metadata.");

      await click('[data-action="preview-document-file"][data-id="' + documentRecord.id + '"]');
      const readButton = await waitFor(
        () => document.querySelector('.document-preview-modal [data-action="run-document-ocr"]'),
        "document preview",
      );
      const readable = !readButton.disabled;
      if (!readable) {
        return {
          status: "unavailable",
          readable,
          textLength: 0,
          fileName: documentRecord.fileName,
        };
      }

      readButton.click();
      const outcome = await waitFor(() => {
        const records = JSON.parse(localStorage.getItem("home-ledger:v1") || "{}");
        const current = (records.documents || []).find((document) => document.id === documentRecord.id);
        const text = current?.ocrText || "";
        const body = document.body.innerText;
        if (text.trim()) {
          return { status: "extracted", textLength: text.length };
        }
        if (body.includes("Text reading finished, but no text was found.")) {
          return { status: "empty", textLength: 0 };
        }
        if (/could not|too large|not available|failed|unsupported/i.test(body)) {
          return { status: "failed", textLength: 0 };
        }
        return null;
      }, "local text reading", 360, 250);

      return {
        ...outcome,
        readable,
        fileName: documentRecord.fileName,
      };
    })()
  `;
  return window.webContents.executeJavaScript(source, true);
}

async function main() {
  const fixturePaths = await collectFixtureFiles(fixtureDir);
  if (!fixturePaths.length) {
    console.log(`No private documents found at ${fixtureDir}. Skipping private document QA.`);
    return;
  }

  const fixtures = [];
  for (const fixturePath of fixturePaths) {
    const extension = path.extname(fixturePath).toLowerCase();
    const mimeType = mimeTypes.get(extension);
    const stats = await fs.stat(fixturePath);
    const relativePath = path.relative(fixtureDir, fixturePath);
    if (!mimeType) {
      console.log(`SKIP ${relativePath} | unsupported extension`);
      continue;
    }
    if (stats.size > maxQaBytes) {
      console.log(`SKIP ${relativePath} | ${stats.size} bytes exceeds private QA limit ${maxQaBytes}`);
      continue;
    }
    fixtures.push({
      path: fixturePath,
      name: path.basename(fixturePath),
      relativePath,
      mimeType,
      size: stats.size,
      lastModified: Math.round(stats.mtimeMs),
    });
  }

  if (!fixtures.length) {
    console.log(`No supported private documents found at ${fixtureDir}.`);
    return;
  }

  const server = await createStaticServer();
  const appUrl = `http://127.0.0.1:${server.address().port}`;
  const window = await createWindow(appUrl);
  try {
    await clearBrowserStorage(window);
    await seedBaseRecords(window);
    for (const fixture of fixtures) {
      const result = await runDocumentQa(window, fixture);
      console.log([
        `QA ${fixture.relativePath}`,
        `type=${fixture.mimeType}`,
        `bytes=${fixture.size}`,
        `storedName=${result.fileName}`,
        `readable=${result.readable}`,
        `status=${result.status}`,
        `textLength=${result.textLength}`,
      ].join(" | "));
    }
  } finally {
    window.destroy();
    await new Promise((resolve) => server.close(resolve));
  }
}

app.whenReady()
  .then(main)
  .catch((error) => {
    console.error(`Home Ledger private document QA failed: ${error?.message || error}`);
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
