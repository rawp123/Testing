const STORED_FILE_ID_PATTERN = /^[a-zA-Z0-9_-]{1,120}$/;

function getSafeId(value) {
  const id = String(value || "");
  return STORED_FILE_ID_PATTERN.test(id) ? id : "";
}

function requireSafeId(value) {
  const id = getSafeId(value);
  if (!id) {
    throw new Error("Document file id is invalid.");
  }
  return id;
}

function getSafeFileName(name) {
  const fileName = String(name || "").split(/[\\/]/).filter(Boolean).pop();
  return cleanText(fileName || "Attached file").slice(0, 180) || "Attached file";
}

function cleanText(value) {
  return String(value || "").replace(/[\u0000-\u001f\u007f]/g, "").trim();
}

function toBuffer(data) {
  if (data instanceof ArrayBuffer) {
    return Buffer.from(data);
  }
  if (ArrayBuffer.isView(data)) {
    return Buffer.from(data.buffer, data.byteOffset, data.byteLength);
  }
  throw new Error("Document data was not in the expected format.");
}

module.exports = {
  cleanText,
  getSafeFileName,
  getSafeId,
  requireSafeId,
  toBuffer,
};
