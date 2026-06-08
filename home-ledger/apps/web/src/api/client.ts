import type {
  ApiEnvelope,
  DashboardResponse,
  DocumentFileAttachResult,
  DocumentFileCompleteInput,
  DocumentFileIntentInput,
  DocumentFileIntentResponse,
  DocumentFileSummary,
  ExportDownloadResponse,
  ExportSummaryResponse,
  DocumentInput,
  DocumentOcrStatusResponse,
  DocumentOcrTextResponse,
  DocumentRecord,
  ExpenseInput,
  ExpenseRecord,
  FollowUpItem,
  FollowUpListStatus,
  FollowUpResolveInput,
  FollowUpSummaryResponse,
  ProjectInput,
  ProjectRecord,
  PropertyInput,
  PropertyRecord,
  SessionResponse,
  VendorInput,
  VendorRecord
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
  getFollowUps(workspaceId: string, status?: FollowUpListStatus): Promise<FollowUpItem[]>;
  getFollowUpSummary(workspaceId: string): Promise<FollowUpSummaryResponse>;
  resolveFollowUp(workspaceId: string, followUpId: string, input?: FollowUpResolveInput): Promise<FollowUpItem>;
  reopenFollowUp(workspaceId: string, followUpId: string): Promise<FollowUpItem>;
  listProperties(workspaceId: string): Promise<PropertyRecord[]>;
  createProperty(workspaceId: string, input: PropertyInput): Promise<PropertyRecord>;
  updateProperty(workspaceId: string, propertyId: string, input: Partial<PropertyInput>): Promise<PropertyRecord>;
  archiveProperty(workspaceId: string, propertyId: string): Promise<PropertyRecord>;
  listVendors(workspaceId: string): Promise<VendorRecord[]>;
  createVendor(workspaceId: string, input: VendorInput): Promise<VendorRecord>;
  updateVendor(workspaceId: string, vendorId: string, input: Partial<VendorInput>): Promise<VendorRecord>;
  archiveVendor(workspaceId: string, vendorId: string): Promise<VendorRecord>;
  listProjects(workspaceId: string): Promise<ProjectRecord[]>;
  createProject(workspaceId: string, input: ProjectInput): Promise<ProjectRecord>;
  updateProject(workspaceId: string, projectId: string, input: Partial<ProjectInput>): Promise<ProjectRecord>;
  archiveProject(workspaceId: string, projectId: string): Promise<ProjectRecord>;
  listExpenses(workspaceId: string): Promise<ExpenseRecord[]>;
  createExpense(workspaceId: string, input: ExpenseInput): Promise<ExpenseRecord>;
  updateExpense(workspaceId: string, expenseId: string, input: Partial<ExpenseInput>): Promise<ExpenseRecord>;
  archiveExpense(workspaceId: string, expenseId: string): Promise<ExpenseRecord>;
  listDocuments(workspaceId: string): Promise<DocumentRecord[]>;
  createDocument(workspaceId: string, input: DocumentInput): Promise<DocumentRecord>;
  updateDocument(workspaceId: string, documentId: string, input: Partial<DocumentInput>): Promise<DocumentRecord>;
  archiveDocument(workspaceId: string, documentId: string): Promise<DocumentRecord>;
  createDocumentFileIntent(workspaceId: string, documentId: string, input: DocumentFileIntentInput): Promise<DocumentFileIntentResponse>;
  completeDocumentFileUpload(workspaceId: string, documentId: string, input: DocumentFileCompleteInput): Promise<DocumentFileSummary>;
  getDocumentFile(workspaceId: string, documentId: string): Promise<DocumentFileSummary>;
  removeDocumentFile(workspaceId: string, documentId: string): Promise<DocumentFileSummary>;
  attachDocumentFile(workspaceId: string, documentId: string, file: File): Promise<DocumentFileAttachResult>;
  requestDocumentOcr(workspaceId: string, documentId: string): Promise<DocumentOcrStatusResponse>;
  getDocumentOcrStatus(workspaceId: string, documentId: string): Promise<DocumentOcrStatusResponse>;
  getDocumentOcrText(workspaceId: string, documentId: string): Promise<DocumentOcrTextResponse>;
  getExportSummary(workspaceId: string): Promise<ExportSummaryResponse>;
  downloadExpensesCsv(workspaceId: string): Promise<ExportDownloadResponse>;
  downloadDocumentsCsv(workspaceId: string): Promise<ExportDownloadResponse>;
  downloadFullJsonExport(workspaceId: string): Promise<ExportDownloadResponse>;
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

  async function download(path: string, fallbackFileName: string): Promise<ExportDownloadResponse> {
    const response = await fetchImpl(`${normalizedBaseUrl}${path}`, {
      method: "GET",
      headers: {
        Accept: "*/*",
        ...headers
      }
    });

    if (!response.ok) {
      const payload = await readJsonPayload<unknown>(response);
      throw normalizeApiError(response, payload);
    }

    return {
      blob: await response.blob(),
      file_name: fileNameFromContentDisposition(response.headers.get("content-disposition")) || fallbackFileName,
      content_type: response.headers.get("content-type") || "application/octet-stream"
    };
  }

  return Object.freeze({
    getSession() {
      return request<SessionResponse>("/session");
    },
    getDashboard(workspaceId: string) {
      return request<DashboardResponse>(`/workspaces/${encodeURIComponent(requireId(workspaceId, "workspaceId"))}/dashboard`);
    },
    getFollowUps(workspaceId: string, status: FollowUpListStatus = "open") {
      const query = status === "open" ? "" : `?status=${encodeURIComponent(status)}`;
      return request<FollowUpItem[]>(`/workspaces/${encodeURIComponent(requireId(workspaceId, "workspaceId"))}/follow-ups${query}`);
    },
    getFollowUpSummary(workspaceId: string) {
      return request<FollowUpSummaryResponse>(`/workspaces/${encodeURIComponent(requireId(workspaceId, "workspaceId"))}/follow-ups/summary`);
    },
    resolveFollowUp(workspaceId: string, followUpId: string, input: FollowUpResolveInput = {}) {
      return request<FollowUpItem>(
        `/workspaces/${encodeURIComponent(requireId(workspaceId, "workspaceId"))}/follow-ups/${encodeURIComponent(requireId(followUpId, "followUpId"))}/resolve`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input)
        }
      );
    },
    reopenFollowUp(workspaceId: string, followUpId: string) {
      return request<FollowUpItem>(
        `/workspaces/${encodeURIComponent(requireId(workspaceId, "workspaceId"))}/follow-ups/${encodeURIComponent(requireId(followUpId, "followUpId"))}/reopen`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({})
        }
      );
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
    listVendors(workspaceId: string) {
      return request<VendorRecord[]>(`/workspaces/${encodeURIComponent(requireId(workspaceId, "workspaceId"))}/vendors`);
    },
    createVendor(workspaceId: string, input: VendorInput) {
      return request<VendorRecord>(`/workspaces/${encodeURIComponent(requireId(workspaceId, "workspaceId"))}/vendors`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input)
      });
    },
    updateVendor(workspaceId: string, vendorId: string, input: Partial<VendorInput>) {
      return request<VendorRecord>(
        `/workspaces/${encodeURIComponent(requireId(workspaceId, "workspaceId"))}/vendors/${encodeURIComponent(requireId(vendorId, "vendorId"))}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input)
        }
      );
    },
    archiveVendor(workspaceId: string, vendorId: string) {
      return request<VendorRecord>(
        `/workspaces/${encodeURIComponent(requireId(workspaceId, "workspaceId"))}/vendors/${encodeURIComponent(requireId(vendorId, "vendorId"))}/archive`,
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
    },
    listExpenses(workspaceId: string) {
      return request<ExpenseRecord[]>(`/workspaces/${encodeURIComponent(requireId(workspaceId, "workspaceId"))}/expenses`);
    },
    createExpense(workspaceId: string, input: ExpenseInput) {
      return request<ExpenseRecord>(`/workspaces/${encodeURIComponent(requireId(workspaceId, "workspaceId"))}/expenses`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input)
      });
    },
    updateExpense(workspaceId: string, expenseId: string, input: Partial<ExpenseInput>) {
      return request<ExpenseRecord>(
        `/workspaces/${encodeURIComponent(requireId(workspaceId, "workspaceId"))}/expenses/${encodeURIComponent(requireId(expenseId, "expenseId"))}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input)
        }
      );
    },
    archiveExpense(workspaceId: string, expenseId: string) {
      return request<ExpenseRecord>(
        `/workspaces/${encodeURIComponent(requireId(workspaceId, "workspaceId"))}/expenses/${encodeURIComponent(requireId(expenseId, "expenseId"))}`,
        { method: "DELETE" }
      );
    },
    listDocuments(workspaceId: string) {
      return request<DocumentRecord[]>(`/workspaces/${encodeURIComponent(requireId(workspaceId, "workspaceId"))}/documents`);
    },
    createDocument(workspaceId: string, input: DocumentInput) {
      return request<DocumentRecord>(`/workspaces/${encodeURIComponent(requireId(workspaceId, "workspaceId"))}/documents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input)
      });
    },
    updateDocument(workspaceId: string, documentId: string, input: Partial<DocumentInput>) {
      return request<DocumentRecord>(
        `/workspaces/${encodeURIComponent(requireId(workspaceId, "workspaceId"))}/documents/${encodeURIComponent(requireId(documentId, "documentId"))}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input)
        }
      );
    },
    archiveDocument(workspaceId: string, documentId: string) {
      return request<DocumentRecord>(
        `/workspaces/${encodeURIComponent(requireId(workspaceId, "workspaceId"))}/documents/${encodeURIComponent(requireId(documentId, "documentId"))}`,
        { method: "DELETE" }
      );
    },
    createDocumentFileIntent(workspaceId: string, documentId: string, input: DocumentFileIntentInput) {
      return request<DocumentFileIntentResponse>(
        `/workspaces/${encodeURIComponent(requireId(workspaceId, "workspaceId"))}/documents/${encodeURIComponent(requireId(documentId, "documentId"))}/file-intent`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input)
        }
      );
    },
    completeDocumentFileUpload(workspaceId: string, documentId: string, input: DocumentFileCompleteInput) {
      return request<DocumentFileSummary>(
        `/workspaces/${encodeURIComponent(requireId(workspaceId, "workspaceId"))}/documents/${encodeURIComponent(requireId(documentId, "documentId"))}/file-complete`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input)
        }
      );
    },
    getDocumentFile(workspaceId: string, documentId: string) {
      return request<DocumentFileSummary>(
        `/workspaces/${encodeURIComponent(requireId(workspaceId, "workspaceId"))}/documents/${encodeURIComponent(requireId(documentId, "documentId"))}/file`
      );
    },
    removeDocumentFile(workspaceId: string, documentId: string) {
      return request<DocumentFileSummary>(
        `/workspaces/${encodeURIComponent(requireId(workspaceId, "workspaceId"))}/documents/${encodeURIComponent(requireId(documentId, "documentId"))}/file`,
        { method: "DELETE" }
      );
    },
    async attachDocumentFile(workspaceId: string, documentId: string, file: File) {
      const cleanFileName = sanitizeFileName(file.name);
      const mimeType = file.type || "application/octet-stream";
      const sha256 = await sha256File(file);
      const workspace = encodeURIComponent(requireId(workspaceId, "workspaceId"));
      const document = encodeURIComponent(requireId(documentId, "documentId"));
      const intent = await request<DocumentFileIntentResponse>(
        `/workspaces/${workspace}/documents/${document}/file-intent`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            original_file_name: cleanFileName,
            mime_type: mimeType,
            size_bytes: file.size,
            sha256,
            source: "web_upload"
          })
        }
      );

      const uploadUrlAvailable = Boolean(intent.upload_url);
      if (intent.upload_url) {
        const uploadResponse = await fetchImpl(intent.upload_url, {
          method: intent.upload_method === "signed_url_put" ? "PUT" : "POST",
          headers: {
            ...(intent.upload_headers || {}),
            "content-type": mimeType
          },
          body: file
        });
        if (!uploadResponse.ok) {
          throw new HomeLedgerApiError({
            status: uploadResponse.status,
            code: "upload_failed",
            message: "File upload failed."
          });
        }
      }

      const completedFile = await request<DocumentFileSummary>(
        `/workspaces/${workspace}/documents/${document}/file-complete`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            document_file_id: intent.document_file_id,
            upload_id: intent.upload_id,
            size_bytes: file.size,
            sha256
          })
        }
      );
      return {
        file: completedFile,
        upload_method: intent.upload_method || null,
        upload_url_available: uploadUrlAvailable,
        browser_upload_performed: uploadUrlAvailable,
        completed_without_browser_upload: !uploadUrlAvailable,
        max_size_bytes: intent.max_size_bytes ?? null
      };
    },
    requestDocumentOcr(workspaceId: string, documentId: string) {
      return request<DocumentOcrStatusResponse>(
        `/workspaces/${encodeURIComponent(requireId(workspaceId, "workspaceId"))}/documents/${encodeURIComponent(requireId(documentId, "documentId"))}/ocr`,
        { method: "POST" }
      );
    },
    getDocumentOcrStatus(workspaceId: string, documentId: string) {
      return request<DocumentOcrStatusResponse>(
        `/workspaces/${encodeURIComponent(requireId(workspaceId, "workspaceId"))}/documents/${encodeURIComponent(requireId(documentId, "documentId"))}/ocr`
      );
    },
    getDocumentOcrText(workspaceId: string, documentId: string) {
      return request<DocumentOcrTextResponse>(
        `/workspaces/${encodeURIComponent(requireId(workspaceId, "workspaceId"))}/documents/${encodeURIComponent(requireId(documentId, "documentId"))}/text`
      );
    },
    getExportSummary(workspaceId: string) {
      return request<ExportSummaryResponse>(`/workspaces/${encodeURIComponent(requireId(workspaceId, "workspaceId"))}/exports/summary`);
    },
    downloadExpensesCsv(workspaceId: string) {
      return download(
        `/workspaces/${encodeURIComponent(requireId(workspaceId, "workspaceId"))}/exports/expenses.csv`,
        "home-ledger-expenses.csv"
      );
    },
    downloadDocumentsCsv(workspaceId: string) {
      return download(
        `/workspaces/${encodeURIComponent(requireId(workspaceId, "workspaceId"))}/exports/documents.csv`,
        "home-ledger-documents.csv"
      );
    },
    downloadFullJsonExport(workspaceId: string) {
      return download(
        `/workspaces/${encodeURIComponent(requireId(workspaceId, "workspaceId"))}/exports/full.json`,
        "home-ledger-full.json"
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

function fileNameFromContentDisposition(value: string | null) {
  const text = String(value || "");
  const utf8Match = text.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8Match?.[1]) return sanitizeFileName(decodeURIComponent(utf8Match[1]));
  const quotedMatch = text.match(/filename="([^"]+)"/i);
  if (quotedMatch?.[1]) return sanitizeFileName(quotedMatch[1]);
  const plainMatch = text.match(/filename=([^;]+)/i);
  if (plainMatch?.[1]) return sanitizeFileName(plainMatch[1]);
  return "";
}

function sanitizeFileName(value: string) {
  const leaf = String(value || "Attached file").split(/[/\\]/).filter(Boolean).at(-1) || "Attached file";
  return leaf.replace(/[\u0000-\u001f\u007f]/g, "").trim() || "Attached file";
}

async function sha256File(file: File) {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) return null;
  const digest = await subtle.digest("SHA-256", await file.arrayBuffer());
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}
