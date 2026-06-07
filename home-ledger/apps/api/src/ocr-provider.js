export function createOcrProvider({ mode = "disabled" } = {}) {
  const normalizedMode = String(mode || "disabled").trim().toLowerCase();
  if (normalizedMode === "fake" || normalizedMode === "test") {
    return createFakeOcrProvider();
  }
  return createDisabledOcrProvider();
}

export function createFakeOcrProvider() {
  return {
    mode: "fake",
    async requestText({ file }) {
      return {
        status: "succeeded",
        text: `Extracted text from ${file.original_file_name}.`,
        engine: "fake",
        errorCode: null,
        errorMessage: null
      };
    }
  };
}

export function createDisabledOcrProvider() {
  return {
    mode: "disabled",
    async requestText() {
      return {
        status: "queued",
        text: null,
        engine: null,
        errorCode: null,
        errorMessage: null
      };
    }
  };
}
