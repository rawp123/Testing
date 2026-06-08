import type { FollowUpBucket, FollowUpItem, FollowUpListStatus, FollowUpSummaryResponse } from "../api/types";
import type { FilterChip } from "../components/FilterPanel";
import { formatDate, titleCase, toInteger } from "../utils/format";

export interface FollowUpRow {
  id: string;
  title: string;
  description: string;
  actionLabel: string;
  severity: string;
  severityLabel: string;
  targetType: string;
  targetLabel: string;
  status: string;
  statusLabel: string;
  resolvedAt: string;
  source: FollowUpItem;
}

export function toFollowUpRows(items: FollowUpItem[]): FollowUpRow[] {
  return items
    .map((item) => {
      const status = String(item.status || "open");
      const severity = String(item.severity || "needs_review");
      const targetType = String(item.target_type || "record");
      return {
        id: String(item.id || ""),
        title: String(item.title || "Needs attention"),
        description: String(item.description || ""),
        actionLabel: String(item.action_label || (status === "resolved" ? "Reopen" : "Resolve")),
        severity,
        severityLabel: severityLabel(severity),
        targetType,
        targetLabel: targetTypeLabel(targetType),
        status,
        statusLabel: statusLabel(status),
        resolvedAt: item.resolved_at ? formatDate(item.resolved_at) : "",
        source: sanitizeFollowUpItem(item)
      };
    })
    .filter((row) => row.id && row.title)
    .sort(compareFollowUpRows);
}

export function filterFollowUpRows(rows: FollowUpRow[], {
  severity = "all",
  targetType = "all"
}: {
  severity?: string;
  targetType?: string;
}) {
  return rows.filter((row) =>
    (severity === "all" || row.severity === severity) &&
    (targetType === "all" || row.targetType === targetType)
  );
}

export function buildStatusFilterOptions(summary?: FollowUpSummaryResponse | null): FilterChip[] {
  const openCount = toInteger(summary?.open_count);
  const resolvedCount = toInteger(summary?.resolved_count);
  const totalCount = Number.isInteger(summary?.total_count)
    ? toInteger(summary?.total_count)
    : openCount + resolvedCount;
  return [
    { value: "open", label: "Open", count: openCount },
    { value: "resolved", label: "Resolved", count: resolvedCount },
    { value: "all", label: "All", count: totalCount }
  ];
}

export function buildSeverityFilterOptions(rows: FollowUpRow[]): FilterChip[] {
  const counts = new Map<string, number>();
  for (const row of rows) {
    counts.set(row.severity, (counts.get(row.severity) || 0) + 1);
  }
  return [
    { value: "all", label: "All types", count: rows.length },
    ...sortedBuckets([...counts.entries()].map(([value, count]) => ({
      value,
      label: severityLabel(value),
      count
    })))
  ];
}

export function buildTargetFilterOptions(rows: FollowUpRow[]): FilterChip[] {
  const counts = new Map<string, number>();
  for (const row of rows) {
    counts.set(row.targetType, (counts.get(row.targetType) || 0) + 1);
  }
  return [
    { value: "all", label: "All records", count: rows.length },
    ...sortedBuckets([...counts.entries()].map(([value, count]) => ({
      value,
      label: targetTypeLabel(value),
      count
    })))
  ];
}

export function summarizeFollowUps(summary?: FollowUpSummaryResponse | null) {
  return {
    open: toInteger(summary?.open_count),
    resolved: toInteger(summary?.resolved_count),
    total: Number.isInteger(summary?.total_count)
      ? toInteger(summary?.total_count)
      : toInteger(summary?.open_count) + toInteger(summary?.resolved_count),
    byType: sanitizeBuckets(summary?.by_type)
  };
}

export function applyFollowUpActionResult(rows: FollowUpRow[], nextItem: FollowUpItem, statusFilter: FollowUpListStatus): FollowUpRow[] {
  const nextRow = toFollowUpRows([nextItem])[0];
  if (!nextRow) return rows;
  if (statusFilter !== "all" && nextRow.status !== statusFilter) {
    return rows.filter((row) => row.id !== nextRow.id);
  }
  const replaced = rows.map((row) => row.id === nextRow.id ? nextRow : row);
  return replaced.some((row) => row.id === nextRow.id)
    ? replaced.sort(compareFollowUpRows)
    : [...replaced, nextRow].sort(compareFollowUpRows);
}

export function statusLabel(value: string) {
  if (value === "open") return "Open";
  if (value === "resolved") return "Resolved";
  return titleCase(value);
}

export function severityLabel(value: string) {
  if (value === "missing_file") return "Missing file";
  if (value === "needs_review") return "Needs review";
  if (value === "missing_info") return "Missing info";
  if (value === "info") return "Info";
  return titleCase(value);
}

export function targetTypeLabel(value: string) {
  if (value === "property") return "Property";
  if (value === "project") return "Project";
  if (value === "expense") return "Expense";
  if (value === "document") return "Document";
  return titleCase(value || "record");
}

function compareFollowUpRows(left: FollowUpRow, right: FollowUpRow) {
  return statusRank(left.status) - statusRank(right.status) ||
    severityRank(left.severity) - severityRank(right.severity) ||
    left.targetLabel.localeCompare(right.targetLabel) ||
    left.title.localeCompare(right.title) ||
    left.id.localeCompare(right.id);
}

function statusRank(status: string) {
  if (status === "open") return 0;
  if (status === "resolved") return 1;
  return 2;
}

function severityRank(severity: string) {
  if (severity === "missing_file") return 0;
  if (severity === "needs_review") return 1;
  if (severity === "missing_info") return 2;
  if (severity === "info") return 3;
  return 4;
}

function sortedBuckets(items: FilterChip[]) {
  return items.sort((left, right) => left.label.localeCompare(right.label) || left.value.localeCompare(right.value));
}

function sanitizeFollowUpItem(item: FollowUpItem): FollowUpItem {
  return {
    id: String(item.id || ""),
    target_type: String(item.target_type || "record"),
    target_id: item.target_id || null,
    property_id: item.property_id || null,
    project_id: item.project_id || null,
    expense_id: item.expense_id || null,
    document_id: item.document_id || null,
    severity: String(item.severity || "needs_review"),
    reason_code: item.reason_code || null,
    title: item.title || null,
    description: item.description || null,
    action_label: item.action_label || null,
    status: item.status || "open",
    source: item.source || "generated",
    created_from: item.created_from || "current_records",
    resolved_at: item.resolved_at || null,
    created_at: item.created_at || null,
    updated_at: item.updated_at || null
  };
}

function sanitizeBuckets(items: FollowUpBucket[] | undefined) {
  return Array.isArray(items)
    ? items.map((item) => ({
      type: String(item.type || ""),
      label: String(item.label || "Needs attention"),
      count: toInteger(item.count)
    })).filter((item) => item.count > 0)
    : [];
}
