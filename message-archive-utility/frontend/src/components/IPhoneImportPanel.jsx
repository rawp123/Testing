import { CheckCircle2, ClipboardCheck, Database, FolderSearch, Import, Loader2, ShieldCheck } from "lucide-react";
import React, { useMemo, useState } from "react";

const STEP_DEFS = [
  { key: "locate", label: "Locate", icon: FolderSearch },
  { key: "copy", label: "Copy", icon: Database },
  { key: "validate", label: "Validate", icon: ClipboardCheck },
  { key: "inspect", label: "Inspect", icon: ShieldCheck },
  { key: "import", label: "Import", icon: Import },
];

export default function IPhoneImportPanel({ request, onArchiveChanged }) {
  const [backupFolderPath, setBackupFolderPath] = useState("");
  const [copiedSmsDbPath, setCopiedSmsDbPath] = useState("");
  const [activeStep, setActiveStep] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const [completedSteps, setCompletedSteps] = useState(new Set());

  const canUseBackupPath = backupFolderPath.trim().length > 0;
  const canUseCopiedPath = copiedSmsDbPath.trim().length > 0;
  const isBusy = activeStep.length > 0;

  const summaryItems = useMemo(() => {
    if (!result) return [];
    if (result.row_counts) {
      return Object.entries(result.row_counts).map(([label, value]) => ({
        label: label.replaceAll("_", " "),
        value,
      }));
    }
    return Object.entries(result)
      .filter(([, value]) => ["string", "number", "boolean"].includes(typeof value))
      .slice(0, 6)
      .map(([label, value]) => ({
        label: label.replaceAll("_", " "),
        value: String(value),
      }));
  }, [result]);

  async function runStep(step, action) {
    setActiveStep(step);
    setStatus("");
    setError("");
    try {
      const data = await action();
      setResult(data);
      setCompletedSteps((current) => new Set(current).add(step));
      return data;
    } catch (requestError) {
      setError(requestError.message);
      return null;
    } finally {
      setActiveStep("");
    }
  }

  async function locateBackup() {
    const data = await runStep("locate", () =>
      request("/import/iphone-backup/dry-run", {
        method: "POST",
        body: JSON.stringify({ backup_folder_path: backupFolderPath.trim() }),
      }),
    );

    if (!data) return;
    setStatus(data.sms_db_found ? "Found the SMS database in this backup." : "This backup did not include an SMS database entry.");
  }

  async function copySmsDb() {
    const data = await runStep("copy", () =>
      request("/import/iphone-backup/copy-sms-db", {
        method: "POST",
        body: JSON.stringify({ backup_folder_path: backupFolderPath.trim() }),
      }),
    );

    if (!data) return;
    setCopiedSmsDbPath(data.destination_path || "");
    setStatus("Copied sms.db into the app's private import folder.");
  }

  async function validateSmsDb() {
    const data = await runStep("validate", () =>
      request("/import/iphone-backup/validate-sms-db", {
        method: "POST",
        body: JSON.stringify({ copied_sms_db_path: copiedSmsDbPath.trim() }),
      }),
    );

    if (!data) return;
    setStatus(data.valid ? "The copied database has the expected message tables." : "The copied database is missing required tables.");
  }

  async function inspectSmsDb() {
    const data = await runStep("inspect", () =>
      request("/import/iphone-backup/inspect-sms-db", {
        method: "POST",
        body: JSON.stringify({ copied_sms_db_path: copiedSmsDbPath.trim() }),
      }),
    );

    if (!data) return;
    setStatus(data.valid ? "Metadata inspection completed without reading message bodies." : "Metadata inspection could not be completed.");
  }

  async function importMessages() {
    const data = await runStep("import", () =>
      request("/import/iphone-backup/import-messages", {
        method: "POST",
        body: JSON.stringify({ copied_sms_db_path: copiedSmsDbPath.trim() }),
      }),
    );

    if (!data) return;
    setStatus(`Imported ${data.messages_imported || 0} new messages into the local archive.`);
    onArchiveChanged();
  }

  return (
    <section className="import-panel" aria-label="iPhone backup import">
      <header className="panel-header">
        <div>
          <p className="eyebrow">Import</p>
          <h2>iPhone backup</h2>
        </div>
        <span className="privacy-badge">
          <ShieldCheck size={16} aria-hidden="true" />
          Local only
        </span>
      </header>

      <div className="import-grid">
        <label className="field">
          <span>Backup folder path</span>
          <input
            value={backupFolderPath}
            onChange={(event) => setBackupFolderPath(event.target.value)}
            placeholder="/Users/you/Library/Application Support/MobileSync/Backup/..."
          />
          <small>The folder must be readable by the backend process running this app.</small>
        </label>
        <label className="field">
          <span>Copied sms.db path</span>
          <input
            value={copiedSmsDbPath}
            onChange={(event) => setCopiedSmsDbPath(event.target.value)}
            placeholder="Filled after copy, or paste an app import path"
          />
          <small>Use the generated path after copying, then validate before importing.</small>
        </label>
      </div>

      <div className="step-row">
        {STEP_DEFS.map(({ key, label, icon: Icon }) => {
          const isComplete = completedSteps.has(key);
          const isActive = activeStep === key;
          return (
            <div className={`step-pill ${isComplete ? "is-complete" : ""} ${isActive ? "is-active" : ""}`} key={key}>
              {isActive ? <Loader2 className="spin" size={16} aria-hidden="true" /> : <Icon size={16} aria-hidden="true" />}
              <span>{label}</span>
              {isComplete && <CheckCircle2 size={15} aria-label="Complete" />}
            </div>
          );
        })}
      </div>

      <div className="button-row">
        <button className="primary-button" type="button" onClick={locateBackup} disabled={!canUseBackupPath || isBusy}>
          Locate
        </button>
        <button className="primary-button" type="button" onClick={copySmsDb} disabled={!canUseBackupPath || isBusy}>
          Copy sms.db
        </button>
        <button className="secondary-button" type="button" onClick={validateSmsDb} disabled={!canUseCopiedPath || isBusy}>
          Validate
        </button>
        <button className="secondary-button" type="button" onClick={inspectSmsDb} disabled={!canUseCopiedPath || isBusy}>
          Inspect
        </button>
        <button className="primary-button" type="button" onClick={importMessages} disabled={!canUseCopiedPath || isBusy}>
          Import messages
        </button>
      </div>

      {status && <p className="success-state">{status}</p>}
      {error && <p className="error-state">{error}</p>}

      {summaryItems.length > 0 && (
        <dl className="result-grid">
          {summaryItems.map((item) => (
            <div key={item.label}>
              <dt>{item.label}</dt>
              <dd>{item.value}</dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  );
}
