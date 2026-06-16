export function createOcrProvider({ mode = "disabled" } = {}) {
  const normalizedMode = String(mode || "disabled").trim().toLowerCase();
  if (normalizedMode === "fake" || normalizedMode === "test") {
    return createFakeOcrProvider();
  }
  if (normalizedMode === "local_pdf") {
    return createLocalPdfOcrProvider();
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

export function createLocalPdfOcrProvider({
  maxTextLength = 100_000,
  maxPages = 50
} = {}) {
  return {
    mode: "local_pdf",
    async requestText({ file } = {}) {
      if (normalizeMimeType(file?.mime_type) !== "application/pdf") {
        return skippedOcrResult("unsupported_file_type");
      }

      const bytes = await resolveFileBytes(file);
      if (!bytes) {
        return skippedOcrResult("file_bytes_unavailable");
      }

      try {
        const text = await extractPdfEmbeddedText(bytes, { maxPages, maxTextLength });
        return {
          status: "succeeded",
          text,
          engine: "local_pdf",
          errorCode: null,
          errorMessage: null
        };
      } catch {
        return {
          status: "failed",
          text: null,
          engine: "local_pdf",
          errorCode: "pdf_text_extraction_failed",
          errorMessage: "Document text could not be read."
        };
      }
    }
  };
}

export async function extractPdfEmbeddedText(bytes, { maxPages = 50, maxTextLength = 100_000 } = {}) {
  const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const loadingTask = pdfjsLib.getDocument({
    data: toUint8Array(bytes),
    disableWorker: true,
    useSystemFonts: true,
    verbosity: pdfjsLib.VerbosityLevel?.ERRORS ?? 0
  });
  const document = await loadingTask.promise;
  try {
    const pageLimit = Math.min(document.numPages, Math.max(1, Number(maxPages) || 1));
    const chunks = [];

    for (let pageNumber = 1; pageNumber <= pageLimit; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      const content = await page.getTextContent();
      const pageText = normalizeExtractedText(
        content.items
          .map((item) => item.str || "")
          .join(" ")
      );
      if (pageText) {
        chunks.push(pageText);
      }
      if (chunks.join("\n\n").length >= maxTextLength) {
        break;
      }
    }

    return normalizeExtractedText(chunks.join("\n\n")).slice(0, Math.max(0, Number(maxTextLength) || 0));
  } finally {
    await document.destroy?.();
  }
}

function skippedOcrResult(errorCode) {
  const errorMessage = errorCode === "unsupported_file_type"
    ? "Document type is not supported by local PDF text reading."
    : "Document bytes are not available to local OCR.";

  return {
    status: "skipped",
    text: null,
    engine: "local_pdf",
    errorCode,
    errorMessage
  };
}

async function resolveFileBytes(file) {
  if (!file || typeof file !== "object") return null;
  if (file.bytes) return toUint8Array(file.bytes);
  if (file.buffer) return toUint8Array(file.buffer);
  if (file.arrayBuffer && typeof file.arrayBuffer === "function") {
    return toUint8Array(await file.arrayBuffer());
  }
  return null;
}

function toUint8Array(value) {
  if (Buffer.isBuffer(value)) {
    return new Uint8Array(value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength));
  }
  if (value instanceof Uint8Array) return value;
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  if (ArrayBuffer.isView(value)) {
    return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  }
  return new Uint8Array(Buffer.from(value || ""));
}

function normalizeMimeType(value) {
  return String(value || "").trim().toLowerCase();
}

function normalizeExtractedText(value) {
  return String(value || "")
    .replace(/\u0000/g, "")
    .replace(/[ \t\f\v]+/g, " ")
    .replace(/\s*\n\s*/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
