const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("homeLedgerDesktop", {
  isDesktop: true,
  getStorageInfo() {
    return ipcRenderer.invoke("home-ledger:get-storage-info");
  },
  loadData() {
    return ipcRenderer.invoke("home-ledger:load-data");
  },
  saveData(data) {
    return ipcRenderer.invoke("home-ledger:save-data", data);
  },
  saveBackupFile(record) {
    return ipcRenderer.invoke("home-ledger:save-backup-file", record);
  },
  saveCpaReviewPdf(record) {
    return ipcRenderer.invoke("home-ledger:save-cpa-review-pdf", record);
  },
  saveDocumentFile(record) {
    return ipcRenderer.invoke("home-ledger:save-document-file", record);
  },
  getDocumentFile(fileId) {
    return ipcRenderer.invoke("home-ledger:get-document-file", fileId);
  },
  deleteDocumentFile(fileId) {
    return ipcRenderer.invoke("home-ledger:delete-document-file", fileId);
  },
  listDocumentFiles() {
    return ipcRenderer.invoke("home-ledger:list-document-files");
  },
});
