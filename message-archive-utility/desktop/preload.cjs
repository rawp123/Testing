const { contextBridge } = require("electron");

contextBridge.exposeInMainWorld("messageArchive", {
  getApiConfig() {
    return {
      apiBaseUrl: process.env.MESSAGE_ARCHIVE_API_BASE_URL || "",
      apiToken: process.env.MESSAGE_ARCHIVE_API_TOKEN || "",
    };
  },
});
