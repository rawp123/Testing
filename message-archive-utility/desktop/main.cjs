const { app, BrowserWindow, dialog, session } = require("electron");
const { spawn } = require("node:child_process");
const crypto = require("node:crypto");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const { fileURLToPath, pathToFileURL } = require("node:url");

const DEV_SERVER_URL = process.env.ELECTRON_START_URL || "";
const IS_PACKAGED = app.isPackaged;
const FRONTEND_DIST_INDEX = IS_PACKAGED
  ? path.join(process.resourcesPath, "frontend", "dist", "index.html")
  : path.resolve(__dirname, "../frontend/dist/index.html");
const PROJECT_DIR = path.resolve(__dirname, "..");
const BACKEND_DIR = path.resolve(PROJECT_DIR, "backend");
const BACKEND_VENV_DIR = process.env.MESSAGE_ARCHIVE_BACKEND_VENV_DIR || path.resolve(PROJECT_DIR, ".venv");
const BACKEND_HOST = "127.0.0.1";
const BACKEND_PORT = Number(process.env.MESSAGE_ARCHIVE_DESKTOP_BACKEND_PORT || 8765);
const BACKEND_ORIGIN = `http://${BACKEND_HOST}:${BACKEND_PORT}`;
const BACKEND_HEALTH_URL = `${BACKEND_ORIGIN}/health`;
const BACKEND_READY_TIMEOUT_MS = 20000;
const BACKEND_POLL_INTERVAL_MS = 350;
const UVICORN_BIN = path.resolve(BACKEND_VENV_DIR, "bin/uvicorn");
const PACKAGED_BACKEND_EXECUTABLE = path.join(process.resourcesPath, "backend", "message-archive-backend");
const PRELOAD_SCRIPT = path.join(__dirname, "preload.cjs");
const DESKTOP_DATA_DIR_NAME = "Message Archive Utility";
const USE_BACKEND_RELOAD = process.env.MESSAGE_ARCHIVE_BACKEND_RELOAD === "1";
const API_TOKEN_HEADER = "X-Message-Archive-Token";
const ALLOWED_DEV_ORIGINS = new Set([
  "http://127.0.0.1:5173",
  "http://localhost:5173",
]);
const ALLOWED_EXPORT_DOWNLOADS = new Map([
  [".csv", new Set(["", "text/csv", "application/csv", "application/octet-stream"])],
  [".pdf", new Set(["", "application/pdf", "application/octet-stream"])],
  [
    ".xlsx",
    new Set([
      "",
      "application/octet-stream",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ]),
  ],
]);

let backendProcess = null;
let apiToken = "";
let downloadGuardInstalled = false;

function getStartTarget() {
  if (DEV_SERVER_URL) {
    return DEV_SERVER_URL;
  }

  return pathToFileURL(FRONTEND_DIST_INDEX).toString();
}

function isAllowedNavigation(targetUrl) {
  let parsedUrl;
  try {
    parsedUrl = new URL(targetUrl);
  } catch {
    return false;
  }

  if (parsedUrl.protocol === "file:") {
    return fileURLToPath(parsedUrl) === FRONTEND_DIST_INDEX;
  }

  return ALLOWED_DEV_ORIGINS.has(parsedUrl.origin);
}

function createWindow() {
  const window = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 960,
    minHeight: 680,
    title: "Message Archive Utility",
    backgroundColor: "#f4f0e8",
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
      preload: PRELOAD_SCRIPT,
    },
  });

  window.webContents.setWindowOpenHandler(({ url }) => {
    return { action: "deny" };
  });

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

  window.webContents.on("did-fail-load", (_event, _errorCode, errorDescription) => {
    if (DEV_SERVER_URL) {
      console.error(`Desktop UI failed to load: ${errorDescription}`);
    }
  });

  window.loadURL(getStartTarget());
}

function setupDownloadGuard() {
  if (downloadGuardInstalled) return;
  downloadGuardInstalled = true;

  session.defaultSession.on("will-download", (event, item, webContents) => {
    if (!isAllowedExportDownload(item, webContents)) {
      event.preventDefault();
      item.cancel();
    }
  });
}

function isAllowedExportDownload(item, webContents) {
  if (!webContents || !isAllowedNavigation(webContents.getURL())) return false;

  const filename = item.getFilename();
  if (!isSafeExportFilename(filename)) return false;

  const extension = path.extname(filename).toLowerCase();
  const allowedMimeTypes = ALLOWED_EXPORT_DOWNLOADS.get(extension);
  if (!allowedMimeTypes) return false;

  const mimeType = (item.getMimeType() || "").toLowerCase().split(";")[0].trim();
  return allowedMimeTypes.has(mimeType);
}

function isSafeExportFilename(filename) {
  if (!filename || filename !== path.basename(filename)) return false;
  if (/[\0-\x1f\x7f/\\:]/.test(filename)) return false;
  return ALLOWED_EXPORT_DOWNLOADS.has(path.extname(filename).toLowerCase());
}

function requestBackendHealth() {
  return new Promise((resolve) => {
    const request = http.get(BACKEND_HEALTH_URL, { timeout: 1200 }, (response) => {
      let bodyText = "";
      response.setEncoding("utf8");
      response.on("data", (chunk) => {
        bodyText += chunk;
      });
      response.on("end", () => {
        let body = null;
        try {
          body = bodyText ? JSON.parse(bodyText) : null;
        } catch {
          body = null;
        }
        resolve({ ok: response.statusCode === 200, statusCode: response.statusCode, body });
      });
    });

    request.on("timeout", () => {
      request.destroy(new Error("Backend health check timed out."));
    });

    request.on("error", (error) => {
      resolve({ ok: false, error });
    });
  });
}

function requestBackendTokenCheck() {
  return new Promise((resolve) => {
    const request = http.get(
      `${BACKEND_ORIGIN}/archive/stats`,
      {
        timeout: 1200,
        headers: {
          [API_TOKEN_HEADER]: getApiToken(),
        },
      },
      (response) => {
        response.resume();
        response.on("end", () => {
          resolve({ ok: response.statusCode === 200, statusCode: response.statusCode });
        });
      },
    );

    request.on("timeout", () => {
      request.destroy(new Error("Backend token check timed out."));
    });

    request.on("error", (error) => {
      resolve({ ok: false, error });
    });
  });
}

async function waitForBackendHealth() {
  const startedAt = Date.now();

  while (Date.now() - startedAt < BACKEND_READY_TIMEOUT_MS) {
    const health = await requestBackendHealth();
    if (health.ok) {
      return;
    }
    await delay(BACKEND_POLL_INTERVAL_MS);
  }

  throw new Error("The local backend did not become ready within 20 seconds.");
}

async function ensureBackendReady() {
  const initialHealth = await requestBackendHealth();
  if (initialHealth.ok) {
    if (!initialHealth.body?.desktop_mode) {
      throw new Error(
        `Port ${BACKEND_PORT} is responding, but it is not running in Message Archive desktop mode.`,
      );
    }
    if (!initialHealth.body?.auth_required) {
      throw new Error(
        `Port ${BACKEND_PORT} is running an older Message Archive local service. Close the other app window and try again.`,
      );
    }
    const tokenCheck = await requestBackendTokenCheck();
    if (!tokenCheck.ok) {
      throw new Error(
        `Port ${BACKEND_PORT} is already running a different Message Archive local service. Close the other app window and try again.`,
      );
    }
    console.log(`Using existing local desktop backend at http://${BACKEND_HOST}:${BACKEND_PORT}.`);
    return;
  }

  if (initialHealth.statusCode) {
    throw new Error(
      `Port ${BACKEND_PORT} is responding, but it is not the Message Archive backend. Health status: ${initialHealth.statusCode}.`,
    );
  }

  if (initialHealth.error && initialHealth.error.code !== "ECONNREFUSED") {
    throw new Error(`Could not check local backend health: ${initialHealth.error.message}`);
  }

  startBackendProcess();
  await waitForBackendHealth();
  console.log(`Started local desktop backend at http://${BACKEND_HOST}:${BACKEND_PORT}.`);
}

function startBackendProcess() {
  const backendExecutable = getBackendExecutable();
  if (!fs.existsSync(backendExecutable)) {
    throw new Error(
      IS_PACKAGED
        ? "Message Archive could not find its local message service. Please reinstall the app and try again."
        : [
            `The backend virtual environment is missing Uvicorn at ${UVICORN_BIN}.`,
            "",
            "Run these setup commands from the message-archive-utility folder:",
            "",
            "python3 -m venv .venv",
            ".venv/bin/python -m pip install -r backend/requirements.txt",
          ].join("\n"),
    );
  }

  const desktopDataDir = getDesktopDataDir();
  const env = {
    ...process.env,
    MESSAGE_ARCHIVE_DATA_DIR: process.env.MESSAGE_ARCHIVE_DATA_DIR || desktopDataDir,
    MESSAGE_ARCHIVE_DESKTOP_MODE: "1",
    MESSAGE_ARCHIVE_API_TOKEN: getApiToken(),
    MESSAGE_ARCHIVE_API_BASE_URL: BACKEND_ORIGIN,
    MESSAGE_ARCHIVE_DB_PATH:
      process.env.MESSAGE_ARCHIVE_DB_PATH || path.join(desktopDataDir, "message-archive.sqlite3"),
  };
  const backendArgs = getBackendArgs();
  const backendCwd = getBackendCwd(backendExecutable);

  backendProcess = spawn(
    backendExecutable,
    backendArgs,
    {
      cwd: backendCwd,
      env,
      stdio: ["ignore", "pipe", "pipe"],
    },
  );

  backendProcess.stdout.on("data", (chunk) => {
    logBackendLine(chunk);
  });

  backendProcess.stderr.on("data", (chunk) => {
    logBackendLine(chunk);
  });

  backendProcess.on("exit", (code, signal) => {
    if (backendProcess) {
      console.log(`Local backend exited with code ${code ?? "none"} and signal ${signal ?? "none"}.`);
    }
    backendProcess = null;
  });

  backendProcess.on("error", (error) => {
    console.error(`Could not start local backend: ${error.message}`);
    backendProcess = null;
  });
}

function getBackendExecutable() {
  if (process.env.MESSAGE_ARCHIVE_BACKEND_EXECUTABLE) {
    return process.env.MESSAGE_ARCHIVE_BACKEND_EXECUTABLE;
  }
  return IS_PACKAGED ? PACKAGED_BACKEND_EXECUTABLE : UVICORN_BIN;
}

function getBackendArgs() {
  if (IS_PACKAGED || process.env.MESSAGE_ARCHIVE_BACKEND_EXECUTABLE) {
    return ["--host", BACKEND_HOST, "--port", String(BACKEND_PORT)];
  }
  return [
    "server.main:app",
    "--host",
    BACKEND_HOST,
    "--port",
    String(BACKEND_PORT),
    "--no-access-log",
    ...(USE_BACKEND_RELOAD ? ["--reload"] : []),
  ];
}

function getBackendCwd(backendExecutable) {
  return IS_PACKAGED || process.env.MESSAGE_ARCHIVE_BACKEND_EXECUTABLE
    ? path.dirname(backendExecutable)
    : BACKEND_DIR;
}

function getDesktopDataDir() {
  return path.join(app.getPath("appData"), DESKTOP_DATA_DIR_NAME);
}

function getApiToken() {
  if (!apiToken) {
    apiToken = process.env.MESSAGE_ARCHIVE_API_TOKEN || crypto.randomBytes(32).toString("hex");
    process.env.MESSAGE_ARCHIVE_API_TOKEN = apiToken;
    process.env.MESSAGE_ARCHIVE_API_BASE_URL = BACKEND_ORIGIN;
  }
  return apiToken;
}

function logBackendLine(chunk) {
  String(chunk)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .forEach((line) => {
      console.log(`[backend] ${line}`);
    });
}

function stopBackendProcess() {
  if (!backendProcess) {
    return;
  }

  const processToStop = backendProcess;
  backendProcess = null;
  processToStop.kill("SIGTERM");
}

function delay(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

app.whenReady().then(async () => {
  app.on("web-contents-created", (_event, contents) => {
    contents.setWindowOpenHandler(() => {
      return { action: "deny" };
    });
  });

  try {
    await ensureBackendReady();
  } catch (error) {
    dialog.showErrorBox(
      "Message Archive could not open",
      getStartupErrorMessage(error),
    );
    app.quit();
    return;
  }

  setupDownloadGuard();
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("before-quit", () => {
  stopBackendProcess();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

function getStartupErrorMessage(error) {
  if (IS_PACKAGED) {
    return [
      "Message Archive could not start its local message service.",
      "",
      "Your message archive is still stored on this computer. Please reopen the app, or reinstall it if this keeps happening.",
    ].join("\n");
  }

  return `${error.message}\n\nClose the process using port ${BACKEND_PORT}, or start the local backend in desktop mode and try again.`;
}
