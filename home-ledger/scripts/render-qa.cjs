const { app, BrowserWindow } = require("electron");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");

const outputDir = path.resolve(process.env.QA_OUTPUT_DIR || path.join(__dirname, "..", "release", "qa"));
const appUrl = process.env.QA_APP_URL || "http://127.0.0.1:3102";
const websiteUrl = process.env.QA_WEBSITE_URL || "http://127.0.0.1:3104";
const appTheme = ["light", "dark", "system"].includes(process.env.QA_APP_THEME) ? process.env.QA_APP_THEME : "";
const userDataDir = path.join(os.tmpdir(), `home-basis-tracker-render-qa-${process.pid}`);

app.setPath("userData", userDataDir);
app.commandLine.appendSwitch("disable-features", "LocalNetworkAccessChecks");
app.on("window-all-closed", (event) => {
  event.preventDefault();
});

const targets = [
  { name: "app-desktop", url: appUrl, width: 1440, height: 1000, expectedText: "Home Basis Tracker" },
  { name: "app-mobile", url: appUrl, width: 390, height: 844, expectedText: "Home Basis Tracker" },
  { name: "website-desktop", url: websiteUrl, width: 1440, height: 1000, expectedText: "Home Basis Tracker" },
  { name: "website-mobile", url: websiteUrl, width: 390, height: 844, expectedText: "Home Basis Tracker" },
].filter((target) => !appTheme || target.url === appUrl);

async function renderTarget(target) {
  const window = new BrowserWindow({
    width: target.width,
    height: target.height,
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
  const consoleErrors = [];
  const loadErrors = [];

  window.webContents.on("console-message", (_event, level, message) => {
    if (level >= 2) {
      consoleErrors.push(message);
    }
  });
  window.webContents.on("did-fail-load", (_event, errorCode, errorDescription, validatedURL) => {
    loadErrors.push(`${errorCode} ${errorDescription} ${validatedURL}`);
  });

  try {
    await loadUrlWithRetry(window, target.url);
    if (appTheme && target.url === appUrl) {
      await window.webContents.executeJavaScript(`localStorage.setItem("home-ledger:theme-preference", ${JSON.stringify(appTheme)})`, true);
      await loadUrlWithRetry(window, target.url);
    }
    await window.webContents.executeJavaScript("document.fonts?.ready || Promise.resolve()", true);
    await new Promise((resolve) => {
      setTimeout(resolve, 600);
    });

    const pageState = await window.webContents.executeJavaScript(`
      (() => {
        const bodyText = document.body?.innerText || "";
        return {
          title: document.title,
          h1: document.querySelector("h1")?.textContent.trim() || "",
          hasExpectedText: bodyText.includes(${JSON.stringify(target.expectedText)}),
          scrollWidth: document.documentElement.scrollWidth,
          clientWidth: document.documentElement.clientWidth,
          viewportWidth: window.innerWidth,
          viewportHeight: window.innerHeight,
        };
      })()
    `, true);

    const image = await window.webContents.capturePage();
    const screenshotPath = path.join(outputDir, `${target.name}${appTheme && target.url === appUrl ? `-${appTheme}` : ""}.png`);
    await fs.writeFile(screenshotPath, image.toPNG());

    return {
      ...target,
      ...pageState,
      screenshotPath,
      consoleErrors,
      loadErrors,
      hasHorizontalOverflow: pageState.scrollWidth > pageState.clientWidth + 2,
    };
  } finally {
    window.destroy();
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

async function main() {
  await fs.mkdir(outputDir, { recursive: true });
  const results = [];

  for (const target of targets) {
    results.push(await renderTarget(target));
  }

  const failures = results.flatMap((result) => {
    const issues = [];
    if (result.loadErrors.length) issues.push(`${result.name}: load errors: ${result.loadErrors.join("; ")}`);
    if (result.consoleErrors.length) issues.push(`${result.name}: console errors: ${result.consoleErrors.join("; ")}`);
    if (!result.hasExpectedText) issues.push(`${result.name}: expected text was not visible`);
    if (result.hasHorizontalOverflow) {
      issues.push(`${result.name}: horizontal overflow (${result.scrollWidth}px content in ${result.clientWidth}px viewport)`);
    }
    return issues;
  });

  for (const result of results) {
    console.log(`${result.name}: ${result.title} | h1="${result.h1}" | screenshot=${result.screenshotPath}`);
  }
  await fs.writeFile(path.join(outputDir, "report.json"), `${JSON.stringify({ results, failures }, null, 2)}\n`, "utf8");

  if (failures.length) {
    console.error(failures.join("\n"));
    process.exitCode = 1;
  }
}

app.whenReady()
  .then(main)
  .catch((error) => {
    console.error(error?.message || error);
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
