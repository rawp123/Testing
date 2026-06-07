import type {
  DashboardActivity,
  DashboardResponse,
  FollowUpBucket,
  FollowUpSummaryResponse,
  SessionResponse,
  WorkspaceMembership
} from "../api/types";
import { formatCents, formatDate, titleCase, toInteger } from "../utils/format";

const CLASSIFICATION_LABELS = Object.freeze({
  possible_improvement: "Possible improvements",
  repair_upkeep: "Repair / upkeep",
  review_later: "Not sure, review later"
});

const ACTIVITY_LABELS = Object.freeze({
  property: "Property",
  project: "Project",
  expense: "Expense",
  document: "Document"
});

export interface DashboardMetric {
  label: string;
  value: number;
  detail: string;
  href: string;
}

export interface ExpenseBreakdownItem {
  label: string;
  amount: string;
  count: number;
}

export interface DocumentSummaryItem {
  label: string;
  value: number;
  detail: string;
}

export interface RecentActivityItem {
  typeLabel: string;
  recordType: string;
  recordId: string;
  name: string;
  relatedTo: string;
  occurredAt: string;
  dateLabel: string;
  summary: string;
}

export interface DashboardViewModel {
  userName: string;
  workspaceName: string;
  workspaceRole: string;
  generatedAt: string;
  metrics: DashboardMetric[];
  expenseBreakdown: ExpenseBreakdownItem[];
  documentSummary: DocumentSummaryItem[];
  recentActivity: RecentActivityItem[];
  followUps: FollowUpBucket[];
  openFollowUpCount: number;
  empty: boolean;
}

export function createDashboardViewModel({
  session,
  workspace,
  dashboard,
  followUpSummary
}: {
  session?: SessionResponse | null;
  workspace?: WorkspaceMembership | null;
  dashboard?: DashboardResponse | null;
  followUpSummary?: FollowUpSummaryResponse | null;
}): DashboardViewModel {
  const safeDashboard = dashboard || emptyDashboard();
  const expenses = safeDashboard.expenses;
  const properties = safeDashboard.properties;
  const projects = safeDashboard.projects;
  const documents = safeDashboard.documents;
  const vendors = safeDashboard.vendors;
  const followUps = getFollowUps(safeDashboard, followUpSummary);

  return {
    userName: session?.user?.displayName || session?.user?.email || "Signed-in user",
    workspaceName: workspace?.workspaceName || "Workspace",
    workspaceRole: workspace?.role || "",
    generatedAt: safeDashboard.generated_at || "",
    metrics: [
      metric("Properties", properties.active_count ?? properties.count ?? 0, "Active records", "#properties"),
      metric("Projects", projects.active_count ?? projects.count ?? 0, `${toInteger(projects.open_follow_up_count)} open items`, "#projects"),
      metric("Expenses", expenses.count ?? 0, formatCents(expenses.total_amount_cents), "#expenses"),
      metric("Documents", documents.count ?? 0, `${toInteger(documents.with_file_count)} with files`, "#documents"),
      metric("Vendors", vendors.count ?? 0, "Active vendors", "#vendors")
    ],
    expenseBreakdown: [
      {
        label: CLASSIFICATION_LABELS.possible_improvement,
        amount: formatCents(expenses.possible_improvement_total_cents),
        count: countForClassification(expenses.by_classification, "possible_improvement")
      },
      {
        label: CLASSIFICATION_LABELS.repair_upkeep,
        amount: formatCents(expenses.repair_upkeep_total_cents),
        count: countForClassification(expenses.by_classification, "repair_upkeep")
      },
      {
        label: CLASSIFICATION_LABELS.review_later,
        amount: formatCents(amountForClassification(expenses.by_classification, "review_later")),
        count: toInteger(expenses.review_later_count)
      }
    ],
    documentSummary: [
      documentMetric("Files attached", documents.with_file_count ?? 0, "Available files"),
      documentMetric("Missing files", documents.missing_file_count ?? 0, "Needs attention"),
      documentMetric("OCR available", documents.ocr_text_available_count ?? 0, "Text ready"),
      documentMetric("OCR pending", documents.ocr_pending_count ?? 0, "In progress")
    ],
    recentActivity: safeDashboard.recent_activity.map(toActivityRow),
    followUps,
    openFollowUpCount: getOpenFollowUpCount(followUps, followUpSummary),
    empty: isEmptyDashboard(safeDashboard)
  };
}

function metric(label: string, value: number, detail: string, href: string): DashboardMetric {
  return {
    label,
    value: toInteger(value),
    detail,
    href
  };
}

function documentMetric(label: string, value: number, detail: string): DocumentSummaryItem {
  return {
    label,
    value: toInteger(value),
    detail
  };
}

function toActivityRow(item: DashboardActivity): RecentActivityItem {
  return {
    typeLabel: ACTIVITY_LABELS[item.activity_type as keyof typeof ACTIVITY_LABELS] || titleCase(item.activity_type || "activity"),
    recordType: String(item.record_type || item.activity_type || ""),
    recordId: String(item.record_id || ""),
    name: String(item.record_name || item.summary || "Untitled record"),
    relatedTo: [item.property_name, item.project_name].filter(Boolean).join(" · "),
    occurredAt: item.occurred_at || "",
    dateLabel: formatDate(item.occurred_at),
    summary: activitySummary(item)
  };
}

function activitySummary(item: DashboardActivity) {
  if (item.activity_type === "expense" && Number.isInteger(item.amount_cents)) {
    return formatCents(item.amount_cents);
  }
  if (item.activity_type === "document") {
    return [titleCase(item.document_type || "document"), titleCase(item.file_availability || "")].filter(Boolean).join(" · ");
  }
  if (item.activity_type === "project" && item.status) {
    return titleCase(item.status);
  }
  return String(item.summary || "");
}

function countForClassification(items: DashboardResponse["expenses"]["by_classification"], classification: string) {
  return toInteger(items.find((item) => item.record_treatment === classification)?.count);
}

function amountForClassification(items: DashboardResponse["expenses"]["by_classification"], classification: string) {
  return toInteger(items.find((item) => item.record_treatment === classification)?.total_amount_cents);
}

function getFollowUps(dashboard: DashboardResponse, followUpSummary?: FollowUpSummaryResponse | null) {
  const source = Array.isArray(followUpSummary?.by_type) && followUpSummary.by_type.length
    ? followUpSummary.by_type
    : dashboard.follow_ups;
  return source
    .map((item) => ({
      type: String(item.type || ""),
      label: String(item.label || "Needs attention"),
      count: toInteger(item.count)
    }))
    .filter((item) => item.count > 0);
}

function getOpenFollowUpCount(followUps: FollowUpBucket[], followUpSummary?: FollowUpSummaryResponse | null) {
  const openCount = followUpSummary?.open_count;
  if (Number.isInteger(openCount)) {
    return openCount as number;
  }
  return followUps.reduce((total, item) => total + toInteger(item.count), 0);
}

function isEmptyDashboard(dashboard: DashboardResponse) {
  return !toInteger(dashboard.properties?.count) &&
    !toInteger(dashboard.projects?.count) &&
    !toInteger(dashboard.expenses?.count) &&
    !toInteger(dashboard.documents?.count);
}

function emptyDashboard(): DashboardResponse {
  return {
    workspace_id: "",
    generated_at: "",
    properties: { count: 0, active_count: 0, archived_count: 0 },
    projects: { count: 0, active_count: 0, archived_count: 0, by_status: [], open_follow_up_count: 0 },
    expenses: {
      count: 0,
      total_amount_cents: 0,
      by_classification: [],
      review_later_count: 0,
      possible_improvement_total_cents: 0,
      repair_upkeep_total_cents: 0
    },
    documents: {
      count: 0,
      with_file_count: 0,
      missing_file_count: 0,
      ocr_text_available_count: 0,
      ocr_pending_count: 0,
      by_type: []
    },
    vendors: { count: 0 },
    recent_activity: [],
    follow_ups: []
  };
}
