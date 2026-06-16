export class ConfigError extends Error {
  constructor(issues) {
    super(`Invalid API configuration: ${issues.map((issue) => issue.key).join(", ")}`);
    this.name = "ConfigError";
    this.issues = issues;
  }
}

export function loadConfig(env = process.env) {
  const appEnv = normalizeText(env.APP_ENV) || defaultAppEnv(env.NODE_ENV);
  const nodeEnv = normalizeText(env.NODE_ENV) || "development";
  const issues = [];

  const port = parseInteger(env.PORT, 4000);
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    issues.push({ key: "PORT", message: "PORT must be a valid TCP port." });
  }

  const databaseUrl = normalizeText(env.DATABASE_URL);
  if (!databaseUrl) {
    issues.push({ key: "DATABASE_URL", message: "DATABASE_URL is required for the API runtime." });
  }

  const authProvider = normalizeText(env.AUTH_PROVIDER) || (isLocalLikeEnv(appEnv) ? "dev" : "none");
  const devAuthEnabled = parseBoolean(
    env.DEV_AUTH_ENABLED,
    isLocalLikeEnv(appEnv) ? true : false
  );

  if (appEnv === "production" && devAuthEnabled) {
    issues.push({
      key: "DEV_AUTH_ENABLED",
      message: "DEV_AUTH_ENABLED must be false in production."
    });
  }

  const devAuthEmail = normalizeEmail(env.DEV_AUTH_EMAIL || "dev@example.test");
  const devAuthDisplayName = normalizeText(env.DEV_AUTH_DISPLAY_NAME) || "Local Developer";
  if (authProvider === "dev" && devAuthEnabled && !devAuthEmail) {
    issues.push({ key: "DEV_AUTH_EMAIL", message: "DEV_AUTH_EMAIL must be a valid email." });
  }

  const dbPoolMax = parseInteger(env.DB_POOL_MAX, 10);
  if (!Number.isInteger(dbPoolMax) || dbPoolMax < 1 || dbPoolMax > 100) {
    issues.push({ key: "DB_POOL_MAX", message: "DB_POOL_MAX must be between 1 and 100." });
  }

  const fileStorage = loadFileStorageConfig(env, issues);
  const ocrMode = (normalizeText(env.OCR_MODE) || "disabled").toLowerCase();
  if (!["disabled", "fake", "test", "local_pdf"].includes(ocrMode)) {
    issues.push({ key: "OCR_MODE", message: "OCR_MODE must be disabled, fake, test, or local_pdf." });
  }

  if (issues.length > 0) {
    throw new ConfigError(issues);
  }

  return Object.freeze({
    appEnv,
    nodeEnv,
    port,
    databaseUrl,
    testDatabaseUrl: normalizeText(env.TEST_DATABASE_URL),
    authProvider,
    devAuthEnabled,
    devAuthEmail,
    devAuthDisplayName,
    sessionCookieName: normalizeText(env.SESSION_COOKIE_NAME) || "home_ledger_session",
    fileStorageDriver: fileStorage.driver,
    fileStorage,
    billingProvider: normalizeText(env.BILLING_PROVIDER) || "none",
    ocrMode,
    analyticsEnabled: parseBoolean(env.ANALYTICS_ENABLED, false),
    dbPoolMax,
    requestIdHeader: normalizeText(env.REQUEST_ID_HEADER) || "x-request-id"
  });
}

export function formatConfigError(error) {
  if (!(error instanceof ConfigError)) {
    return "API configuration failed.";
  }

  const details = error.issues.map((issue) => `${issue.key}: ${issue.message}`).join(" ");
  return `API configuration failed. ${details}`;
}

export function redactSecret(value) {
  const text = String(value || "");
  if (!text) {
    return "";
  }

  try {
    const parsed = new URL(text);
    if (parsed.username) {
      parsed.username = "[redacted]";
    }
    if (parsed.password) {
      parsed.password = "[redacted]";
    }
    parsed.search = "";
    return parsed.toString();
  } catch {
    if (text.length <= 8) {
      return "[redacted]";
    }
    return `${text.slice(0, 3)}...[redacted]`;
  }
}

export function normalizeEmail(value) {
  const email = normalizeText(value).toLowerCase();
  if (!email || !email.includes("@")) {
    return "";
  }
  return email;
}

function normalizeText(value) {
  return String(value || "").trim();
}

function parseInteger(value, fallback) {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }
  return Number.parseInt(String(value), 10);
}

function parseBoolean(value, fallback) {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }

  const normalized = String(value).trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) {
    return true;
  }
  if (["0", "false", "no", "off"].includes(normalized)) {
    return false;
  }
  return fallback;
}

function loadFileStorageConfig(env, issues) {
  const driver = (normalizeText(env.FILE_STORAGE_DRIVER) || "local").toLowerCase();
  if (!["local", "test", "s3"].includes(driver)) {
    issues.push({ key: "FILE_STORAGE_DRIVER", message: "FILE_STORAGE_DRIVER must be local, test, or s3." });
  }

  const uploadUrlTtlSeconds = parseInteger(env.FILE_STORAGE_UPLOAD_URL_TTL_SECONDS, 600);
  if (!Number.isInteger(uploadUrlTtlSeconds) || uploadUrlTtlSeconds < 1 || uploadUrlTtlSeconds > 3600) {
    issues.push({
      key: "FILE_STORAGE_UPLOAD_URL_TTL_SECONDS",
      message: "FILE_STORAGE_UPLOAD_URL_TTL_SECONDS must be between 1 and 3600."
    });
  }

  const downloadUrlTtlSeconds = parseInteger(env.FILE_STORAGE_DOWNLOAD_URL_TTL_SECONDS, 300);
  if (!Number.isInteger(downloadUrlTtlSeconds) || downloadUrlTtlSeconds < 1 || downloadUrlTtlSeconds > 3600) {
    issues.push({
      key: "FILE_STORAGE_DOWNLOAD_URL_TTL_SECONDS",
      message: "FILE_STORAGE_DOWNLOAD_URL_TTL_SECONDS must be between 1 and 3600."
    });
  }

  const endpoint = normalizeText(env.FILE_STORAGE_ENDPOINT);
  if (endpoint) {
    try {
      const parsed = new URL(endpoint);
      if (!["http:", "https:"].includes(parsed.protocol)) {
        issues.push({ key: "FILE_STORAGE_ENDPOINT", message: "FILE_STORAGE_ENDPOINT must be an http or https URL." });
      }
    } catch {
      issues.push({ key: "FILE_STORAGE_ENDPOINT", message: "FILE_STORAGE_ENDPOINT must be a valid URL." });
    }
  }

  const bucket = normalizeText(env.FILE_STORAGE_BUCKET);
  const region = normalizeText(env.FILE_STORAGE_REGION);
  const accessKeyId = normalizeText(env.FILE_STORAGE_ACCESS_KEY_ID);
  const secretAccessKey = String(env.FILE_STORAGE_SECRET_ACCESS_KEY || "");

  if (driver === "s3") {
    if (!bucket) issues.push({ key: "FILE_STORAGE_BUCKET", message: "FILE_STORAGE_BUCKET is required for S3 storage." });
    if (!region) issues.push({ key: "FILE_STORAGE_REGION", message: "FILE_STORAGE_REGION is required for S3 storage." });
    if (!accessKeyId) issues.push({ key: "FILE_STORAGE_ACCESS_KEY_ID", message: "FILE_STORAGE_ACCESS_KEY_ID is required for S3 storage." });
    if (!secretAccessKey) issues.push({ key: "FILE_STORAGE_SECRET_ACCESS_KEY", message: "FILE_STORAGE_SECRET_ACCESS_KEY is required for S3 storage." });
  }

  return Object.freeze({
    driver,
    bucket,
    region,
    endpoint,
    accessKeyId,
    secretAccessKey,
    forcePathStyle: parseBoolean(env.FILE_STORAGE_FORCE_PATH_STYLE, false),
    uploadUrlTtlSeconds,
    downloadUrlTtlSeconds
  });
}

function isLocalLikeEnv(appEnv) {
  return appEnv === "local" || appEnv === "test";
}

function defaultAppEnv(nodeEnv) {
  if (nodeEnv === "test") {
    return "test";
  }
  if (nodeEnv === "production") {
    return "production";
  }
  return "local";
}
