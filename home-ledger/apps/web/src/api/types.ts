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
