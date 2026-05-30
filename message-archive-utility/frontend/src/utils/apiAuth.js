const RUNTIME_CONFIG = window.messageArchive?.getApiConfig?.() || {};

export const API_BASE_URL = (
  RUNTIME_CONFIG.apiBaseUrl
  || import.meta.env.VITE_API_BASE_URL
  || "/api"
).replace(/\/$/, "");

const API_TOKEN = RUNTIME_CONFIG.apiToken || import.meta.env.VITE_API_TOKEN || "";
const API_TOKEN_HEADER = "X-Message-Archive-Token";

export function buildApiHeaders(headers = {}) {
  if (!API_TOKEN) return headers;
  return {
    ...headers,
    [API_TOKEN_HEADER]: API_TOKEN,
  };
}

export async function apiFetch(url, options = {}) {
  return fetch(url, {
    ...options,
    headers: buildApiHeaders(options.headers || {}),
  });
}
