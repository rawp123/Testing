const LOCAL_OCR_MODES = new Set(["fake", "test"]);

export function getOcrReadiness(config = {}) {
  const appEnv = normalizeText(config.appEnv) || "local";
  const mode = normalizeText(config.ocrMode || "disabled").toLowerCase();

  if (mode === "disabled") {
    return {
      name: "ocr",
      status: "disabled",
      message: "OCR provider is disabled."
    };
  }

  if (LOCAL_OCR_MODES.has(mode)) {
    if (isProductionEnv(appEnv)) {
      return {
        name: "ocr",
        status: "not_ready",
        message: "Production OCR provider is not configured."
      };
    }

    return {
      name: "ocr",
      status: "local_only",
      message: "OCR is using local/test behavior."
    };
  }

  return {
    name: "ocr",
    status: "not_ready",
    message: "OCR provider mode is not supported."
  };
}

export function isOcrProductionReady(config = {}) {
  return getOcrReadiness(config).status === "ok";
}

function isProductionEnv(appEnv) {
  return normalizeText(appEnv).toLowerCase() === "production";
}

function normalizeText(value) {
  return String(value || "").trim();
}
