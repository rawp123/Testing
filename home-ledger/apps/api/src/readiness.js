export async function getReadinessSnapshot({ config, db } = {}) {
  const checks = [];

  checks.push(configReadinessCheck(config));
  checks.push(await databaseReadinessCheck(db));
  checks.push(fileStorageReadinessCheck(config));
  checks.push(ocrReadinessCheck(config));
  checks.push(authReadinessCheck(config));
  checks.push(billingReadinessCheck(config));

  const status = checks.every((check) => check.status === "ok" || check.status === "disabled")
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
  const driver = config?.fileStorageDriver || config?.fileStorage?.driver || "local";
  if (driver === "s3") {
    return {
      name: "file_storage",
      status: "ok",
      message: "Object storage is configured for signed upload and download intents."
    };
  }

  return {
    name: "file_storage",
    status: "degraded",
    message: "Object storage is using local/test behavior; production storage is not connected."
  };
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

  return {
    name: "auth",
    status: "degraded",
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
