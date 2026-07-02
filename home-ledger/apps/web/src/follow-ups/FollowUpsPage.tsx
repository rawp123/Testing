import { useEffect, useMemo, useState } from "react";
import type { HomeLedgerApiClient } from "../api/client";
import type { FollowUpItem, FollowUpListStatus, FollowUpSummaryResponse } from "../api/types";
import { authBoundaryMessage } from "../auth/session-model";
import { ActionBar } from "../components/ActionBar";
import { CompactRecordTable, type CompactRecordColumn } from "../components/CompactRecordTable";
import { EmptyState } from "../components/EmptyState";
import { FilterChipGroup, FilterPanel } from "../components/FilterPanel";
import { PageTitle } from "../components/PageTitle";
import { PanelHeader, WorkspacePanel } from "../components/WorkspacePanel";
import {
  applyFollowUpActionResult,
  buildSeverityFilterOptions,
  buildStatusFilterOptions,
  buildTargetFilterOptions,
  filterFollowUpRows,
  summarizeFollowUps,
  toFollowUpRows,
  type FollowUpRow
} from "./follow-up-model";

type FollowUpsState =
  | { status: "loading"; items: FollowUpItem[]; summary: FollowUpSummaryResponse | null }
  | { status: "ready"; items: FollowUpItem[]; summary: FollowUpSummaryResponse | null }
  | { status: "error"; items: FollowUpItem[]; summary: FollowUpSummaryResponse | null; message: string };

export function FollowUpsPage({
  client,
  workspaceId,
  workspaceName
}: {
  client: HomeLedgerApiClient;
  workspaceId: string;
  workspaceName: string;
}) {
  const [state, setState] = useState<FollowUpsState>({ status: "loading", items: [], summary: null });
  const [statusFilter, setStatusFilter] = useState<FollowUpListStatus>("open");
  const [severityFilter, setSeverityFilter] = useState("all");
  const [targetFilter, setTargetFilter] = useState("all");
  const [actionId, setActionId] = useState("");
  const [notice, setNotice] = useState("");

  const loadFollowUps = async (nextStatus = statusFilter) => {
    setState((current) => ({ status: "loading", items: current.items, summary: current.summary }));
    try {
      const [items, summary] = await Promise.all([
        client.getFollowUps(workspaceId, nextStatus),
        client.getFollowUpSummary(workspaceId)
      ]);
      setState({ status: "ready", items, summary });
    } catch {
      setState((current) => ({
        status: "error",
        items: current.items,
        summary: current.summary,
        message: "We couldn't load follow-ups."
      }));
    }
  };

  useEffect(() => {
    let cancelled = false;
    setState((current) => ({ status: "loading", items: current.items, summary: current.summary }));
    Promise.all([
      client.getFollowUps(workspaceId, statusFilter),
      client.getFollowUpSummary(workspaceId)
    ])
      .then(([items, summary]) => {
        if (!cancelled) setState({ status: "ready", items, summary });
      })
      .catch(() => {
        if (!cancelled) setState((current) => ({
          status: "error",
          items: current.items,
          summary: current.summary,
          message: "We couldn't load follow-ups."
        }));
      });
    return () => {
      cancelled = true;
    };
  }, [client, statusFilter, workspaceId]);

  const resolveFollowUp = async (row: FollowUpRow) => {
    setActionId(row.id);
    setNotice("");
    try {
      const updated = await client.resolveFollowUp(workspaceId, row.id);
      setState((current) => ({
        ...current,
        items: applyFollowUpActionResult(toFollowUpRows(current.items), updated, statusFilter).map((item) => item.source)
      }));
      await loadFollowUps(statusFilter);
    } catch (error) {
      setNotice(actionErrorMessage(error, "Follow-up could not be resolved."));
    } finally {
      setActionId("");
    }
  };

  const reopenFollowUp = async (row: FollowUpRow) => {
    setActionId(row.id);
    setNotice("");
    try {
      const updated = await client.reopenFollowUp(workspaceId, row.id);
      setState((current) => ({
        ...current,
        items: applyFollowUpActionResult(toFollowUpRows(current.items), updated, statusFilter).map((item) => item.source)
      }));
      await loadFollowUps(statusFilter);
    } catch (error) {
      setNotice(actionErrorMessage(error, "Follow-up could not be reopened."));
    } finally {
      setActionId("");
    }
  };

  const clearFilters = () => {
    setStatusFilter("open");
    setSeverityFilter("all");
    setTargetFilter("all");
  };

  return (
    <FollowUpsView
      actionId={actionId}
      errorMessage={state.status === "error" ? state.message : ""}
      items={state.items}
      loading={state.status === "loading"}
      notice={notice}
      onChangeSeverityFilter={setSeverityFilter}
      onChangeStatusFilter={(nextStatus) => {
        setStatusFilter(nextStatus);
        setSeverityFilter("all");
        setTargetFilter("all");
        setNotice("");
      }}
      onChangeTargetFilter={setTargetFilter}
      onClearFilters={clearFilters}
      onReopenFollowUp={reopenFollowUp}
      onResolveFollowUp={resolveFollowUp}
      severityFilter={severityFilter}
      statusFilter={statusFilter}
      summary={state.summary}
      targetFilter={targetFilter}
      workspaceName={workspaceName}
    />
  );
}

export function FollowUpsView({
  actionId = "",
  errorMessage = "",
  items,
  loading = false,
  notice = "",
  onChangeSeverityFilter,
  onChangeStatusFilter,
  onChangeTargetFilter,
  onClearFilters,
  onReopenFollowUp,
  onResolveFollowUp,
  severityFilter = "all",
  statusFilter = "open",
  summary,
  targetFilter = "all",
  workspaceName
}: {
  actionId?: string;
  errorMessage?: string;
  items: FollowUpItem[];
  loading?: boolean;
  notice?: string;
  onChangeSeverityFilter: (filter: string) => void;
  onChangeStatusFilter: (filter: FollowUpListStatus) => void;
  onChangeTargetFilter: (filter: string) => void;
  onClearFilters: () => void;
  onReopenFollowUp: (row: FollowUpRow) => void;
  onResolveFollowUp: (row: FollowUpRow) => void;
  severityFilter?: string;
  statusFilter?: FollowUpListStatus;
  summary?: FollowUpSummaryResponse | null;
  targetFilter?: string;
  workspaceName: string;
}) {
  const rows = useMemo(() => toFollowUpRows(items), [items]);
  const filteredRows = useMemo(() =>
    filterFollowUpRows(rows, { severity: severityFilter, targetType: targetFilter }),
  [rows, severityFilter, targetFilter]);
  const summaryCounts = useMemo(() => summarizeFollowUps(summary), [summary]);
  const statusOptions = useMemo(() => buildStatusFilterOptions(summary), [summary]);
  const severityOptions = useMemo(() => buildSeverityFilterOptions(rows), [rows]);
  const targetOptions = useMemo(() => buildTargetFilterOptions(rows), [rows]);

  const columns = useMemo<CompactRecordColumn<FollowUpRow>[]>(() => [
    {
      key: "area",
      header: "Record",
      render: (row) => <span className="pill">{row.targetLabel}</span>
    },
    {
      key: "title",
      header: "Issue",
      className: "record-name-cell",
      render: (row) => (
        <div className="record-stack">
          <strong>{row.title}</strong>
          <span>{row.description || row.severityLabel}</span>
        </div>
      )
    },
    { key: "severity", header: "Type", render: (row) => row.severityLabel },
    { key: "status", header: "Status", render: (row) => row.resolvedAt ? `${row.statusLabel} ${row.resolvedAt}` : row.statusLabel },
    {
      key: "action",
      header: "Action",
      align: "right",
      render: (row) => (
        <div className="row-actions">
          {row.status === "resolved" ? (
            <button disabled={actionId === row.id} onClick={() => onReopenFollowUp(row)} type="button">
              {actionId === row.id ? "Reopening" : "Reopen"}
            </button>
          ) : (
            <button disabled={actionId === row.id} onClick={() => onResolveFollowUp(row)} type="button">
              {actionId === row.id ? "Resolving" : row.actionLabel || "Resolve"}
            </button>
          )}
        </div>
      )
    }
  ], [actionId, onReopenFollowUp, onResolveFollowUp]);

  return (
    <div className="page-stack">
      <PageTitle meta={workspaceName} title="Follow-ups" />

      <ActionBar label="Follow-up summary">
        <div className="follow-up-summary-row" aria-label="Follow-up counts">
          <span><strong>{summaryCounts.open}</strong> open</span>
          <span><strong>{summaryCounts.resolved}</strong> resolved</span>
          <span><strong>{summaryCounts.total}</strong> total</span>
        </div>
      </ActionBar>

      <FilterPanel className="follow-ups-filter-panel" onClear={onClearFilters}>
        <FilterChipGroup
          label="Follow-up status"
          onChange={(value) => onChangeStatusFilter(value as FollowUpListStatus)}
          options={statusOptions}
          value={statusFilter}
        />
        <FilterChipGroup
          label="Follow-up type"
          onChange={onChangeSeverityFilter}
          options={severityOptions}
          value={severityFilter}
        />
        <FilterChipGroup
          label="Follow-up record type"
          onChange={onChangeTargetFilter}
          options={targetOptions}
          value={targetFilter}
        />
      </FilterPanel>

      <WorkspacePanel className="follow-ups-panel">
        <PanelHeader icon="!" title="Follow-ups" />
        {notice ? <div className="inline-error" role="alert">{notice}</div> : null}
        {errorMessage ? <div className="inline-error" role="alert">{errorMessage}</div> : null}
        {loading ? <p className="muted-copy">Loading follow-ups.</p> : null}
        {!loading && !rows.length ? (
          <EmptyState title={statusFilter === "resolved" ? "No resolved follow-ups" : "No open follow-ups"}>
            {statusFilter === "resolved" ? "Resolved follow-ups will appear here." : "Nothing needs review."}
          </EmptyState>
        ) : null}
        {!loading && rows.length > 0 && !filteredRows.length ? (
          <EmptyState title="No follow-ups for this filter">Clear filters to see all follow-ups in this view.</EmptyState>
        ) : null}
        {filteredRows.length ? (
          <CompactRecordTable
            className="follow-ups-table"
            columns={columns}
            getRowKey={(row) => row.id}
            rows={filteredRows}
          />
        ) : null}
      </WorkspacePanel>
    </div>
  );
}

function actionErrorMessage(error: unknown, fallback: string) {
  return authBoundaryMessage(error, fallback);
}
