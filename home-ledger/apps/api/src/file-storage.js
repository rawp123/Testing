import { createHmac, createHash, randomUUID } from "node:crypto";

const DEFAULT_INTENT_TTL_MS = 10 * 60 * 1000;
const DEFAULT_UPLOAD_TTL_SECONDS = 10 * 60;
const DEFAULT_DOWNLOAD_TTL_SECONDS = 5 * 60;
const MAX_PRESIGN_TTL_SECONDS = 60 * 60;
const AWS_ALGORITHM = "AWS4-HMAC-SHA256";
const AWS_SERVICE = "s3";
const UNSIGNED_PAYLOAD = "UNSIGNED-PAYLOAD";

export function createFileStorageAdapter({ driver = "local", config = {}, now = () => new Date() } = {}) {
  const normalizedDriver = String(config.driver || driver || "local").trim().toLowerCase();
  if (normalizedDriver === "s3") {
    return createS3FileStorageAdapter({ config, now });
  }
  return createLocalFileStorageAdapter({ driver: normalizedDriver, now });
}

export function createLocalFileStorageAdapter({ driver = "local", now = () => new Date() } = {}) {
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

export function createS3FileStorageAdapter({ config, now = () => new Date() }) {
  const s3Config = normalizeS3Config(config);
  return {
    driver: "s3",
    createStorageKey({ workspaceId, documentId, documentFileId }) {
      return createOpaqueStorageKey({ workspaceId, documentId, documentFileId });
    },
    createUploadIntent({ storageKey, mimeType }) {
      const expiresAt = new Date(now().getTime() + s3Config.uploadUrlTtlSeconds * 1000).toISOString();
      return {
        upload_method: "signed_url_put",
        upload_url: presignS3Url({
          method: "PUT",
          storageKey,
          contentType: mimeType,
          ttlSeconds: s3Config.uploadUrlTtlSeconds,
          now,
          config: s3Config
        }),
        upload_headers: {
          "content-type": mimeType
        },
        upload_token: null,
        expires_at: expiresAt
      };
    },
    createDownloadIntent({ storageKey, status }) {
      if (status !== "available") {
        return {
          download_available: false,
          download_url: null,
          expires_at: null
        };
      }
      const expiresAt = new Date(now().getTime() + s3Config.downloadUrlTtlSeconds * 1000).toISOString();
      return {
        download_available: true,
        download_url: presignS3Url({
          method: "GET",
          storageKey,
          ttlSeconds: s3Config.downloadUrlTtlSeconds,
          now,
          config: s3Config
        }),
        expires_at: expiresAt
      };
    },
    async deleteObject() {
      return {
        cleanup_deferred: true
      };
    }
  };
}

export function createOpaqueStorageKey({ workspaceId, documentId, documentFileId }) {
  const workspaceHash = sha256Hex(`workspace:${workspaceId}`).slice(0, 24);
  const documentHash = sha256Hex(`document:${documentId}`).slice(0, 24);
  const fileHash = sha256Hex(`file:${documentFileId}`).slice(0, 32);
  return `tenant-${workspaceHash}/documents/${documentHash}/files/${fileHash}`;
}

export function normalizeS3Config(config = {}) {
  const region = normalizeText(config.region) || "us-east-1";
  const uploadUrlTtlSeconds = normalizeTtl(config.uploadUrlTtlSeconds, DEFAULT_UPLOAD_TTL_SECONDS);
  const downloadUrlTtlSeconds = normalizeTtl(config.downloadUrlTtlSeconds, DEFAULT_DOWNLOAD_TTL_SECONDS);
  return Object.freeze({
    driver: "s3",
    bucket: normalizeText(config.bucket),
    region,
    endpoint: normalizeText(config.endpoint),
    accessKeyId: normalizeText(config.accessKeyId),
    secretAccessKey: String(config.secretAccessKey || ""),
    forcePathStyle: Boolean(config.forcePathStyle),
    uploadUrlTtlSeconds,
    downloadUrlTtlSeconds
  });
}

function presignS3Url({ method, storageKey, contentType, ttlSeconds, now, config }) {
  const requestDate = now();
  const amzDate = toAmzDate(requestDate);
  const dateStamp = amzDate.slice(0, 8);
  const scope = `${dateStamp}/${config.region}/${AWS_SERVICE}/aws4_request`;
  const { url, canonicalUri } = buildS3ObjectUrl({ config, storageKey });
  const headers = {
    host: url.host
  };
  if (contentType) {
    headers["content-type"] = contentType;
  }
  const signedHeaders = Object.keys(headers).sort().join(";");
  const query = {
    "X-Amz-Algorithm": AWS_ALGORITHM,
    "X-Amz-Credential": `${config.accessKeyId}/${scope}`,
    "X-Amz-Date": amzDate,
    "X-Amz-Expires": String(ttlSeconds),
    "X-Amz-SignedHeaders": signedHeaders,
    "X-Amz-Content-Sha256": UNSIGNED_PAYLOAD
  };
  const canonicalQuery = canonicalQueryString(query);
  const canonicalHeaders = Object.keys(headers)
    .sort()
    .map((key) => `${key}:${normalizeHeaderValue(headers[key])}\n`)
    .join("");
  const canonicalRequest = [
    method,
    canonicalUri,
    canonicalQuery,
    canonicalHeaders,
    signedHeaders,
    UNSIGNED_PAYLOAD
  ].join("\n");
  const stringToSign = [
    AWS_ALGORITHM,
    amzDate,
    scope,
    sha256Hex(canonicalRequest)
  ].join("\n");
  const signingKey = getSigningKey({
    secretAccessKey: config.secretAccessKey,
    dateStamp,
    region: config.region
  });
  query["X-Amz-Signature"] = hmacHex(signingKey, stringToSign);
  url.search = canonicalQueryString(query);
  return url.toString();
}

function buildS3ObjectUrl({ config, storageKey }) {
  const keyPath = storageKey.split("/").map(encodePathSegment).join("/");
  if (config.endpoint) {
    const endpoint = new URL(config.endpoint);
    if (config.forcePathStyle) {
      return {
        url: new URL(`${trimTrailingSlash(endpoint.toString())}/${encodePathSegment(config.bucket)}/${keyPath}`),
        canonicalUri: `/${encodePathSegment(config.bucket)}/${keyPath}`
      };
    }
    const endpointHost = endpoint.host;
    endpoint.host = `${config.bucket}.${endpointHost}`;
    endpoint.pathname = `/${keyPath}`;
    endpoint.search = "";
    return {
      url: endpoint,
      canonicalUri: `/${keyPath}`
    };
  }

  if (config.forcePathStyle) {
    return {
      url: new URL(`https://s3.${config.region}.amazonaws.com/${encodePathSegment(config.bucket)}/${keyPath}`),
      canonicalUri: `/${encodePathSegment(config.bucket)}/${keyPath}`
    };
  }

  return {
    url: new URL(`https://${config.bucket}.s3.${config.region}.amazonaws.com/${keyPath}`),
    canonicalUri: `/${keyPath}`
  };
}

function getSigningKey({ secretAccessKey, dateStamp, region }) {
  const dateKey = hmacBuffer(`AWS4${secretAccessKey}`, dateStamp);
  const regionKey = hmacBuffer(dateKey, region);
  const serviceKey = hmacBuffer(regionKey, AWS_SERVICE);
  return hmacBuffer(serviceKey, "aws4_request");
}

function canonicalQueryString(query) {
  return Object.keys(query)
    .sort()
    .map((key) => `${encodeRfc3986(key)}=${encodeRfc3986(query[key])}`)
    .join("&");
}

function normalizeHeaderValue(value) {
  return String(value || "").trim().replace(/\s+/g, " ");
}

function encodePathSegment(value) {
  return encodeRfc3986(value);
}

function encodeRfc3986(value) {
  return encodeURIComponent(String(value))
    .replace(/[!'()*]/g, (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`);
}

function toAmzDate(date) {
  return date.toISOString().replace(/[:-]|\.\d{3}/g, "");
}

function sha256Hex(value) {
  return createHash("sha256").update(String(value)).digest("hex");
}

function hmacBuffer(key, value) {
  return createHmac("sha256", key).update(String(value)).digest();
}

function hmacHex(key, value) {
  return createHmac("sha256", key).update(String(value)).digest("hex");
}

function normalizeText(value) {
  return String(value || "").trim();
}

function normalizeTtl(value, fallback) {
  const ttl = Number.parseInt(String(value || fallback), 10);
  if (!Number.isInteger(ttl) || ttl < 1) {
    return fallback;
  }
  return Math.min(ttl, MAX_PRESIGN_TTL_SECONDS);
}

function trimTrailingSlash(value) {
  return String(value || "").replace(/\/+$/, "");
}
