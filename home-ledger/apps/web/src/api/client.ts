import type {
  ApiEnvelope,
  DashboardResponse,
  FollowUpItem,
  FollowUpSummaryResponse,
  ProjectInput,
  ProjectRecord,
  PropertyInput,
  PropertyRecord,
  SessionResponse
} from "./types";

const DEFAULT_API_BASE_URL = "/api/v1";

export class HomeLedgerApiError extends Error {
  status: number;
  code: string;
  requestId: string;
  details: unknown[];

  constructor({ status, code, message, requestId, details }: {
    status?: number;
    code?: string;
    message?: string;
    requestId?: string;
    details?: unknown[];
  } = {}) {
    super(message || "Request failed.");
    this.name = "HomeLedgerApiError";
    this.status = status || 0;
    this.code = code || "request_failed";
    this.requestId = requestId || "";
    this.details = Array.isArray(details) ? details : [];
  }
}

export interface HomeLedgerApiClientOptions {
  baseUrl?: string;
  fetchImpl?: typeof fetch;
  headers?: Record<string, string>;
}

export interface HomeLedgerApiClient {
  getSession(): Promise<SessionResponse>;
  getDashboard(workspaceId: string): Promise<DashboardResponse>;
  getFollowUps(workspaceId: string): Promise<FollowUpItem[]>;
  getFollowUpSummary(workspaceId: string): Promise<FollowUpSummaryResponse>;
  listProperties(workspaceId: string): Promise<PropertyRecord[]>;
  createProperty(workspaceId: string, input: PropertyInput): Promise<PropertyRecord>;
  updateProperty(workspaceId: string, propertyId: string, input: Partial<PropertyInput>): Promise<PropertyRecord>;
  archiveProperty(workspaceId: string, propertyId: string): Promise<PropertyRecord>;
  listProjects(workspaceId: string): Promise<ProjectRecord[]>;
  createProject(workspaceId: string, input: ProjectInput): Promise<ProjectRecord>;
  updateProject(workspaceId: string, projectId: string, input: Partial<ProjectInput>): Promise<ProjectRecord>;
  archiveProject(workspaceId: string, projectId: string): Promise<ProjectRecord>;
}

export type InitialDashboardState =
  | {
      status: "empty_workspace";
      session: SessionResponse;
      workspace: null;
      dashboard: null;
      followUps: null;
      followUpSummary: null;
    }
  | {
      status: "ready";
      session: SessionResponse;
      workspace: NonNullable<ReturnType<typeof chooseActiveWorkspace>>;
      dashboard: DashboardResponse;
      followUps: FollowUpItem[];
      followUpSummary: FollowUpSummaryResponse;
    };

export function createHomeLedgerApiClient({
  baseUrl = DEFAULT_API_BASE_URL,
  fetchImpl = globalThis.fetch,
  headers = {}
}: HomeLedgerApiClientOptions = {}): HomeLedgerApiClient {
  if (typeof fetchImpl !== "function") {
    throw new TypeError("A fetch implementation is required.");
  }

  const normalizedBaseUrl = normalizeBaseUrl(baseUrl);

  async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const response = await fetchImpl(`${normalizedBaseUrl}${path}`, {
      method: options.method || "GET",
      headers: {
        Accept: "application/json",
        ...headers,
        ...headersFrom(options.headers)
      },
      body: options.body
    });

    const payload = await readJsonPayload<T>(response);
    if (!response.ok) {
      throw normalizeApiError(response, payload);
    }
    return payload?.data as T;
  }

  return Object.freeze({
    getSession() {
      return request<SessionResponse>("/session");
    },
    getDashboard(workspaceId: string) {
      return request<DashboardResponse>(`/workspaces/${encodeURIComponent(requireId(workspaceId, "workspaceId"))}/dashboard`);
    },
    getFollowUps(workspaceId: string) {
      return request<FollowUpItem[]>(`/workspaces/${encodeURIComponent(requireId(workspaceId, "workspaceId"))}/follow-ups`);
    },
    getFollowUpSummary(workspaceId: string) {
      return request<FollowUpSummaryResponse>(`/workspaces/${encodeURIComponent(requireId(workspaceId, "workspaceId"))}/follow-ups/summary`);
    },
    listProperties(workspaceId: string) {
      return request<PropertyRecord[]>(`/workspaces/${encodeURIComponent(requireId(workspaceId, "workspaceId"))}/properties`);
    },
    createProperty(workspaceId: string, input: PropertyInput) {
      return request<PropertyRecord>(`/workspaces/${encodeURIComponent(requireId(workspaceId, "workspaceId"))}/properties`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input)
      });
    },
    updateProperty(workspaceId: string, propertyId: string, input: Partial<PropertyInput>) {
      return request<PropertyRecord>(
        `/workspaces/${encodeURIComponent(requireId(workspaceId, "workspaceId"))}/properties/${encodeURIComponent(requireId(propertyId, "propertyId"))}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input)
        }
      );
    },
    archiveProperty(workspaceId: string, propertyId: string) {
      return request<PropertyRecord>(
        `/workspaces/${encodeURIComponent(requireId(workspaceId, "workspaceId"))}/properties/${encodeURIComponent(requireId(propertyId, "propertyId"))}/archive`,
        { method: "POST" }
      );
    },
    listProjects(workspaceId: string) {
      return request<ProjectRecord[]>(`/workspaces/${encodeURIComponent(requireId(workspaceId, "workspaceId"))}/projects`);
    },
    createProject(workspaceId: string, input: ProjectInput) {
      return request<ProjectRecord>(`/workspaces/${encodeURIComponent(requireId(workspaceId, "workspaceId"))}/projects`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input)
      });
    },
    updateProject(workspaceId: string, projectId: string, input: Partial<ProjectInput>) {
      return request<ProjectRecord>(
        `/workspaces/${encodeURIComponent(requireId(workspaceId, "workspaceId"))}/projects/${encodeURIComponent(requireId(projectId, "projectId"))}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input)
        }
      );
    },
    archiveProject(workspaceId: string, projectId: string) {
      return request<ProjectRecord>(
        `/workspaces/${encodeURIComponent(requireId(workspaceId, "workspaceId"))}/projects/${encodeURIComponent(requireId(projectId, "projectId"))}/archive`,
        { method: "POST" }
      );
    }
  });
}

export async function loadInitialDashboard({ client }: { client: HomeLedgerApiClient }): Promise<InitialDashboardState> {
  const session = await client.getSession();
  const workspace = chooseActiveWorkspace(session);
  if (!workspace) {
    return {
      status: "empty_workspace",
      session,
      workspace: null,
      dashboard: null,
      followUps: null,
      followUpSummary: null
    };
  }

  const [dashboard, followUps, followUpSummary] = await Promise.all([
    client.getDashboard(workspace.workspaceId),
    client.getFollowUps(workspace.workspaceId),
    client.getFollowUpSummary(workspace.workspaceId)
  ]);

  return {
    status: "ready",
    session,
    workspace,
    dashboard,
    followUps,
    followUpSummary
  };
}

export function chooseActiveWorkspace(session: SessionResponse | null | undefined) {
  const memberships = Array.isArray(session?.memberships) ? session.memberships : [];
  return memberships.find((membership) => membership?.role === "owner") || memberships[0] || null;
}

function normalizeBaseUrl(value: string) {
  const text = String(value || DEFAULT_API_BASE_URL).trim() || DEFAULT_API_BASE_URL;
  return text.endsWith("/") ? text.slice(0, -1) : text;
}

function requireId(value: string, field: string) {
  const text = String(value || "").trim();
  if (!text) {
    throw new TypeError(`${field} is required.`);
  }
  return text;
}

async function readJsonPayload<T>(response: Response): Promise<ApiEnvelope<T> | null> {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as ApiEnvelope<T>;
  } catch {
    throw new HomeLedgerApiError({
      status: response.status,
      code: "invalid_response",
      message: "The server returned an unreadable response."
    });
  }
}

function normalizeApiError(response: Response, payload: ApiEnvelope<unknown> | null) {
  const error = payload?.error || {};
  return new HomeLedgerApiError({
    status: response.status,
    code: error.code,
    message: error.message,
    requestId: error.requestId || error.request_id,
    details: error.details
  });
}

function headersFrom(headers: RequestInit["headers"]): Record<string, string> {
  if (!headers) return {};
  if (headers instanceof Headers) return Object.fromEntries(headers.entries());
  if (Array.isArray(headers)) return Object.fromEntries(headers);
  return headers as Record<string, string>;
}
