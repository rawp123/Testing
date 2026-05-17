import {
  CheckCircle2,
  ClipboardCheck,
  Database,
  FolderSearch,
  Import,
  Loader2,
  LockKeyhole,
  SearchCheck,
  ShieldCheck,
} from "lucide-react";
import React, { useMemo, useState } from "react";

const STEP_DEFS = [
  {
    key: "locate",
    label: "Locate backup",
    detail: "Finds the SMS database entry in Manifest.db.",
    icon: FolderSearch,
    requirement: "Add a backup folder path.",
  },
  {
    key: "copy",
    label: "Copy sms.db",
    detail: "Copies the message database into private local storage.",
    icon: Database,
    requirement: "Use the same backup folder path.",
  },
  {
    key: "validate",
    label: "Validate",
    detail: "Checks that the copied database has the expected tables.",
    icon: ClipboardCheck,
    requirement: "Copy sms.db or paste a copied path.",
  },
  {
    key: "inspect",
    label: "Inspect",
    detail: "Reads counts and date range without message bodies.",
    icon: ShieldCheck,
    requirement: "Validate the copied database first.",
  },
  {
    key: "import",
    label: "Import",
    detail: "Adds messages, conversations, contacts, and attachment metadata.",
    icon: Import,
    requirement: "Inspect first, then import.",
  },
];

const STEP_ORDER = STEP_DEFS.map((step) => step.key);

const RESULT_LABELS = {
  attachment: "Attachments",
  attachment_files_copied: "Files copied",
  attachments_imported: "Attachments",
  backup_folder_path: "Backup folder",
  chat: "Chats",
  chat_message_join: "Chat links",
  contacts_imported: "Contacts",
  conversation_participants_imported: "Participants",
  conversations_imported: "Conversations",
  destination_path: "Copied path",
  handle: "Handles",
  inspected: "Inspected",
  manifest_found: "Manifest found",
  message: "Messages",
  message_attachment_join: "Attachment links",
  message_attachment_links_imported: "Attachment links",
  messages_imported: "Messages",
  sms_db_found: "SMS database found",
  source_path: "Source path",
  valid: "Valid",
};

const DEFAULT_BACKUP_FOLDER_PATH =
  "/Users/robertparrish/Library/Application Support/MobileSync/Backup/00008120-00094D24146BC01E";

export default function IPhoneImportPanel({ request, onArchiveChanged }) {
  const [backupFolderPath, setBackupFolderPath] = useState(DEFAULT_BACKUP_FOLDER_PATH);
  const [copiedSmsDbPath, setCopiedSmsDbPath] = useState("");
  const [activeStep, setActiveStep] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const [completedSteps, setCompletedSteps] = useState(new Set());

  const canUseBackupPath = backupFolderPath.trim().length > 0;
  const canUseCopiedPath = copiedSmsDbPath.trim().length > 0;
  const isBusy = activeStep.length > 0;
  const highestCompletedIndex = STEP_ORDER.reduce((highestIndex, key, index) => (
    completedSteps.has(key) ? index : highestIndex
  ), -1);

  const summaryItems = useMemo(() => {
    if (!result) return [];
    if (result.row_counts) {
      return Object.entries(result.row_counts).map(([label, value]) => ({
        label: formatResultLabel(label),
        value: formatResultValue(value),
      }));
    }
    return Object.entries(result)
      .filter(([label, value]) => RESULT_LABELS[label] && ["string", "number", "boolean"].includes(typeof value))
      .slice(0, 6)
      .map(([label, value]) => ({
        label: formatResultLabel(label),
        value: formatResultValue(value),
      }));
  }, [result]);

  const nextAction = useMemo(() => {
    if (isBusy) {
      const step = STEP_DEFS.find((definition) => definition.key === activeStep);
      return step ? `${step.label} is running...` : "Working...";
    }
    if (!canUseBackupPath) return "Paste the local iPhone backup folder path to begin.";
    if (!completedSteps.has("locate")) return "Start by locating the SMS database entry.";
    if (!completedSteps.has("copy")) return "Copy sms.db into the app import folder.";
    if (!canUseCopiedPath) return "Copy sms.db or paste the copied database path.";
    if (!completedSteps.has("validate")) return "Validate the copied database.";
    if (!completedSteps.has("inspect")) return "Inspect metadata before importing.";
    if (!completedSteps.has("import")) return "Import messages into the local archive.";
    return "Import complete. Browse the updated archive.";
  }, [activeStep, canUseBackupPath, canUseCopiedPath, completedSteps, isBusy]);

  function updateBackupFolderPath(value) {
    setBackupFolderPath(value);
    setError("");
    setStatus("");
    setResult(null);
    setCompletedSteps((current) => removeSteps(current, ["locate", "copy"]));
  }

  function updateCopiedSmsDbPath(value) {
    setCopiedSmsDbPath(value);
    setError("");
    setStatus("");
    setResult(null);
    setCompletedSteps((current) => removeSteps(current, ["validate", "inspect", "import"]));
  }

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
    setStatus(data.sms_db_found ? "Found sms.db in this backup." : "No sms.db entry was found in this backup.");
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
    setStatus(data.valid ? "The copied database has the expected tables." : "The copied database is missing required tables.");
  }

  async function inspectSmsDb() {
    const data = await runStep("inspect", () =>
      request("/import/iphone-backup/inspect-sms-db", {
        method: "POST",
        body: JSON.stringify({ copied_sms_db_path: copiedSmsDbPath.trim() }),
      }),
    );

    if (!data) return;
    setStatus(data.inspected ? "Metadata inspection completed without reading message bodies." : "Metadata inspection could not be completed.");
  }

  async function importMessages() {
    const body = {
      copied_sms_db_path: copiedSmsDbPath.trim(),
      ...(canUseBackupPath ? { backup_folder_path: backupFolderPath.trim() } : {}),
    };
    const data = await runStep("import", () =>
      request("/import/iphone-backup/import-messages", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    );

    if (!data) return;
    const copiedText = data.attachment_files_copied
      ? ` Copied ${formatResultValue(data.attachment_files_copied)} attachment files.`
      : "";
    setStatus(`Imported ${formatResultValue(data.messages_imported || 0)} new messages into the local archive.${copiedText}`);
    onArchiveChanged();
  }

  return (
    <section className="import-panel" aria-label="iPhone backup import">
      <header className="panel-header">
        <div>
          <p className="eyebrow">Import</p>
          <h2>iPhone backup</h2>
        </div>
        <div className="panel-badges" aria-label="Import safeguards">
          <span className="privacy-badge">
            <LockKeyhole size={16} aria-hidden="true" />
            Private storage
          </span>
          <span className="privacy-badge">
            <ShieldCheck size={16} aria-hidden="true" />
            Local only
          </span>
        </div>
      </header>

      <div className="import-status-card">
        <SearchCheck size={18} aria-hidden="true" />
        <p>{nextAction}</p>
      </div>

      <div className="import-grid">
        <label className="field">
          <span>Backup folder path</span>
          <input
            value={backupFolderPath}
            onChange={(event) => updateBackupFolderPath(event.target.value)}
            placeholder="/Users/you/Library/Application Support/MobileSync/Backup/..."
          />
          <small>Finder backups usually live in MobileSync/Backup on the same machine.</small>
        </label>
        <label className="field">
          <span>Copied sms.db path</span>
          <input
            value={copiedSmsDbPath}
            onChange={(event) => updateCopiedSmsDbPath(event.target.value)}
            placeholder="Filled after copy, or paste an app import path"
          />
          <small>Generated after the copy step, or paste a file from data/imports/iphone.</small>
        </label>
      </div>

      <ol className="step-list" aria-label="iPhone import steps">
        {STEP_DEFS.map(({ key, label, detail, icon: Icon }) => {
          const isComplete = completedSteps.has(key);
          const isActive = activeStep === key;
          const isReady = !isComplete && !isActive && STEP_ORDER.indexOf(key) <= highestCompletedIndex + 1;
          return (
            <li
              className={`step-card ${isComplete ? "is-complete" : ""} ${isActive ? "is-active" : ""} ${isReady ? "is-ready" : ""}`}
              key={key}
            >
              <span className="step-icon">
                {isActive ? <Loader2 className="spin" size={17} aria-hidden="true" /> : <Icon size={17} aria-hidden="true" />}
              </span>
              <span>
                <strong>{label}</strong>
                <small>{detail}</small>
              </span>
              {isComplete && <CheckCircle2 className="step-complete-icon" size={17} aria-label="Complete" />}
            </li>
          );
        })}
      </ol>

      <div className="button-row">
        <button
          className="primary-button"
          type="button"
          onClick={locateBackup}
          disabled={!canUseBackupPath || isBusy}
          title={!canUseBackupPath ? STEP_DEFS[0].requirement : undefined}
        >
          Locate
        </button>
        <button
          className="primary-button"
          type="button"
          onClick={copySmsDb}
          disabled={!canUseBackupPath || isBusy}
          title={!canUseBackupPath ? STEP_DEFS[1].requirement : undefined}
        >
          Copy sms.db
        </button>
        <button
          className="secondary-button"
          type="button"
          onClick={validateSmsDb}
          disabled={!canUseCopiedPath || isBusy}
          title={!canUseCopiedPath ? STEP_DEFS[2].requirement : undefined}
        >
          Validate
        </button>
        <button
          className="secondary-button"
          type="button"
          onClick={inspectSmsDb}
          disabled={!canUseCopiedPath || isBusy}
          title={!canUseCopiedPath ? STEP_DEFS[3].requirement : undefined}
        >
          Inspect
        </button>
        <button
          className="primary-button"
          type="button"
          onClick={importMessages}
          disabled={!canUseCopiedPath || isBusy}
          title={!canUseCopiedPath ? STEP_DEFS[4].requirement : undefined}
        >
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

function removeSteps(currentSteps, stepKeys) {
  const nextSteps = new Set(currentSteps);
  stepKeys.forEach((stepKey) => nextSteps.delete(stepKey));
  return nextSteps;
}

function formatResultLabel(label) {
  return RESULT_LABELS[label] || label.replaceAll("_", " ");
}

function formatResultValue(value) {
  if (typeof value === "number") return new Intl.NumberFormat().format(value);
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value);
}
