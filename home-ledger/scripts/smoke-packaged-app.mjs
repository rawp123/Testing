import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";

const require = createRequire(import.meta.url);
const asar = require("../desktop/node_modules/@electron/asar");

function argValue(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : "";
}

const skipMissing = process.argv.includes("--skip-missing");
const appPath = path.resolve(argValue("--app") || "release/mac/mac-arm64/Home Ledger.app");
const executablePath = process.platform === "darwin"
  ? path.join(appPath, "Contents", "MacOS", "Home Ledger")
  : appPath;
const resourcesDir = path.join(appPath, "Contents", "Resources", "home-ledger");
const appAsar = path.join(appPath, "Contents", "Resources", "app.asar");

if (!fs.existsSync(executablePath)) {
  const message = `Packaged app executable was not found at ${executablePath}. Run npm run pack:mac first.`;
  if (skipMissing) {
    console.warn(`Skipping packaged smoke test: ${message}`);
    process.exit(0);
  }
  throw new Error(message);
}

const requiredResources = [
  appAsar,
  path.join(resourcesDir, "frontend", "index.html"),
  path.join(resourcesDir, "frontend", "app.js"),
  path.join(resourcesDir, "frontend", "styles.css"),
  path.join(resourcesDir, "backend", "domain", "backup.js"),
  path.join(resourcesDir, "backend", "domain", "model.js"),
  path.join(resourcesDir, "backend", "domain", "tutorial-data.js"),
  path.join(resourcesDir, "backend", "storage", "document-storage.js"),
  path.join(resourcesDir, "backend", "storage", "records-storage.js"),
  path.join(resourcesDir, "node_modules", "tesseract.js", "dist", "tesseract.esm.min.js"),
  path.join(resourcesDir, "node_modules", "pdfjs-dist", "build", "pdf.mjs"),
];
const requiredAsarFiles = [
  "/main.cjs",
  "/preload.cjs",
  "/storage-helpers.cjs",
  "/package.json",
];

for (const resourcePath of requiredResources) {
  if (!fs.existsSync(resourcePath)) {
    throw new Error(`Packaged smoke missing required resource: ${resourcePath}`);
  }
}
const appAsarFiles = new Set(asar.listPackage(appAsar));
const missingAsarFiles = requiredAsarFiles.filter((fileName) => !appAsarFiles.has(fileName));
if (missingAsarFiles.length) {
  throw new Error(`Packaged app.asar missing required desktop file(s): ${missingAsarFiles.join(", ")}`);
}

const { sanitizeData } = await import(pathToFileURL(path.join(resourcesDir, "backend", "domain", "model.js")).toString());
const {
  createBackupEnvelope,
  validateBackupEnvelope,
} = await import(pathToFileURL(path.join(resourcesDir, "backend", "domain", "backup.js")).toString());

const cleanData = sanitizeData({
  properties: [{ id: "property_smoke", name: "Packaged Smoke Home" }],
  projects: [{ id: "project_smoke", propertyId: "property_smoke", name: "Packaged Smoke Project" }],
  expenses: [{
    id: "expense_smoke",
    propertyId: "property_smoke",
    projectId: "project_smoke",
    date: "2026-06-02",
    vendor: "Packaged Smoke Vendor",
    description: "Package resource verification",
    amount: "25.50",
  }],
});
if (cleanData.properties.length !== 1 || cleanData.expenses.length !== 1) {
  throw new Error("Packaged domain model did not sanitize smoke data as expected.");
}

const backup = createBackupEnvelope(cleanData, [], [], "2026-06-02T00:00:00.000Z");
const restored = validateBackupEnvelope(backup);
if (restored.data.properties[0]?.name !== "Packaged Smoke Home") {
  throw new Error("Packaged backup helper did not validate a smoke backup.");
}

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "home-ledger-packaged-resource-smoke-"));
try {
  const recordsPath = path.join(tempRoot, "records.json");
  const documentsDir = path.join(tempRoot, "documents");
  const attachmentPath = path.join(documentsDir, "file_package_smoke.blob");
  fs.mkdirSync(documentsDir, { recursive: true, mode: 0o700 });
  fs.writeFileSync(recordsPath, `${JSON.stringify(cleanData, null, 2)}\n`, { mode: 0o600 });
  fs.writeFileSync(attachmentPath, "home ledger package smoke", { mode: 0o600 });

  const savedRecords = JSON.parse(fs.readFileSync(recordsPath, "utf8"));
  const savedAttachment = fs.readFileSync(attachmentPath, "utf8");
  if (savedRecords.expenses[0]?.vendor !== "Packaged Smoke Vendor") {
    throw new Error("Packaged smoke records write/read failed.");
  }
  if (savedAttachment !== "home ledger package smoke") {
    throw new Error("Packaged smoke attachment write/read failed.");
  }
} finally {
  fs.rmSync(tempRoot, { recursive: true, force: true });
}

console.log(`Home Ledger packaged resource smoke passed: ${appPath}`);
