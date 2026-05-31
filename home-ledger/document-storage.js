const DATABASE_NAME = "home-ledger-documents";
const DATABASE_VERSION = 1;
const FILE_STORE = "files";

let databasePromise;
const desktopBridge = typeof window !== "undefined" ? window.homeLedgerDesktop : null;

export function canStoreDocuments() {
  if (desktopBridge?.isDesktop) return true;
  return typeof window !== "undefined" && "indexedDB" in window;
}

export async function saveDocumentFile(fileId, file) {
  if (desktopBridge?.isDesktop) {
    const storedFile = await desktopBridge.saveDocumentFile({
      id: fileId,
      data: await file.arrayBuffer(),
      name: file.name,
      type: file.type || "application/octet-stream",
      size: file.size || 0,
      lastModified: file.lastModified || null,
      storedAt: new Date().toISOString(),
    });
    return storedFile;
  }

  const database = await openDatabase();
  const record = {
    id: fileId,
    blob: file,
    name: getSafeFileName(file.name),
    type: file.type || "application/octet-stream",
    size: file.size || 0,
    lastModified: file.lastModified || null,
    storedAt: new Date().toISOString(),
  };
  await runStoreRequest(database, "readwrite", (store) => store.put(record));
  return record;
}

export async function saveDocumentFileRecord(record) {
  if (desktopBridge?.isDesktop) {
    const blob = record.blob;
    return desktopBridge.saveDocumentFile({
      id: record.id,
      data: await blob.arrayBuffer(),
      name: record.name,
      type: record.type || blob?.type || "application/octet-stream",
      size: Number(record.size) || blob?.size || 0,
      lastModified: record.lastModified || null,
      storedAt: record.storedAt || new Date().toISOString(),
    });
  }

  const database = await openDatabase();
  const storedRecord = {
    id: record.id,
    blob: record.blob,
    name: getSafeFileName(record.name),
    type: record.type || record.blob?.type || "application/octet-stream",
    size: Number(record.size) || record.blob?.size || 0,
    lastModified: record.lastModified || null,
    storedAt: record.storedAt || new Date().toISOString(),
  };
  await runStoreRequest(database, "readwrite", (store) => store.put(storedRecord));
  return storedRecord;
}

function getSafeFileName(name) {
  const fileName = String(name || "").split(/[\\/]/).filter(Boolean).pop();
  return fileName || "Attached file";
}

export async function getDocumentFile(fileId) {
  if (!fileId) return null;
  if (desktopBridge?.isDesktop) {
    const storedFile = await desktopBridge.getDocumentFile(fileId);
    if (!storedFile?.data) return null;
    const blob = new Blob([storedFile.data], { type: storedFile.type || "application/octet-stream" });
    return {
      id: storedFile.id,
      blob,
      name: getSafeFileName(storedFile.name),
      type: storedFile.type || blob.type,
      size: storedFile.size || blob.size,
      lastModified: storedFile.lastModified || null,
      storedAt: storedFile.storedAt || "",
    };
  }

  const database = await openDatabase();
  return runStoreRequest(database, "readonly", (store) => store.get(fileId));
}

export async function deleteDocumentFile(fileId) {
  if (!fileId) return;
  if (desktopBridge?.isDesktop) {
    await desktopBridge.deleteDocumentFile(fileId);
    return;
  }

  const database = await openDatabase();
  await runStoreRequest(database, "readwrite", (store) => store.delete(fileId));
}

export async function listDocumentFiles() {
  if (desktopBridge?.isDesktop) {
    return desktopBridge.listDocumentFiles();
  }

  const database = await openDatabase();
  return runStoreRequest(database, "readonly", (store) => store.getAll());
}

function openDatabase() {
  if (!canStoreDocuments()) {
    return Promise.reject(new Error("Document file storage is not available in this app."));
  }

  if (!databasePromise) {
    databasePromise = new Promise((resolve, reject) => {
      const request = window.indexedDB.open(DATABASE_NAME, DATABASE_VERSION);

      request.onupgradeneeded = () => {
        const database = request.result;
        if (!database.objectStoreNames.contains(FILE_STORE)) {
          database.createObjectStore(FILE_STORE, { keyPath: "id" });
        }
      };

      request.onsuccess = () => {
        const database = request.result;
        database.onversionchange = () => {
          database.close();
          databasePromise = undefined;
        };
        resolve(database);
      };
      request.onerror = () => {
        databasePromise = undefined;
        reject(request.error || new Error("Could not open document storage."));
      };
      request.onblocked = () => {
        databasePromise = undefined;
        reject(new Error("Document storage is blocked by another open app window or browser tab."));
      };
    });
  }

  return databasePromise;
}

function runStoreRequest(database, mode, createRequest) {
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(FILE_STORE, mode);
    const store = transaction.objectStore(FILE_STORE);
    const request = createRequest(store);
    let result;

    request.onsuccess = () => {
      result = request.result;
    };
    request.onerror = () => {
      reject(request.error || new Error("Document storage request failed."));
    };
    transaction.oncomplete = () => resolve(result);
    transaction.onerror = () => reject(transaction.error || new Error("Document storage transaction failed."));
    transaction.onabort = () => reject(transaction.error || new Error("Document storage transaction was canceled."));
  });
}
