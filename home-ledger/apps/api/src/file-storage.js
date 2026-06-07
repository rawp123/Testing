import { randomUUID } from "node:crypto";

const DEFAULT_INTENT_TTL_MS = 10 * 60 * 1000;

export function createFileStorageAdapter({ driver = "local", now = () => new Date() } = {}) {
  return {
    driver,
    createStorageKey({ workspaceId, documentId, documentFileId }) {
      return `workspaces/${workspaceId}/documents/${documentId}/files/${documentFileId}`;
    },
    createUploadIntent({ mimeType }) {
      return {
        upload_method: "api_adapter",
        upload_url: null,
        upload_headers: {
          "content-type": mimeType
        },
        upload_token: `upload_${randomUUID()}`,
        expires_at: new Date(now().getTime() + DEFAULT_INTENT_TTL_MS).toISOString()
      };
    },
    createDownloadIntent({ status }) {
      return {
        download_available: status === "available",
        download_url: null,
        expires_at: null
      };
    },
    async deleteObject() {
      return {
        cleanup_deferred: true
      };
    }
  };
}
