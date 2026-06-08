import { getFileStorageReadiness } from "./storage-readiness.js";

export async function getReadinessSnapshot({ config, db } = {}) {
  const checks = [];

  checks.push(configReadinessCheck(config));
  checks.push(await databaseReadinessCheck(db));
  checks.push(fileStorageReadinessCheck(config));
  checks.push(ocrReadinessCheck(config));
  checks.push(authReadinessCheck(config));
  checks.push(billingReadinessCheck(config));

  const status = checks.every(isAcceptableReadinessStatus)
    ? "ready"
    : "not_ready";

  return {
    status,
    checks
  };
}

export function serializeReadinessSnapshot(snapshot) {
  return {
    status: snapshot.status,
    checks: snapshot.checks.map((check) => ({
      name: check.name,
      status: check.status,
      message: check.message
    }))
  };
}

function configReadinessCheck(config) {
  if (!config?.databaseUrl) {
    return {
      name: "config",
      status: "not_ready",
      message: "Required runtime configuration is incomplete."
    };
  }

  return {
    name: "config",
    status: "ok",
    message: "Required runtime configuration is present."
  };
}

async function databaseReadinessCheck(db) {
  try {
    if (!db || typeof db.query !== "function") {
      return {
        name: "database",
        status: "not_ready",
        message: "Database client is not configured."
      };
    }

    await db.query("SELECT 1");
    return {
      name: "database",
      status: "ok",
      message: "Database connection is ready."
    };
  } catch {
    return {
      name: "database",
      status: "not_ready",
      message: "Database connection check failed."
    };
  }
}

function fileStorageReadinessCheck(config) {
  return getFileStorageReadiness(config);
}

function ocrReadinessCheck(config) {
  if (config?.ocrMode === "disabled") {
    return {
      name: "ocr",
      status: "disabled",
      message: "OCR provider is disabled."
    };
  }

  return {
    name: "ocr",
    status: "ok",
    message: "OCR lifecycle provider is configured."
  };
}

function authReadinessCheck(config) {
  if (config?.authProvider && config.authProvider !== "none" && config.authProvider !== "dev") {
    return {
      name: "auth",
      status: "ok",
      message: "Auth provider is configured."
    };
  }

  if (isLocalLikeEnv(config?.appEnv)) {
    return {
      name: "auth",
      status: "local_only",
      message: "Auth is using local/test behavior."
    };
  }

  return {
    name: "auth",
    status: "not_ready",
    message: "Production auth provider is not connected."
  };
}

function billingReadinessCheck(config) {
  if (config?.billingProvider && config.billingProvider !== "none") {
    return {
      name: "billing",
      status: "ok",
      message: "Billing provider is configured."
    };
  }

  return {
    name: "billing",
    status: "disabled",
    message: "Billing provider is not connected."
  };
}

function isAcceptableReadinessStatus(check) {
  return check.status === "ok" || check.status === "disabled" || check.status === "local_only";
}

function isLocalLikeEnv(appEnv) {
  return appEnv === "local" || appEnv === "test";
}
