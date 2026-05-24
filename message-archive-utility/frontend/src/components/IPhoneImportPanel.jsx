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
import React, { useEffect, useMemo, useState } from "react";

const STEP_DEFS = [
  {
    key: "locate",
    label: "Locate backup",
    detail: "Finds the message database, even if the manifest is damaged.",
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
  contacts_named: "Named contacts",
  conversation_participants_imported: "Participants",
  conversations_imported: "Conversations",
  copied_sms_db_path: "Copied sms.db",
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
  import.meta.env.VITE_DEFAULT_IPHONE_BACKUP_PATH || "";

export default function IPhoneImportPanel({
  request,
  onArchiveChanged,
  hasArchiveData = false,
  archiveStats = null,
  isArchiveStatsLoading = false,
}) {
  const [backupFolderPath, setBackupFolderPath] = useState(DEFAULT_BACKUP_FOLDER_PATH);
  const [copiedSmsDbPath, setCopiedSmsDbPath] = useState("");
  const [activeStep, setActiveStep] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const [backupCandidates, setBackupCandidates] = useState([]);
  const [backupCandidateStatus, setBackupCandidateStatus] = useState("");
  const [copiedSmsDbCandidates, setCopiedSmsDbCandidates] = useState([]);
  const [copiedSmsDbImportDir, setCopiedSmsDbImportDir] = useState("");
  const [copiedSmsDbStatus, setCopiedSmsDbStatus] = useState("");
  const [completedSteps, setCompletedSteps] = useState(new Set());
  const [isImportToolsOpen, setIsImportToolsOpen] = useState(!hasArchiveData);

  const canUseBackupPath = backupFolderPath.trim().length > 0;
  const canUseCopiedPath = copiedSmsDbPath.trim().length > 0;
  const isBusy = activeStep.length > 0;
  const shouldShowImportTools = !hasArchiveData || isImportToolsOpen;
  const selectedBackupCandidate = backupCandidates.find((candidate) => candidate.path === backupFolderPath);
  const selectedCopiedSmsDbCandidate = copiedSmsDbCandidates.find((candidate) => candidate.path === copiedSmsDbPath);
  const importableBackupCandidate = backupCandidates.find((candidate) => (
    candidate.sms_db_copyable || candidate.manifest_readable
  ));
  const canCopySmsDb = canUseBackupPath && completedSteps.has("locate");
  const canRunQuickImport = (canUseBackupPath || importableBackupCandidate) && !isBusy;
  const highestCompletedIndex = STEP_ORDER.reduce((highestIndex, key, index) => (
    completedSteps.has(key) ? index : highestIndex
  ), -1);

  useEffect(() => {
    setIsImportToolsOpen(!hasArchiveData);
  }, [hasArchiveData]);

  useEffect(() => {
    let isCurrent = true;

    async function loadBackupCandidates() {
      try {
        const data = await request("/import/iphone-backup/candidates");
        if (!isCurrent) return;
        const candidates = data.candidates || [];
        setBackupCandidates(candidates);
        if (!backupFolderPath.trim()) {
          setBackupFolderPath(data.default_path || candidates[0]?.path || "");
        }
        if (candidates.length && !data.default_path) {
          setBackupCandidateStatus("A backup folder was detected, but sms.db is not available to copy yet.");
        }
      } catch {
        if (isCurrent) setBackupCandidateStatus("");
      }
    }

    loadBackupCandidates();
    return () => {
      isCurrent = false;
    };
  }, []);

  useEffect(() => {
    let isCurrent = true;
    loadCopiedSmsDbCandidates({ isCurrent: () => isCurrent });
    return () => {
      isCurrent = false;
    };
  }, []);

  const summaryItems = useMemo(() => {
    if (!result) return [];
    if (result.imported) {
      return [
        "messages_imported",
        "contacts_imported",
        "conversations_imported",
        "attachment_files_copied",
        "copied_sms_db_path",
        "backup_folder_path",
      ]
        .filter((label) => Object.prototype.hasOwnProperty.call(result, label))
        .map((label) => ({
          label: formatResultLabel(label),
          value: formatResultValue(result[label]),
        }));
    }
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
    if (!canUseBackupPath && importableBackupCandidate) return "A backup was detected. Import it when you are ready.";
    if (!canUseBackupPath) return "Paste the local iPhone backup folder path to begin.";
    if (!completedSteps.has("locate")) return "Start by locating the SMS database entry.";
    if (!completedSteps.has("copy")) return "Copy sms.db into the app import folder.";
    if (!canUseCopiedPath) return "Copy sms.db or paste the copied database path.";
    if (!completedSteps.has("validate")) return "Validate the copied database.";
    if (!completedSteps.has("inspect")) return "Inspect metadata before importing.";
    if (!completedSteps.has("import")) return "Import messages into the local archive.";
    return "Import complete. Browse the updated archive.";
  }, [activeStep, canUseBackupPath, canUseCopiedPath, completedSteps, importableBackupCandidate, isBusy]);

  function updateBackupFolderPath(value) {
    setBackupFolderPath(value);
    setBackupCandidateStatus("");
    setError("");
    setStatus("");
    setResult(null);
    setCompletedSteps((current) => removeSteps(current, ["locate", "copy"]));
  }

  function updateCopiedSmsDbPath(value) {
    setCopiedSmsDbPath(value);
    setCopiedSmsDbStatus("");
    setError("");
    setStatus("");
    setResult(null);
    setCompletedSteps((current) => removeSteps(current, ["validate", "inspect", "import"]));
  }

  async function loadCopiedSmsDbCandidates({ isCurrent = () => true } = {}) {
    try {
      const data = await request("/import/iphone-backup/copied-sms-db-candidates");
      if (!isCurrent()) return;
      const candidates = data.candidates || [];
      setCopiedSmsDbCandidates(candidates);
      setCopiedSmsDbImportDir(data.import_dir || "");
      if (!copiedSmsDbPath.trim() && data.default_path) {
        setCopiedSmsDbPath(data.default_path);
        setCompletedSteps((current) => removeSteps(current, ["validate", "inspect", "import"]));
      }
      setCopiedSmsDbStatus(
        candidates.length
          ? `Found ${candidates.length} copied sms.db file${candidates.length === 1 ? "" : "s"}.`
          : `Copy sms.db into ${data.import_dir}, then refresh files.`,
      );
    } catch {
      if (isCurrent()) setCopiedSmsDbStatus("");
    }
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
    if (!data.sms_db_found) {
      setCompletedSteps((current) => removeSteps(current, ["locate", "copy", "validate", "inspect", "import"]));
      setStatus("");
      setError(
        "I could open the backup folder, but I could not find the message database file inside it.",
      );
      return;
    }
    setStatus(
      data.manifest_readable
        ? "Found sms.db in this backup."
        : "Manifest.db could not be read, but sms.db is available to copy directly.",
    );
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
    setStatus(
      data.manifest_readable === false
        ? "Copied sms.db directly from the backup into the app's private import folder."
        : "Copied sms.db into the app's private import folder.",
    );
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

  async function importDetectedBackup() {
    const body = backupFolderPath.trim()
      ? { backup_folder_path: backupFolderPath.trim() }
      : {};
    const data = await runStep("auto-import", () =>
      request("/import/iphone-backup/import-detected", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    );

    if (!data) return;
    setBackupFolderPath(data.backup_folder_path || backupFolderPath);
    setCopiedSmsDbPath(data.copied_sms_db_path || data.destination_path || "");
    setCompletedSteps(new Set(STEP_ORDER));
    const copiedText = data.attachment_files_copied
      ? ` Copied ${formatResultValue(data.attachment_files_copied)} attachment files.`
      : "";
    setStatus(`Imported ${formatResultValue(data.messages_imported || 0)} new messages from the detected backup.${copiedText}`);
    await loadCopiedSmsDbCandidates();
    onArchiveChanged();
  }

  const stepActions = {
    locate: {
      label: "Locate",
      onClick: locateBackup,
      disabled: !canUseBackupPath || isBusy,
      title: !canUseBackupPath ? STEP_DEFS[0].requirement : undefined,
      variant: "primary-button",
    },
    copy: {
      label: "Copy",
      onClick: copySmsDb,
      disabled: !canCopySmsDb || isBusy,
      title: !canUseBackupPath
        ? STEP_DEFS[1].requirement
        : !completedSteps.has("locate")
          ? "Locate a copyable sms.db first."
          : undefined,
      variant: "primary-button",
    },
    validate: {
      label: "Validate",
      onClick: validateSmsDb,
      disabled: !canUseCopiedPath || isBusy,
      title: !canUseCopiedPath ? STEP_DEFS[2].requirement : undefined,
      variant: "secondary-button",
    },
    inspect: {
      label: "Inspect",
      onClick: inspectSmsDb,
      disabled: !canUseCopiedPath || isBusy,
      title: !canUseCopiedPath ? STEP_DEFS[3].requirement : undefined,
      variant: "secondary-button",
    },
    import: {
      label: "Import",
      onClick: importMessages,
      disabled: !canUseCopiedPath || isBusy,
      title: !canUseCopiedPath ? STEP_DEFS[4].requirement : undefined,
      variant: "primary-button",
    },
  };

  return (
    <section className={`import-panel ${hasArchiveData ? "is-compact" : ""}`} aria-label="iPhone backup import">
      {hasArchiveData && (
        <ArchiveLoadedCard
          stats={archiveStats}
          isLoading={isArchiveStatsLoading}
          isImportToolsOpen={isImportToolsOpen}
          onToggleImportTools={() => setIsImportToolsOpen((isOpen) => !isOpen)}
        />
      )}

      {shouldShowImportTools && (
        <>
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

          <div className="quick-import-card">
            <div>
              <strong>Import detected backup</strong>
              <span>Automatically locate, copy, validate, inspect, and import the best available local iPhone backup.</span>
            </div>
            <button
              className="primary-button"
              type="button"
              onClick={importDetectedBackup}
              disabled={!canRunQuickImport}
              title={canRunQuickImport ? undefined : "Add or detect an importable backup folder first."}
            >
              Import backup
            </button>
          </div>

          <div className="import-grid">
            <label className="field">
              <span>Backup folder path</span>
              {backupCandidates.length > 0 && (
                <select
                  value={backupCandidates.some((candidate) => candidate.path === backupFolderPath) ? backupFolderPath : ""}
                  onChange={(event) => updateBackupFolderPath(event.target.value)}
                  aria-label="Detected backup folders"
                >
                  <option value="">Choose detected backup</option>
                  {backupCandidates.map((candidate) => (
                    <option key={candidate.path} value={candidate.path}>
                      {candidate.name} - {formatBackupCandidateStatus(candidate)}
                    </option>
                  ))}
                </select>
              )}
              <input
                value={backupFolderPath}
                onChange={(event) => updateBackupFolderPath(event.target.value)}
                placeholder="/Users/you/Library/Application Support/MobileSync/Backup/..."
              />
              <small>
                Choose the folder named like 00008120-00094D24146BC01E. The app server must be running on the same computer that can see this folder.
              </small>
              {backupCandidateStatus && <small className="field-warning">{backupCandidateStatus}</small>}
              {selectedBackupCandidate?.detail && (
                <small className={backupCandidateDetailClassName(selectedBackupCandidate)}>
                  {selectedBackupCandidate.detail}
                </small>
              )}
            </label>
            <label className="field">
              <span className="field-heading">
                Copied sms.db path
                <button
                  className="inline-text-button"
                  type="button"
                  onClick={() => loadCopiedSmsDbCandidates()}
                  disabled={isBusy}
                >
                  Refresh files
                </button>
              </span>
              {copiedSmsDbCandidates.length > 0 && (
                <select
                  value={copiedSmsDbCandidates.some((candidate) => candidate.path === copiedSmsDbPath) ? copiedSmsDbPath : ""}
                  onChange={(event) => updateCopiedSmsDbPath(event.target.value)}
                  aria-label="Copied sms.db files"
                >
                  <option value="">Choose copied sms.db</option>
                  {copiedSmsDbCandidates.map((candidate) => (
                    <option key={candidate.path} value={candidate.path}>
                      {candidate.name} - {candidate.valid ? "Ready" : "Needs review"}
                    </option>
                  ))}
                </select>
              )}
              <input
                value={copiedSmsDbPath}
                onChange={(event) => updateCopiedSmsDbPath(event.target.value)}
                placeholder="Filled after copy, or paste an app import path"
              />
              <small>
                Copy the hashed sms.db file here as sms_import_manual.db: {copiedSmsDbImportDir || "data/imports/iphone"}.
              </small>
              {copiedSmsDbStatus && <small>{copiedSmsDbStatus}</small>}
              {selectedCopiedSmsDbCandidate?.detail && (
                <small className={selectedCopiedSmsDbCandidate.valid ? "" : "field-warning"}>
                  {selectedCopiedSmsDbCandidate.detail}
                </small>
              )}
            </label>
          </div>

          <p className="privacy-note">
            Data stays on this device. The app copies only the message database into local private storage.
          </p>

          <ol className="step-list" aria-label="iPhone import steps">
            {STEP_DEFS.map(({ key, label, detail, icon: Icon }) => {
              const isComplete = completedSteps.has(key);
              const isActive = activeStep === key;
              const isReady = !isComplete && !isActive && STEP_ORDER.indexOf(key) <= highestCompletedIndex + 1;
              const action = stepActions[key];
              return (
                <li
                  className={`step-card ${isComplete ? "is-complete" : ""} ${isActive ? "is-active" : ""} ${isReady ? "is-ready" : ""}`}
                  key={key}
                >
                  <div className="step-copy">
                    <span className="step-icon">
                      {isActive ? <Loader2 className="spin" size={17} aria-hidden="true" /> : <Icon size={17} aria-hidden="true" />}
                    </span>
                    <span>
                      <strong>{label}</strong>
                      <small>{detail}</small>
                    </span>
                  </div>
                  <div className="step-status-row">
                    <span className="step-status">
                      {isActive ? "Running" : isComplete ? "Complete" : isReady ? "Ready" : "Waiting"}
                    </span>
                    <button
                      className={action.variant}
                      type="button"
                      onClick={action.onClick}
                      disabled={action.disabled}
                      title={action.title}
                    >
                      {action.label}
                    </button>
                    {isComplete && <CheckCircle2 className="step-complete-icon" size={17} aria-label="Complete" />}
                  </div>
                </li>
              );
            })}
          </ol>
        </>
      )}

      {shouldShowImportTools && (
        <>
          {status && <p className="success-state">{status}</p>}
          {error && (
            <div className="error-state" role="alert">
              <strong>{error}</strong>
              <ImportRecoveryHelp
                backupFolderPath={backupFolderPath}
                selectedBackupCandidate={selectedBackupCandidate}
              />
            </div>
          )}

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
        </>
      )}
    </section>
  );
}

function ImportRecoveryHelp({ backupFolderPath, selectedBackupCandidate }) {
  const detail = selectedBackupCandidate?.detail || "";
  const expectedFilePath = buildExpectedSmsDbPath(backupFolderPath);

  return (
    <div className="import-recovery">
      {detail && <p>{simplifyBackupDetail(detail)}</p>}
      <ol>
        <li>Confirm the path is the backup folder itself, not the Info window or a folder above it.</li>
        <li>Make sure this app is running on the computer that can access that folder.</li>
        <li>If the folder was copied from another drive, copy the whole backup folder again and wait for the copy to finish.</li>
      </ol>
      {expectedFilePath && (
        <p>
          Expected message file: <code>{expectedFilePath}</code>
        </p>
      )}
    </div>
  );
}

function buildExpectedSmsDbPath(backupFolderPath) {
  const trimmedPath = backupFolderPath.trim();
  if (!trimmedPath) return "";
  return `${trimmedPath.replace(/\/+$/, "")}/3d/3d0d7e5fb2ce288813306e4d4636395e047a3d28`;
}

function simplifyBackupDetail(detail) {
  if (detail.includes("truncated")) {
    return "The backup metadata file looks incomplete. The app will still try the direct message-file path, but Apple backups need both the metadata and hashed files to be fully copied.";
  }
  if (detail.includes("missing or empty")) {
    return "The standard hashed message file is missing or empty in this folder.";
  }
  return detail;
}

function ArchiveLoadedCard({ stats, isLoading, isImportToolsOpen, onToggleImportTools }) {
  const messages = stats?.messages || {};
  const conversations = stats?.conversations || {};

  const items = [
    { label: "Messages", value: formatResultValue(messages.total || 0) },
    { label: "Conversations", value: formatResultValue(conversations.total || 0) },
    { label: "Latest", value: formatArchiveDate(messages.latest_sent_at) },
  ];

  return (
    <section className="archive-loaded-card" aria-label="Loaded archive status">
      <div className="archive-loaded-main">
        <span className="archive-loaded-icon">
          <CheckCircle2 size={18} aria-hidden="true" />
        </span>
        <div>
          <p className="archive-loaded-status">
            {isLoading ? "Archive loaded, updating counts" : "Archive loaded"}
          </p>
          <p className="archive-loaded-note">Stored locally in private app storage on this device.</p>
        </div>
      </div>
      <div className="archive-loaded-safeguards" aria-label="Archive safeguards">
        <span className="privacy-badge">
          <LockKeyhole size={14} aria-hidden="true" />
          Private storage
        </span>
        <span className="privacy-badge">
          <ShieldCheck size={14} aria-hidden="true" />
          Local only
        </span>
      </div>
      <dl className="archive-loaded-stats">
        {items.map((item) => (
          <div key={item.label}>
            <dt>{item.label}</dt>
            <dd>{item.value}</dd>
          </div>
        ))}
      </dl>
      <button className="secondary-button" type="button" onClick={onToggleImportTools}>
        {isImportToolsOpen ? "Hide import tools" : "Manage import"}
      </button>
    </section>
  );
}

function removeSteps(currentSteps, stepKeys) {
  const nextSteps = new Set(currentSteps);
  stepKeys.forEach((stepKey) => nextSteps.delete(stepKey));
  return nextSteps;
}

function formatBackupCandidateStatus(candidate) {
  if (candidate.manifest_readable) return candidate.source;
  if (candidate.sms_db_copyable) return "sms.db available";
  return "Needs review";
}

function backupCandidateDetailClassName(candidate) {
  return candidate.manifest_readable || candidate.sms_db_copyable ? "" : "field-warning";
}

function formatResultLabel(label) {
  return RESULT_LABELS[label] || label.replaceAll("_", " ");
}

function formatResultValue(value) {
  if (typeof value === "number") return new Intl.NumberFormat().format(value);
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value);
}

function formatArchiveDate(value) {
  if (!value) return "No messages";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
}
