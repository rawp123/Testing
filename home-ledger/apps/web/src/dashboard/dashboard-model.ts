import type {
  DashboardActivity,
  DashboardResponse,
  FollowUpBucket,
  FollowUpItem,
  FollowUpSummaryResponse,
  SessionResponse,
  WorkspaceMembership
} from "../api/types";
import { formatCents, formatDate, titleCase, toInteger } from "../utils/format";

const CLASSIFICATION_LABELS = Object.freeze({
  possible_improvement: "Possible improvements",
  repair_upkeep: "Repair or upkeep",
  review_later: "Review later"
});

const ACTIVITY_LABELS = Object.freeze({
  property: "Property",
  project: "Project",
  expense: "Expense",
  document: "Document"
});

export interface DashboardMetric {
  label: string;
  value: number | string;
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
  activityType: string;
  typeLabel: string;
  recordType: string;
  recordId: string;
  name: string;
  relatedTo: string;
  occurredAt: string;
  dateLabel: string;
  summary: string;
}

export interface DashboardActivityFilterOption {
  value: string;
  label: string;
  count: number;
}

export interface FollowUpRow {
  id: string;
  area: string;
  title: string;
  description: string;
  actionLabel: string;
  severity: string;
  targetType: string;
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
  activityFilterOptions: DashboardActivityFilterOption[];
  followUps: FollowUpBucket[];
  followUpItems: FollowUpRow[];
  openFollowUpCount: number;
  empty: boolean;
}

export function createDashboardViewModel({
  session,
  workspace,
  dashboard,
  followUps: rawFollowUps,
  followUpSummary
}: {
  session?: SessionResponse | null;
  workspace?: WorkspaceMembership | null;
  dashboard?: DashboardResponse | null;
  followUps?: FollowUpItem[] | null;
  followUpSummary?: FollowUpSummaryResponse | null;
}): DashboardViewModel {
  const safeDashboard = dashboard || emptyDashboard();
  const expenses = safeDashboard.expenses;
  const properties = safeDashboard.properties;
  const projects = safeDashboard.projects;
  const documents = safeDashboard.documents;
  const vendors = safeDashboard.vendors;
  const followUpBuckets = getFollowUps(safeDashboard, followUpSummary);

  const recentActivity = safeDashboard.recent_activity.map(toActivityRow);

  return {
    userName: session?.user?.displayName || session?.user?.email || "Signed-in user",
    workspaceName: workspace?.workspaceName || "Workspace",
    workspaceRole: workspace?.role || "",
    generatedAt: safeDashboard.generated_at || "",
    metrics: [
      metric("Properties", properties.active_count ?? properties.count ?? 0, "Active records", "#properties"),
      metric("Projects", projects.active_count ?? projects.count ?? 0, `${toInteger(projects.open_follow_up_count)} open items`, "#projects"),
      metric("Expenses", expenses.count ?? 0, `${formatCents(expenses.total_amount_cents)} total`, "#expenses"),
      metric("Total spend", formatCents(expenses.total_amount_cents), "Expense total", "#expenses"),
      metric("Documents", documents.count ?? 0, `${toInteger(documents.with_file_count)} with files`, "#documents")
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
      documentMetric("Files saved", documents.with_file_count ?? 0, "Saved files"),
      documentMetric("Missing files", documents.missing_file_count ?? 0, "Needs review"),
      documentMetric("Text extracted", documents.ocr_text_available_count ?? 0, "Text ready"),
      documentMetric("Text pending", documents.ocr_pending_count ?? 0, "In progress")
    ],
    recentActivity,
    activityFilterOptions: getActivityFilterOptions(recentActivity),
    followUps: followUpBuckets,
    followUpItems: getFollowUpRows(rawFollowUps),
    openFollowUpCount: getOpenFollowUpCount(followUpBuckets, followUpSummary),
    empty: isEmptyDashboard(safeDashboard)
  };
}

function metric(label: string, value: number | string, detail: string, href: string): DashboardMetric {
  return {
    label,
    value: typeof value === "number" ? toInteger(value) : value,
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
    activityType: String(item.activity_type || "activity"),
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

function getActivityFilterOptions(items: RecentActivityItem[]) {
  const counts = new Map<string, DashboardActivityFilterOption>();
  for (const item of items) {
    const existing = counts.get(item.activityType);
    counts.set(item.activityType, {
      value: item.activityType,
      label: item.typeLabel,
      count: (existing?.count || 0) + 1
    });
  }
  return [...counts.values()].sort((first, second) => {
    const labelCompare = first.label.localeCompare(second.label);
    if (labelCompare) return labelCompare;
    return first.value.localeCompare(second.value);
  });
}

function getFollowUpRows(items?: FollowUpItem[] | null): FollowUpRow[] {
  return Array.isArray(items)
    ? items
      .map((item) => ({
        id: String(item.id || ""),
        area: titleCase(item.target_type || "record"),
        title: String(item.title || "Needs review"),
        description: String(item.description || ""),
        actionLabel: String(item.action_label || "Review"),
        severity: titleCase(item.severity || "needs_review"),
        targetType: String(item.target_type || "")
      }))
      .filter((item) => item.id && item.title)
    : [];
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
      label: String(item.label || "Needs review"),
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
