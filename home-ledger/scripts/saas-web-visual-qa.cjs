const { app, BrowserWindow, nativeTheme } = require("electron");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");

const appUrl = process.env.QA_SAAS_WEB_URL || "http://127.0.0.1:5173";
const outputDir = path.resolve(process.env.QA_OUTPUT_DIR || path.join(__dirname, "..", "release", "saas-web-visual-qa"));
const userDataDir = path.join(os.tmpdir(), `home-ledger-saas-web-visual-qa-${process.pid}`);

const viewports = [
  { name: "mobile-390", width: 390, height: 900 },
  { name: "tablet-768", width: 768, height: 960 },
  { name: "desktop-1024", width: 1024, height: 960 },
  { name: "desktop-1440", width: 1440, height: 1000 },
];

const themes = ["light", "dark"];

const screens = [
  { name: "dashboard", title: "Your home records", action: "Dashboard" },
  { name: "properties", title: "Property records", action: "Property" },
  { name: "vendors", title: "Vendor records", action: "Vendors" },
  { name: "projects", title: "Project records", action: "Projects" },
  { name: "expenses", title: "Expense records", action: "Expenses" },
  { name: "documents", title: "Document records", action: "Documents" },
  { name: "follow-ups", title: "Follow-ups", action: "Follow-ups" },
  { name: "exports", title: "Export records", action: "Export" },
  { name: "settings", title: "Settings", action: "Settings" },
  { name: "import", title: "Import and migration", action: "Import and migration" },
  { name: "billing", title: "Billing and plan", action: "Billing and plan" },
];

const modalChecks = [
  { name: "modal-add-property", screenAction: "Property", buttonText: "Add property", title: "Add property" },
  { name: "modal-add-vendor", screenAction: "Vendors", buttonText: "Add vendor", title: "Add vendor" },
  { name: "modal-add-project", screenAction: "Projects", buttonText: "Add project", title: "Add project" },
  { name: "modal-add-expense", screenAction: "Expenses", buttonText: "Add expense", title: "Add expense" },
  { name: "modal-add-document", screenAction: "Documents", buttonText: "Add document", title: "Add document" },
];

const blockedPhrases = [
  "deductible",
  "irs-ready",
  "irs-approved",
  "tax-safe",
  "audit-proof",
  "tax-optimized",
  "legal-ready",
  "production sign-in active",
  "oauth connected",
  "sso enabled",
  "payment processed",
  "invoice paid",
  "stripe connected",
  "import completed",
  "production ocr connected",
  "production storage connected",
  "storage_key",
  "signed url",
  "download_url",
  "local absolute path",
  "raw ocr text",
  "provider internals",
  "raw auth headers",
  "database url",
  "billing provider internals",
  "review_later",
  "api-backed",
];

app.setPath("userData", userDataDir);
app.commandLine.appendSwitch("disable-features", "LocalNetworkAccessChecks");
app.on("window-all-closed", (event) => {
  event.preventDefault();
});

function createWindow(width, height) {
  return new BrowserWindow({
    width,
    height,
    useContentSize: true,
    show: false,
    backgroundColor: nativeTheme.shouldUseDarkColors ? "#141917" : "#f5f6f2",
    webPreferences: {
      allowRunningInsecureContent: false,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    },
  });
}

async function loadApp(window) {
  let lastError;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      await window.loadURL(appUrl);
      await waitForApp(window);
      return;
    } catch (error) {
      lastError = error;
      await delay(500);
    }
  }
  throw lastError;
}

async function waitForApp(window) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const ready = await window.webContents.executeJavaScript(`
      Boolean(document.querySelector("h1") && !document.body.innerText.includes("Loading"))
    `, true);
    if (ready) return;
    await delay(250);
  }
  throw new Error("Web app did not finish loading.");
}

async function clickButton(window, actionText, selector = "button") {
  await window.webContents.executeJavaScript(`
    (async () => {
      const normalize = (value) => (value || "").replace(/\\s+/g, " ").trim().toLowerCase();
      const target = normalize(${JSON.stringify(actionText)});
      const buttons = Array.from(document.querySelectorAll(${JSON.stringify(selector)}));
      const button = buttons.find((item) => normalize(item.textContent).includes(target));
      if (!button) throw new Error("Button target not found: " + ${JSON.stringify(actionText)});
      button.click();
      await new Promise((resolve) => setTimeout(resolve, 260));
      window.scrollTo(0, 0);
    })()
  `, true);
}

async function navigateTo(window, actionText) {
  await clickButton(window, actionText, ".app-tabs button, .settings-nav-button");
}

async function prepareScreen(window, screen) {
  if (screen.name === "import") {
    await navigateTo(window, "Settings");
    await clickButton(window, "Open import");
    return;
  }
  if (screen.name === "billing") {
    await navigateTo(window, "Settings");
    await clickButton(window, "Open billing");
    return;
  }
  await navigateTo(window, screen.action);
}

async function captureScreen(window, target) {
  await window.webContents.executeJavaScript("document.fonts?.ready || Promise.resolve()", true);
  await delay(220);
  const state = await collectState(window, target.expectedTitle);
  const image = await window.webContents.capturePage();
  const screenshotPath = path.join(outputDir, `${target.theme}-${target.viewport}-${target.name}.png`);
  await fs.writeFile(screenshotPath, image.toPNG());
  return { ...target, ...state, screenshotPath };
}

async function collectState(window, expectedTitle) {
  return window.webContents.executeJavaScript(`
    (() => {
      const text = document.body?.innerText || "";
      const lowerText = text.toLowerCase();
      const blockedPhrases = ${JSON.stringify(blockedPhrases)};
      const dialog = document.querySelector('[role="dialog"]');
      const rect = dialog?.getBoundingClientRect();
      return {
        title: document.querySelector("h1")?.textContent?.trim() || document.querySelector("h2")?.textContent?.trim() || "",
        hasExpectedTitle: text.includes(${JSON.stringify(expectedTitle)}),
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
        bodyScrollWidth: document.body?.scrollWidth || 0,
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
        horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 2,
        blockedPhrases: blockedPhrases.filter((phrase) => lowerText.includes(phrase)),
        activeNavCount: document.querySelectorAll('[aria-current="page"]').length,
        dialogVisible: Boolean(dialog),
        dialogBottomVisible: !rect || rect.bottom <= window.innerHeight + 2,
        dialogTopVisible: !rect || rect.top >= -2,
        actionButtons: Array.from(document.querySelectorAll("button")).filter((button) => button.offsetParent !== null).length,
      };
    })()
  `, true);
}

async function captureModalCheck(window, target) {
  await navigateTo(window, target.screenAction);
  await clickButton(window, target.buttonText);
  const state = await collectState(window, target.title);
  const image = await window.webContents.capturePage();
  const screenshotPath = path.join(outputDir, `${target.theme}-${target.viewport}-${target.name}.png`);
  await fs.writeFile(screenshotPath, image.toPNG());
  await window.webContents.executeJavaScript(`
    (async () => {
      document.querySelector('[aria-label="Close"]')?.click();
      await new Promise((resolve) => setTimeout(resolve, 120));
    })()
  `, true);
  return { ...target, ...state, screenshotPath };
}

function issuesForResult(result) {
  const issues = [];
  if (result.loadErrors?.length) issues.push(`load errors: ${result.loadErrors.join("; ")}`);
  if (result.consoleErrors?.length) issues.push(`console errors: ${result.consoleErrors.join("; ")}`);
  if (!result.hasExpectedTitle) issues.push(`expected title not found: ${result.expectedTitle || result.title}`);
  if (result.horizontalOverflow) issues.push(`horizontal overflow (${result.scrollWidth}px content in ${result.clientWidth}px viewport)`);
  if (result.blockedPhrases?.length) issues.push(`blocked/internal phrases visible: ${result.blockedPhrases.join(", ")}`);
  if (result.activeNavCount > 1) issues.push(`multiple active navigation items (${result.activeNavCount})`);
  if (result.name.startsWith("modal-") && !result.dialogVisible) issues.push("modal did not open");
  if (result.name.startsWith("modal-") && (!result.dialogTopVisible || !result.dialogBottomVisible)) issues.push("modal extends outside viewport");
  return issues;
}

async function runTarget(theme, viewport, screen) {
  nativeTheme.themeSource = theme;
  const window = createWindow(viewport.width, viewport.height);
  const consoleErrors = [];
  const loadErrors = [];

  window.webContents.on("console-message", (_event, level, message) => {
    if (level >= 3) consoleErrors.push(message);
  });
  window.webContents.on("did-fail-load", (_event, errorCode, errorDescription, validatedURL) => {
    loadErrors.push(`${errorCode} ${errorDescription} ${validatedURL}`);
  });

  try {
    await loadApp(window);
    await prepareScreen(window, screen);
    const result = await captureScreen(window, {
      name: screen.name,
      expectedTitle: screen.title,
      theme,
      viewport: viewport.name,
      width: viewport.width,
      height: viewport.height,
    });
    result.consoleErrors = consoleErrors;
    result.loadErrors = loadErrors;
    result.issues = issuesForResult(result);
    return result;
  } finally {
    window.destroy();
  }
}

async function runModalTarget(theme, viewport, modal) {
  nativeTheme.themeSource = theme;
  const window = createWindow(viewport.width, viewport.height);
  const consoleErrors = [];
  const loadErrors = [];

  window.webContents.on("console-message", (_event, level, message) => {
    if (level >= 3) consoleErrors.push(message);
  });
  window.webContents.on("did-fail-load", (_event, errorCode, errorDescription, validatedURL) => {
    loadErrors.push(`${errorCode} ${errorDescription} ${validatedURL}`);
  });

  try {
    await loadApp(window);
    const result = await captureModalCheck(window, {
      ...modal,
      expectedTitle: modal.title,
      theme,
      viewport: viewport.name,
      width: viewport.width,
      height: viewport.height,
    });
    result.consoleErrors = consoleErrors;
    result.loadErrors = loadErrors;
    result.issues = issuesForResult(result);
    return result;
  } finally {
    window.destroy();
  }
}

function formatReport(results, modalResults, failures) {
  const lines = [
    "# Web App Visual QA",
    "",
    `Date: ${new Date().toISOString()}`,
    `App URL: ${appUrl}`,
    `Output: ${outputDir}`,
    "",
    "## Viewports",
    "",
    ...viewports.map((viewport) => `- ${viewport.name}: ${viewport.width}x${viewport.height}`),
    "",
    "## Screens",
    "",
    "| Theme | Viewport | Screen | Horizontal overflow | Active nav | Blocked/internal language | Screenshot |",
    "| --- | --- | --- | --- | --- | --- | --- |",
    ...results.map((result) => `| ${result.theme} | ${result.viewport} | ${result.name} | ${result.horizontalOverflow ? "Fail" : "Pass"} | ${result.activeNavCount <= 1 ? "Pass" : "Fail"} | ${result.blockedPhrases.length ? result.blockedPhrases.join(", ") : "Pass"} | ${path.basename(result.screenshotPath)} |`),
    "",
    "## Modal Checks",
    "",
    "| Theme | Viewport | Modal | Opened | Fits viewport | Screenshot |",
    "| --- | --- | --- | --- | --- | --- |",
    ...modalResults.map((result) => `| ${result.theme} | ${result.viewport} | ${result.name} | ${result.dialogVisible ? "Pass" : "Fail"} | ${result.dialogTopVisible && result.dialogBottomVisible ? "Pass" : "Fail"} | ${path.basename(result.screenshotPath)} |`),
    "",
    "## Findings",
    "",
    ...(failures.length ? failures.map((failure) => `- ${failure}`) : ["- No automated visual QA failures detected."]),
    "",
    "## Manual Review Notes",
    "",
    "- Screenshots should still be spot-checked by a reviewer for visual polish, density, contrast nuance, and copy tone.",
    "- The script checks page-level horizontal overflow, active navigation state, modal viewport fit, obvious console/load failures, and blocked product/internal phrases.",
  ];
  return `${lines.join("\n")}\n`;
}

async function main() {
  await fs.mkdir(outputDir, { recursive: true });

  const results = [];
  for (const theme of themes) {
    for (const viewport of viewports) {
      for (const screen of screens) {
        const result = await runTarget(theme, viewport, screen);
        results.push(result);
        console.log(`${theme}/${viewport.name}/${screen.name}: ${result.issues.length ? result.issues.join("; ") : "ok"} | ${result.screenshotPath}`);
      }
    }
  }

  const modalResults = [];
  for (const theme of themes) {
    for (const viewport of [viewports[0], viewports[3]]) {
      for (const modal of modalChecks) {
        const result = await runModalTarget(theme, viewport, modal);
        modalResults.push(result);
        console.log(`${theme}/${viewport.name}/${modal.name}: ${result.issues.length ? result.issues.join("; ") : "ok"} | ${result.screenshotPath}`);
      }
    }
  }

  const failures = [...results, ...modalResults].flatMap((result) =>
    result.issues.map((issue) => `${result.theme}/${result.viewport}/${result.name}: ${issue}`)
  );
  const report = { appUrl, outputDir, generatedAt: new Date().toISOString(), viewports, themes, results, modalResults, failures };
  await fs.writeFile(path.join(outputDir, "report.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
  await fs.writeFile(path.join(outputDir, "README.md"), formatReport(results, modalResults, failures), "utf8");

  if (failures.length) {
    console.error(failures.join("\n"));
    process.exitCode = 1;
  }
}

function delay(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

app.whenReady()
  .then(main)
  .catch((error) => {
    console.error(error?.message || error);
    process.exitCode = 1;
  })
  .finally(async () => {
    nativeTheme.themeSource = "system";
    try {
      await fs.rm(userDataDir, { recursive: true, force: true });
    } catch {
      // Cleanup should not hide the QA result.
    }
    app.exit(process.exitCode || 0);
  });
