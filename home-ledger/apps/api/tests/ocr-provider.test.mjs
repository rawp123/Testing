import assert from "node:assert/strict";
import test from "node:test";
import { createOcrProvider, extractPdfEmbeddedText } from "../src/ocr-provider.js";

test("fake OCR provider returns deterministic text without network access", async () => {
  const provider = createOcrProvider({ mode: "fake" });
  const result = await provider.requestText({
    file: {
      original_file_name: "receipt.pdf"
    }
  });

  assert.equal(provider.mode, "fake");
  assert.deepEqual(result, {
    status: "succeeded",
    text: "Extracted text from receipt.pdf.",
    engine: "fake",
    errorCode: null,
    errorMessage: null
  });
});

test("disabled OCR provider queues work without extracted text", async () => {
  const provider = createOcrProvider({ mode: "disabled" });
  const result = await provider.requestText({});

  assert.equal(provider.mode, "disabled");
  assert.deepEqual(result, {
    status: "queued",
    text: null,
    engine: null,
    errorCode: null,
    errorMessage: null
  });
});

test("local PDF OCR provider extracts embedded PDF text from supplied bytes", async () => {
  const provider = createOcrProvider({ mode: "local_pdf" });
  const pdfBytes = createTextPdf("Roof invoice total 123");

  const result = await provider.requestText({
    file: {
      mime_type: "application/pdf",
      bytes: pdfBytes,
      original_file_name: "private-roof-invoice.pdf"
    }
  });

  assert.equal(provider.mode, "local_pdf");
  assert.equal(result.status, "succeeded");
  assert.equal(result.text, "Roof invoice total 123");
  assert.equal(result.engine, "local_pdf");
  assert.equal(result.errorCode, null);
  assert.equal(result.errorMessage, null);
  assert.equal(JSON.stringify(result).includes("private-roof-invoice"), false);
});

test("local PDF OCR provider succeeds with empty text for PDFs without embedded text", async () => {
  const provider = createOcrProvider({ mode: "local_pdf" });

  const result = await provider.requestText({
    file: {
      mime_type: "application/pdf",
      bytes: createBlankPdf()
    }
  });

  assert.equal(result.status, "succeeded");
  assert.equal(result.text, "");
  assert.equal(result.engine, "local_pdf");
});

test("local PDF OCR provider safely skips when file bytes are unavailable", async () => {
  const provider = createOcrProvider({ mode: "local_pdf" });

  const result = await provider.requestText({
    file: {
      mime_type: "application/pdf",
      original_file_name: "private-receipt.pdf"
    }
  });

  assert.deepEqual(result, {
    status: "skipped",
    text: null,
    engine: "local_pdf",
    errorCode: "file_bytes_unavailable",
    errorMessage: "Document bytes are not available to local OCR."
  });
  assert.equal(JSON.stringify(result).includes("private-receipt"), false);
});

test("local PDF OCR provider safely fails corrupt PDFs without leaking parser details", async () => {
  const provider = createOcrProvider({ mode: "local_pdf" });

  const result = await provider.requestText({
    file: {
      mime_type: "application/pdf",
      bytes: Buffer.from("not a pdf"),
      original_file_name: "private-corrupt.pdf"
    }
  });

  assert.deepEqual(result, {
    status: "failed",
    text: null,
    engine: "local_pdf",
    errorCode: "pdf_text_extraction_failed",
    errorMessage: "Document text could not be read."
  });
  const serialized = JSON.stringify(result);
  assert.equal(serialized.includes("private-corrupt"), false);
  assert.equal(serialized.includes("Invalid PDF"), false);
});

test("local PDF OCR provider skips non-PDF files without reading image OCR", async () => {
  const provider = createOcrProvider({ mode: "local_pdf" });

  const result = await provider.requestText({
    file: {
      mime_type: "image/jpeg",
      bytes: Buffer.from("fake jpeg")
    }
  });

  assert.equal(result.status, "skipped");
  assert.equal(result.errorCode, "unsupported_file_type");
  assert.equal(result.text, null);
});

test("PDF extraction helper caps stored text", async () => {
  const text = await extractPdfEmbeddedText(createTextPdf("A very long roof invoice total"), {
    maxTextLength: 10
  });

  assert.equal(text, "A very lon");
});

function createTextPdf(text) {
  const stream = `BT /F1 24 Tf 72 720 Td (${escapePdfText(text)}) Tj ET`;
  return createPdf({ stream });
}

function createBlankPdf() {
  return createPdf({ stream: "" });
}

function createPdf({ stream }) {
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  for (let index = 0; index < objects.length; index += 1) {
    offsets.push(Buffer.byteLength(pdf));
    pdf += `${index + 1} 0 obj\n${objects[index]}\nendobj\n`;
  }
  const xrefOffset = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  for (const offset of offsets.slice(1)) {
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer << /Root 1 0 R /Size ${objects.length + 1} >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return Buffer.from(pdf);
}

function escapePdfText(value) {
  return String(value).replace(/[()\\]/g, (character) => `\\${character}`);
}
