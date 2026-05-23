const { app, BrowserWindow, dialog } = require("electron");
const { spawn } = require("node:child_process");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const { fileURLToPath, pathToFileURL } = require("node:url");

const DEV_SERVER_URL = process.env.ELECTRON_START_URL || "";
const FRONTEND_DIST_INDEX = path.resolve(__dirname, "../frontend/dist/index.html");
const PROJECT_DIR = path.resolve(__dirname, "..");
const BACKEND_DIR = path.resolve(PROJECT_DIR, "backend");
const BACKEND_HOST = "127.0.0.1";
const BACKEND_PORT = 8000;
const BACKEND_HEALTH_URL = `http://${BACKEND_HOST}:${BACKEND_PORT}/health`;
const BACKEND_READY_TIMEOUT_MS = 20000;
const BACKEND_POLL_INTERVAL_MS = 350;
const UVICORN_BIN = path.resolve(BACKEND_DIR, ".venv/bin/uvicorn");
const DESKTOP_DATA_DIR_NAME = "Message Archive Utility";
const ALLOWED_DEV_ORIGINS = new Set([
  "http://127.0.0.1:5173",
  "http://localhost:5173",
]);

let backendProcess = null;

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

function requestBackendHealth() {
  return new Promise((resolve) => {
    const request = http.get(BACKEND_HEALTH_URL, { timeout: 1200 }, (response) => {
      response.resume();
      response.on("end", () => {
        resolve({ ok: response.statusCode === 200, statusCode: response.statusCode });
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
    console.log("Using existing local backend at http://127.0.0.1:8000.");
    return;
  }

  if (initialHealth.statusCode) {
    throw new Error(
      `Port 8000 is responding, but it is not the Message Archive backend. Health status: ${initialHealth.statusCode}.`,
    );
  }

  if (initialHealth.error && initialHealth.error.code !== "ECONNREFUSED") {
    throw new Error(`Could not check local backend health: ${initialHealth.error.message}`);
  }

  startBackendProcess();
  await waitForBackendHealth();
  console.log("Started local backend at http://127.0.0.1:8000.");
}

function startBackendProcess() {
  if (!fs.existsSync(UVICORN_BIN)) {
    throw new Error(
      "The backend virtual environment is missing Uvicorn. Run the normal web dev setup once before starting desktop mode.",
    );
  }

  const desktopDataDir = getDesktopDataDir();
  const env = {
    ...process.env,
    MESSAGE_ARCHIVE_DATA_DIR: process.env.MESSAGE_ARCHIVE_DATA_DIR || desktopDataDir,
    MESSAGE_ARCHIVE_DB_PATH:
      process.env.MESSAGE_ARCHIVE_DB_PATH || path.join(desktopDataDir, "message-archive.sqlite3"),
  };

  backendProcess = spawn(
    UVICORN_BIN,
    [
      "app.main:app",
      "--reload",
      "--host",
      BACKEND_HOST,
      "--port",
      String(BACKEND_PORT),
      "--no-access-log",
    ],
    {
      cwd: BACKEND_DIR,
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

function getDesktopDataDir() {
  return path.join(app.getPath("appData"), DESKTOP_DATA_DIR_NAME);
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
      "Message Archive backend unavailable",
      `${error.message}\n\nClose the process using port 8000, or start the FastAPI backend manually and try again.`,
    );
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

app.on("before-quit", () => {
  stopBackendProcess();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
