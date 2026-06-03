import { sanitizeData } from "../domain/model.js";

const desktopBridge = typeof window !== "undefined" ? window.homeLedgerDesktop : null;

export function isDesktopMode() {
  return Boolean(desktopBridge?.isDesktop);
}

export async function getStorageInfo() {
  if (!isDesktopMode()) {
    return {
      mode: "browser",
      recordsPathLabel: "Browser local storage",
      documentsPathLabel: "Browser IndexedDB",
      storageDescription: "Records and document copies are stored in this browser profile.",
      recordsBytes: 0,
      documentBytes: 0,
      documentCount: 0,
    };
  }

  return desktopBridge.getStorageInfo();
}

export async function loadRecords(storageKey) {
  if (isDesktopMode()) {
    return sanitizeData(await desktopBridge.loadData());
  }

  const storedValue = window.localStorage.getItem(storageKey);
  return storedValue ? sanitizeData(JSON.parse(storedValue)) : sanitizeData();
}

export async function saveRecords(storageKey, data) {
  const cleanData = sanitizeData(data);
  if (isDesktopMode()) {
    await desktopBridge.saveData(cleanData);
    return cleanData;
  }

  window.localStorage.setItem(storageKey, JSON.stringify(cleanData));
  return cleanData;
}

export async function saveBackupFile(filename, contents) {
  if (!isDesktopMode()) return { handled: false };
  return desktopBridge.saveBackupFile({
    filename,
    contents,
  });
}

export async function saveCpaReviewPdf(filename, html) {
  if (!isDesktopMode()) return { handled: false };
  return desktopBridge.saveCpaReviewPdf({
    filename,
    html,
  });
}
