export type WorkspaceRole = "owner" | "editor" | "viewer" | string;

export interface SessionUser {
  id: string;
  email: string;
  displayName?: string | null;
}

export interface WorkspaceMembership {
  id: string;
  workspaceId: string;
  workspaceName: string;
  role: WorkspaceRole;
}

export interface SessionResponse {
  user: SessionUser;
  authProvider?: string;
  isDevAuth?: boolean;
  memberships: WorkspaceMembership[];
}

export interface DashboardCountSummary {
  count: number;
  active_count?: number;
  archived_count?: number;
}

export interface ProjectStatusSummary {
  status: string;
  count: number;
}

export interface ExpenseClassificationSummary {
  record_treatment: "possible_improvement" | "repair_upkeep" | "review_later" | string;
  count: number;
  total_amount_cents: number;
}

export interface DocumentTypeSummary {
  document_type: string;
  count: number;
}

export interface DashboardActivity {
  activity_type: "property" | "project" | "expense" | "document" | string;
  record_type: string;
  record_id: string;
  record_name?: string | null;
  summary?: string | null;
  occurred_at?: string | null;
  property_id?: string | null;
  property_name?: string | null;
  project_id?: string | null;
  project_name?: string | null;
  expense_id?: string | null;
  document_id?: string | null;
  amount_cents?: number | null;
  document_type?: string | null;
  file_availability?: string | null;
  record_treatment?: string | null;
  status?: string | null;
  [key: string]: unknown;
}

export interface FollowUpBucket {
  type: string;
  label: string;
  count: number;
}

export interface FollowUpSummaryResponse {
  open_count?: number;
  resolved_count?: number;
  total_count?: number;
  by_type?: FollowUpBucket[];
  [key: string]: unknown;
}

export interface FollowUpItem {
  id: string;
  target_type: "property" | "project" | "expense" | "document" | string;
  target_id?: string | null;
  property_id?: string | null;
  project_id?: string | null;
  expense_id?: string | null;
  document_id?: string | null;
  severity?: "missing_file" | "needs_review" | "missing_info" | "info" | string;
  reason_code?: string | null;
  title?: string | null;
  description?: string | null;
  action_label?: string | null;
  status?: "open" | "resolved" | string;
  source?: string | null;
  created_from?: string | null;
  resolved_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  [key: string]: unknown;
}

export interface DashboardResponse {
  workspace_id: string;
  generated_at: string;
  properties: DashboardCountSummary;
  projects: DashboardCountSummary & {
    by_status: ProjectStatusSummary[];
    open_follow_up_count: number;
  };
  expenses: {
    count: number;
    total_amount_cents: number;
    by_classification: ExpenseClassificationSummary[];
    review_later_count: number;
    possible_improvement_total_cents: number;
    repair_upkeep_total_cents: number;
  };
  documents: {
    count: number;
    with_file_count: number;
    missing_file_count: number;
    ocr_text_available_count: number;
    ocr_pending_count: number;
    by_type: DocumentTypeSummary[];
  };
  vendors: {
    count: number;
  };
  recent_activity: DashboardActivity[];
  follow_ups: FollowUpBucket[];
}

export interface PropertyRecord {
  id: string;
  name: string;
  display_address?: string | null;
  purchase_date?: string | null;
  purchase_price_cents?: number | null;
  currency_code?: string | null;
  notes?: string | null;
  is_primary?: boolean;
  archived_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  [key: string]: unknown;
}

export interface PropertyInput {
  name: string;
  display_address?: string | null;
  purchase_date?: string | null;
  purchase_price_cents?: number | null;
  currency_code?: string;
  notes?: string | null;
  is_primary?: boolean;
}

export type ProjectStatus = "planned" | "in_progress" | "blocked" | "completed" | "archived" | string;

export interface ProjectRecord {
  id: string;
  property_id: string;
  property_name?: string | null;
  vendor_id?: string | null;
  vendor_name?: string | null;
  name: string;
  category: string;
  status: ProjectStatus;
  start_date?: string | null;
  completion_date?: string | null;
  contractor_name_raw?: string | null;
  permit_number?: string | null;
  scope_summary?: string | null;
  notes?: string | null;
  completeness_override_note?: string | null;
  completeness_overridden_at?: string | null;
  open_item_count?: number;
  archived_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  [key: string]: unknown;
}

export interface ProjectInput {
  property_id: string;
  vendor_id?: string | null;
  name: string;
  category: string;
  status?: ProjectStatus;
  start_date?: string | null;
  completion_date?: string | null;
  contractor_name_raw?: string | null;
  permit_number?: string | null;
  scope_summary?: string | null;
  notes?: string | null;
  completeness_override_note?: string | null;
}

export type ExpenseRecordTreatment = "possible_improvement" | "repair_upkeep" | "review_later" | string;
export type ExpenseDocumentationStatus = "receipt_attached" | "invoice_attached" | "no_document_yet" | "needs_follow_up" | string;

export interface ExpenseRecord {
  id: string;
  property_id: string;
  property_name?: string | null;
  project_id?: string | null;
  project_name?: string | null;
  vendor_id?: string | null;
  vendor_name?: string | null;
  vendor_name_raw?: string | null;
  expense_date?: string | null;
  description: string;
  amount_cents: number;
  currency_code?: string | null;
  category: string;
  record_treatment: ExpenseRecordTreatment;
  documentation_status: ExpenseDocumentationStatus;
  notes?: string | null;
  document_count?: number;
  open_item_count?: number;
  deleted_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  [key: string]: unknown;
}

export interface ExpenseInput {
  property_id: string;
  project_id?: string | null;
  vendor_id?: string | null;
  vendor_name_raw?: string | null;
  expense_date?: string | null;
  description: string;
  amount_cents: number;
  currency_code?: string;
  category: string;
  record_treatment?: ExpenseRecordTreatment;
  documentation_status?: ExpenseDocumentationStatus;
  notes?: string | null;
}

export interface ApiEnvelope<T> {
  data?: T;
  error?: {
    code?: string;
    message?: string;
    requestId?: string;
    request_id?: string;
    details?: unknown[];
  };
}
