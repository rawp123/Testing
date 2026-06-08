const PRODUCTION_STORAGE_DRIVER = "s3";

export function getFileStorageReadiness(config = {}) {
  const appEnv = normalizeText(config.appEnv) || "local";
  const driver = normalizeText(config.fileStorageDriver || config.fileStorage?.driver || "local").toLowerCase();
  const storage = config.fileStorage || {};
  const missing = missingS3Fields(storage);

  if (driver === PRODUCTION_STORAGE_DRIVER && missing.length === 0) {
    return {
      name: "file_storage",
      status: "ok",
      message: "Object storage is configured for signed upload and download intents."
    };
  }

  if (driver === PRODUCTION_STORAGE_DRIVER) {
    return {
      name: "file_storage",
      status: "not_ready",
      message: "Object storage is selected but required production storage settings are incomplete."
    };
  }

  if (isProductionEnv(appEnv)) {
    return {
      name: "file_storage",
      status: "not_ready",
      message: "Production object storage is not configured."
    };
  }

  return {
    name: "file_storage",
    status: "local_only",
    message: "Object storage is using local/test metadata-only behavior."
  };
}

export function isFileStorageProductionReady(config = {}) {
  return getFileStorageReadiness(config).status === "ok";
}

function missingS3Fields(storage) {
  const requiredFields = [
    ["bucket", storage.bucket],
    ["region", storage.region],
    ["access_key_id", storage.accessKeyId],
    ["secret_access_key", storage.secretAccessKey]
  ];

  return requiredFields
    .filter(([, value]) => !normalizeText(value))
    .map(([field]) => field);
}

function isProductionEnv(appEnv) {
  return normalizeText(appEnv).toLowerCase() === "production";
}

function normalizeText(value) {
  return String(value || "").trim();
}
