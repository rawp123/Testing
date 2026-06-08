import { useEffect, useState } from "react";
import type { HomeLedgerApiClient } from "../api/client";
import type { ExportDownloadResponse, ExportSummaryResponse } from "../api/types";
import { ActionBar } from "../components/ActionBar";
import { CompactRecordTable, type CompactRecordColumn } from "../components/CompactRecordTable";
import { EmptyState } from "../components/EmptyState";
import { FilterPanel } from "../components/FilterPanel";
import { PageTitle } from "../components/PageTitle";
import { PanelHeader, WorkspacePanel } from "../components/WorkspacePanel";
import {
  EXPORT_OPTION_ROWS,
  generatedAtLabel,
  toExportSummaryMetrics,
  type ExportKind,
  type ExportOptionRow
} from "./export-model";

type ExportsState =
  | { status: "loading"; summary: ExportSummaryResponse | null; message?: never }
  | { status: "ready"; summary: ExportSummaryResponse; message?: never }
  | { status: "error"; summary: ExportSummaryResponse | null; message: string };

export function ExportsPage({
  client,
  workspaceId,
  workspaceName
}: {
  client: HomeLedgerApiClient;
  workspaceId: string;
  workspaceName: string;
}) {
  const [state, setState] = useState<ExportsState>({ status: "loading", summary: null });
  const [downloadKind, setDownloadKind] = useState<ExportKind | null>(null);
  const [downloadMessage, setDownloadMessage] = useState("");

  const loadSummary = async () => {
    setState((current) => ({ status: "loading", summary: current.summary }));
    setDownloadMessage("");
    try {
      const summary = await client.getExportSummary(workspaceId);
      setState({ status: "ready", summary });
    } catch {
      setState((current) => ({
        status: "error",
        summary: current.summary,
        message: "Export summary could not be loaded."
      }));
    }
  };

  useEffect(() => {
    void loadSummary();
  }, [client, workspaceId]);

  const downloadExport = async (kind: ExportKind) => {
    setDownloadKind(kind);
    setDownloadMessage("");
    try {
      const response = await downloadByKind(client, workspaceId, kind);
      saveBlob(response);
      setDownloadMessage(`${response.file_name} is downloading.`);
    } catch {
      setDownloadMessage("Export could not be downloaded.");
    } finally {
      setDownloadKind(null);
    }
  };

  return (
    <ExportsView
      downloadKind={downloadKind}
      downloadMessage={downloadMessage}
      errorMessage={state.status === "error" ? state.message : ""}
      loading={state.status === "loading"}
      onDownload={downloadExport}
      onRefresh={loadSummary}
      summary={state.summary}
      workspaceName={workspaceName}
    />
  );
}

export function ExportsView({
  downloadKind = null,
  downloadMessage = "",
  errorMessage = "",
  loading = false,
  onDownload,
  onRefresh,
  summary,
  workspaceName
}: {
  downloadKind?: ExportKind | null;
  downloadMessage?: string;
  errorMessage?: string;
  loading?: boolean;
  onDownload: (kind: ExportKind) => void;
  onRefresh: () => void;
  summary: ExportSummaryResponse | null;
  workspaceName: string;
}) {
  const metrics = toExportSummaryMetrics(summary);
  return (
    <div className="page-stack">
      <PageTitle
        title="Export records"
        meta={`${workspaceName} · ${generatedAtLabel(summary)}`}
        actions={(
          <ActionBar label="Export actions">
            <button className="button button-secondary" onClick={onRefresh} type="button">
              Refresh summary
            </button>
          </ActionBar>
        )}
      />

      {errorMessage ? <div className="inline-error">{errorMessage}</div> : null}

      <WorkspacePanel className="exports-summary-panel">
        <PanelHeader icon="↓" title="Export summary" />
        {loading && !summary ? (
          <EmptyState title="Loading export summary">Checking the records available for export.</EmptyState>
        ) : null}
        {summary ? (
          <div className="export-summary-grid" aria-label="Export summary">
            {metrics.map((metric) => (
              <div className="export-summary-metric" key={metric.label}>
                <span>{metric.label}</span>
                <strong>{metric.value}</strong>
                <small>{metric.detail}</small>
              </div>
            ))}
          </div>
        ) : null}
      </WorkspacePanel>

      <FilterPanel title="Scope">
        <span>Workspace-wide exports are available. Property and project-specific exports are not connected yet.</span>
      </FilterPanel>

      <WorkspacePanel>
        <PanelHeader icon="▤" title="Available exports" />
        <CompactRecordTable
          className="exports-table"
          columns={exportColumns({ downloadKind, onDownload })}
          getRowKey={(row) => row.id}
          rows={EXPORT_OPTION_ROWS}
        />
        {downloadMessage ? <p className="muted-copy export-download-message">{downloadMessage}</p> : null}
      </WorkspacePanel>
    </div>
  );
}

function exportColumns({
  downloadKind,
  onDownload
}: {
  downloadKind: ExportKind | null;
  onDownload: (kind: ExportKind) => void;
}): CompactRecordColumn<ExportOptionRow>[] {
  return [
    {
      key: "name",
      header: "Export",
      className: "record-name-cell",
      render: (row) => (
        <div className="record-stack">
          <strong>{row.name}</strong>
          <span>{row.status === "available" ? "Available download" : "Not available yet"}</span>
        </div>
      )
    },
    {
      key: "includes",
      header: "Includes",
      render: (row) => row.includes
    },
    {
      key: "format",
      header: "Format",
      render: (row) => <span className="pill">{row.format}</span>
    },
    {
      key: "status",
      header: "Status",
      render: (row) => row.status === "available" ? "Ready" : "Unsupported"
    },
    {
      key: "actions",
      header: "Actions",
      align: "right",
      render: (row) => (
        <div className="row-actions">
          <button
            disabled={!row.kind || downloadKind === row.kind}
            onClick={() => {
              if (row.kind) onDownload(row.kind);
            }}
            type="button"
          >
            {row.kind && downloadKind === row.kind ? "Downloading" : row.actionLabel}
          </button>
        </div>
      )
    }
  ];
}

async function downloadByKind(client: HomeLedgerApiClient, workspaceId: string, kind: ExportKind) {
  if (kind === "expenses_csv") return client.downloadExpensesCsv(workspaceId);
  if (kind === "documents_csv") return client.downloadDocumentsCsv(workspaceId);
  return client.downloadFullJsonExport(workspaceId);
}

function saveBlob(response: ExportDownloadResponse) {
  const url = globalThis.URL?.createObjectURL?.(response.blob);
  if (!url) return;
  const link = globalThis.document.createElement("a");
  link.href = url;
  link.download = response.file_name;
  link.rel = "noopener";
  globalThis.document.body.append(link);
  link.click();
  link.remove();
  globalThis.URL.revokeObjectURL(url);
}
