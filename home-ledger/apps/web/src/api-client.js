const DEFAULT_API_BASE_URL = "/api/v1";

export class HomeLedgerApiError extends Error {
  constructor({ status, code, message, requestId, details } = {}) {
    super(message || "Request failed.");
    this.name = "HomeLedgerApiError";
    this.status = status || 0;
    this.code = code || "request_failed";
    this.requestId = requestId || "";
    this.details = Array.isArray(details) ? details : [];
  }
}

export function createHomeLedgerApiClient({
  baseUrl = DEFAULT_API_BASE_URL,
  fetchImpl = globalThis.fetch,
  headers = {}
} = {}) {
  if (typeof fetchImpl !== "function") {
    throw new TypeError("A fetch implementation is required.");
  }

  const normalizedBaseUrl = normalizeBaseUrl(baseUrl);

  async function request(path, options = {}) {
    const response = await fetchImpl(`${normalizedBaseUrl}${path}`, {
      method: options.method || "GET",
      headers: {
        Accept: "application/json",
        ...headers,
        ...(options.headers || {})
      },
      body: options.body
    });

    const payload = await readJsonPayload(response);
    if (!response.ok) {
      throw normalizeApiError(response, payload);
    }
    return payload?.data;
  }

  return Object.freeze({
    getSession() {
      return request("/session");
    },
    getDashboard(workspaceId) {
      return request(`/workspaces/${encodeURIComponent(requireId(workspaceId, "workspaceId"))}/dashboard`);
    },
    getFollowUpSummary(workspaceId) {
      return request(`/workspaces/${encodeURIComponent(requireId(workspaceId, "workspaceId"))}/follow-ups/summary`);
    }
  });
}

export async function loadInitialDashboard({ client }) {
  const session = await client.getSession();
  const workspace = chooseActiveWorkspace(session);
  if (!workspace) {
    return {
      status: "empty_workspace",
      session,
      workspace: null,
      dashboard: null
    };
  }

  const dashboard = await client.getDashboard(workspace.workspaceId);
  return {
    status: "ready",
    session,
    workspace,
    dashboard
  };
}

export function chooseActiveWorkspace(session) {
  const memberships = Array.isArray(session?.memberships) ? session.memberships : [];
  return memberships.find((membership) => membership?.role === "owner") || memberships[0] || null;
}

function normalizeBaseUrl(value) {
  const text = String(value || DEFAULT_API_BASE_URL).trim() || DEFAULT_API_BASE_URL;
  return text.endsWith("/") ? text.slice(0, -1) : text;
}

function requireId(value, field) {
  const text = String(value || "").trim();
  if (!text) {
    throw new TypeError(`${field} is required.`);
  }
  return text;
}

async function readJsonPayload(response) {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    throw new HomeLedgerApiError({
      status: response.status,
      code: "invalid_response",
      message: "The server returned an unreadable response."
    });
  }
}

function normalizeApiError(response, payload) {
  const error = payload?.error || {};
  return new HomeLedgerApiError({
    status: response.status,
    code: error.code,
    message: error.message,
    requestId: error.requestId || error.request_id,
    details: error.details
  });
}
