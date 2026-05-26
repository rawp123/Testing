import {
  CheckCircle2,
  Import,
  Loader2,
  LockKeyhole,
  SearchCheck,
  ShieldCheck,
} from "lucide-react";
import React, { useEffect, useMemo, useState } from "react";

const STEP_ORDER = ["locate", "copy", "validate", "inspect", "import"];

const RESULT_LABELS = {
  attachment: "Attachments",
  attachment_files_copied: "Files copied",
  attachments_imported: "Attachments",
  backup_appears_encrypted: "Encrypted",
  backup_appears_incomplete: "Incomplete",
  backup_folder_path: "Backup folder",
  backup_folder_exists: "Folder exists",
  backup_folder_is_directory: "Folder is directory",
  chat: "Chats",
  chat_message_join: "Chat links",
  contacts_imported: "Contacts",
  contacts_named: "Named contacts",
  conversation_participants_imported: "Participants",
  conversations_imported: "Conversations",
  copied_sms_db_path: "Local message copy",
  destination_path: "Local message copy",
  handle: "Handles",
  inspected: "Inspected",
  manifest_appears_truncated: "Manifest truncated",
  manifest_found: "Backup index found",
  manifest_exists: "Backup index found",
  manifest_readable_sqlite: "Backup index readable",
  message: "Messages",
  message_attachment_join: "Attachment links",
  message_attachment_links_imported: "Attachment links",
  messages_imported: "Messages",
  message_contents_read: "Message contents read",
  sms_db_manifest_entry_exists: "iPhone message file listed",
  sms_db_found: "iPhone message file found",
  sms_db_payload_exists: "iPhone message file available",
  sms_db_payload_nonzero: "iPhone message file has data",
  sms_db_payload_size_bytes: "iPhone message file size",
  source_path: "Source path",
  usable_without_import: "Ready to copy",
  valid: "Valid",
};

const DEFAULT_BACKUP_FOLDER_PATH =
  import.meta.env.VITE_DEFAULT_IPHONE_BACKUP_PATH || "";

const TECHNICAL_RESULT_LABELS = new Set([
  "backup_folder_path",
  "copied_sms_db_path",
  "destination_path",
  "source_path",
  "sms_db_payload_size_bytes",
]);

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
  const hasDetectedBackup = backupCandidates.length > 0 || canUseBackupPath;

  useEffect(() => {
    setIsImportToolsOpen(!hasArchiveData);
  }, [hasArchiveData]);

  useEffect(() => {
    let isCurrent = true;
    loadBackupCandidates({ isCurrent: () => isCurrent });
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
          key: label,
          label: formatResultLabel(label),
          value: formatResultValue(result[label]),
        }));
    }
    if (result.row_counts) {
      return Object.entries(result.row_counts).map(([label, value]) => ({
        key: label,
        label: formatResultLabel(label),
        value: formatResultValue(value),
      }));
    }
    if (Object.prototype.hasOwnProperty.call(result, "usable_without_import")) {
      return [
        "backup_folder_exists",
        "manifest_exists",
        "manifest_readable_sqlite",
        "manifest_appears_truncated",
        "backup_appears_encrypted",
        "backup_appears_incomplete",
        "sms_db_manifest_entry_exists",
        "sms_db_payload_exists",
        "sms_db_payload_nonzero",
        "sms_db_payload_size_bytes",
        "message_contents_read",
        "usable_without_import",
      ].map((label) => ({
        key: label,
        label: formatResultLabel(label),
        value: formatResultValue(result[label]),
      }));
    }
    return Object.entries(result)
      .filter(([label, value]) => RESULT_LABELS[label] && ["string", "number", "boolean"].includes(typeof value))
      .slice(0, 6)
      .map(([label, value]) => ({
        key: label,
        label: formatResultLabel(label),
        value: formatResultValue(value),
      }));
  }, [result]);

  const publicSummaryItems = summaryItems.filter((item) => !TECHNICAL_RESULT_LABELS.has(item.key));
  const technicalSummaryItems = summaryItems.filter((item) => TECHNICAL_RESULT_LABELS.has(item.key));

  const importStatus = useMemo(() => getImportStatus({
    activeStep,
    canUseBackupPath,
    completedSteps,
    hasArchiveData,
    hasDetectedBackup,
    importableBackupCandidate,
    isBusy,
  }), [activeStep, canUseBackupPath, completedSteps, hasArchiveData, hasDetectedBackup, importableBackupCandidate, isBusy]);
  const importProgressSteps = useMemo(() => getImportProgressSteps({
    activeStep,
    completedSteps,
    hasArchiveData,
    hasDetectedBackup,
  }), [activeStep, completedSteps, hasArchiveData, hasDetectedBackup]);
  const primaryImportAction = getPrimaryImportAction({
    canRunQuickImport,
    hasArchiveData,
    hasDetectedBackup,
    isBusy,
  });

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

  async function runBackupDiagnostics() {
    const data = await runStep("diagnostics", () =>
      request("/import/iphone-backup/diagnostics", {
        method: "POST",
        body: JSON.stringify({ backup_folder_path: backupFolderPath.trim() }),
      }),
    );

    if (!data) return;
    if (data.usable_without_import) {
      setStatus("This app can see the backup folder and found a readable backup index plus a message file with data.");
      return;
    }
    setStatus("");
    setError(buildDiagnosticError(data));
  }

  async function loadBackupCandidates({ isCurrent = () => true, showStatus = false } = {}) {
    setBackupCandidateStatus(showStatus ? "Looking for local iPhone backups..." : "");
    try {
      const data = await request("/import/iphone-backup/candidates");
      if (!isCurrent()) return;
      const candidates = data.candidates || [];
      setBackupCandidates(candidates);
      if (!backupFolderPath.trim()) {
        setBackupFolderPath(data.default_path || candidates[0]?.path || "");
      }
      if (candidates.length && !data.default_path) {
        setBackupCandidateStatus("A backup was detected, but the iPhone message file is not available to copy yet.");
      } else if (showStatus) {
        setBackupCandidateStatus(
          candidates.length
            ? "A local iPhone backup was found."
            : "No local iPhone backup was found yet. Back up your iPhone to this computer, then try again.",
        );
      }
    } catch {
      if (isCurrent()) {
        setBackupCandidateStatus(showStatus ? "The app could not check for local backups right now." : "");
      }
    }
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
          ? `Found ${candidates.length} local message cop${candidates.length === 1 ? "y" : "ies"}.`
          : "No local message copy found yet.",
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
      setError(toImportErrorMessage(requestError));
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
        "I could open the backup folder, but I could not find the iPhone message file inside it.",
      );
      return;
    }
    setStatus(
      data.manifest_readable
        ? "Found the iPhone message file in this backup."
        : "The backup index could not be read, but the iPhone message file is available to copy directly.",
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
        ? "Copied the iPhone message file into the app's private import folder."
        : "Copied the iPhone message file into the app's private import folder.",
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
    setStatus(data.valid ? "The message file looks valid." : "The message file does not look valid.");
  }

  async function inspectSmsDb() {
    const data = await runStep("inspect", () =>
      request("/import/iphone-backup/inspect-sms-db", {
        method: "POST",
        body: JSON.stringify({ copied_sms_db_path: copiedSmsDbPath.trim() }),
      }),
    );

    if (!data) return;
    setStatus(data.inspected ? "Message totals were checked without reading message text." : "Message totals could not be checked.");
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
    backup: {
      label: "Find iPhone backup",
      onClick: () => loadBackupCandidates({ showStatus: true }),
      disabled: isBusy,
      variant: "secondary-button",
    },
    locate: {
      label: "Check selected backup",
      onClick: locateBackup,
      disabled: !canUseBackupPath || isBusy,
      title: !canUseBackupPath ? "Choose a backup first." : undefined,
      variant: "secondary-button",
    },
    copy: {
      label: "Prepare private local copy",
      onClick: copySmsDb,
      disabled: !canCopySmsDb || isBusy,
      title: !canUseBackupPath
        ? "Choose a backup first."
        : !completedSteps.has("locate")
          ? "Check the selected backup first."
          : undefined,
      variant: "secondary-button",
    },
    validate: {
      label: completedSteps.has("validate") && !completedSteps.has("inspect") ? "Check message totals" : "Check message archive",
      onClick: completedSteps.has("validate") && !completedSteps.has("inspect") ? inspectSmsDb : validateSmsDb,
      disabled: !canUseCopiedPath || isBusy,
      title: !canUseCopiedPath ? "Prepare a private local copy first." : undefined,
      variant: "secondary-button",
    },
    import: {
      label: "Import prepared messages",
      onClick: importMessages,
      disabled: !canUseCopiedPath || !completedSteps.has("validate") || isBusy,
      title: !canUseCopiedPath
        ? "Prepare a private local copy first."
        : !completedSteps.has("validate")
          ? "Check the message archive first."
          : undefined,
      variant: "secondary-button",
    },
    review: {
      label: "Open Archive",
      onClick: () => setIsImportToolsOpen(false),
      disabled: !hasArchiveData || isBusy,
      title: !hasArchiveData ? "Import messages first." : undefined,
      variant: "secondary-button",
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
          <section className="guided-import-card" aria-label="Import iPhone messages">
            <div className="guided-import-header">
              <span className="guided-import-icon">
                {isBusy ? <Loader2 className="spin" size={18} aria-hidden="true" /> : <Import size={18} aria-hidden="true" />}
              </span>
              <div>
                <p className="eyebrow">Import</p>
                <h2>Import iPhone messages</h2>
                <p>
                  Back up your iPhone to this computer, then import messages into a private local archive.
                </p>
              </div>
            </div>

            <div className="privacy-safeguards" aria-label="Import privacy notes">
              <span className="privacy-badge">
                <LockKeyhole size={16} aria-hidden="true" />
                Local only
              </span>
              <span className="privacy-badge">No cloud sync</span>
              <span className="privacy-badge">No external upload</span>
              <span className="privacy-badge">No account required</span>
            </div>

            <p className="backup-encryption-note">
              If your iPhone backup is encrypted, keep it that way. The app will tell you if it needs a temporary local backup without encryption for import.
            </p>

            <ol className="simple-flow-list" aria-label="Import overview">
              <li>Back up iPhone</li>
              <li>Import messages</li>
              <li>Search and export</li>
            </ol>

            <div className={`import-status-card ${isBusy ? "is-active" : ""}`}>
              {isBusy ? <Loader2 className="spin" size={18} aria-hidden="true" /> : <SearchCheck size={18} aria-hidden="true" />}
              <div>
                <strong>{importStatus.title}</strong>
                <p>{importStatus.detail}</p>
              </div>
            </div>

            <ol className="import-progress-list" aria-label="Import progress">
              {importProgressSteps.map((step) => (
                <li className={`${step.isComplete ? "is-complete" : ""} ${step.isActive ? "is-active" : ""}`} key={step.key}>
                  <span>{step.isComplete ? <CheckCircle2 size={14} aria-hidden="true" /> : step.number}</span>
                  <strong>{step.label}</strong>
                </li>
              ))}
            </ol>

            <div className="guided-import-actions">
              <button
                className="primary-button"
                type="button"
                onClick={primaryImportAction.kind === "find" ? stepActions.backup.onClick : primaryImportAction.kind === "open" ? stepActions.review.onClick : importDetectedBackup}
                disabled={primaryImportAction.disabled}
                title={primaryImportAction.disabledReason}
              >
                {primaryImportAction.label}
              </button>
              <span>{primaryImportAction.detail}</span>
            </div>
          </section>

          <details className="advanced-details import-options-details">
            <summary>Advanced import options</summary>
            <div className="diagnostics-card">
              <div>
                <strong>Check backup</strong>
                <span>Use this when import needs help finding or checking a backup.</span>
              </div>
              <button
                className="secondary-button"
                type="button"
                onClick={runBackupDiagnostics}
                disabled={!canUseBackupPath || isBusy}
                title={!canUseBackupPath ? "Add a backup folder path first." : undefined}
              >
                {activeStep === "diagnostics" ? "Checking" : "Check backup"}
              </button>
            </div>

            <div className="troubleshooting-actions" aria-label="Troubleshooting actions">
              {["backup", "locate", "copy", "validate", "import"].map((key) => {
                const action = stepActions[key];
                return (
                  <button
                    className={action.variant}
                    type="button"
                    onClick={action.onClick}
                    disabled={action.disabled}
                    title={action.title}
                    key={key}
                  >
                    {action.label}
                  </button>
                );
              })}
            </div>

            <div className="import-grid">
              <label className="field">
                <span>iPhone backup</span>
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
                  placeholder="Choose or paste a backup location"
                />
                <small>
                  Use this only if the app cannot detect your iPhone backup automatically.
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
                  Prepared import
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
                    aria-label="Local message copies"
                  >
                    <option value="">Choose local message copy</option>
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
                  placeholder="Filled automatically during import"
                />
                <small>
                  Use this only when troubleshooting an import that was already prepared.
                </small>
                {copiedSmsDbImportDir && <small>A prepared import is available in private local storage.</small>}
                {copiedSmsDbStatus && <small>{copiedSmsDbStatus}</small>}
                {selectedCopiedSmsDbCandidate?.detail && (
                  <small className={selectedCopiedSmsDbCandidate.valid ? "" : "field-warning"}>
                    {selectedCopiedSmsDbCandidate.detail}
                  </small>
                )}
              </label>
            </div>
          </details>
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

          {publicSummaryItems.length > 0 && (
            <dl className="result-grid">
              {publicSummaryItems.map((item) => (
                <div key={item.label}>
                  <dt>{item.label}</dt>
                  <dd>{item.value}</dd>
                </div>
              ))}
            </dl>
          )}
          {technicalSummaryItems.length > 0 && (
            <details className="advanced-details result-details">
              <summary>Show technical details</summary>
              <dl className="result-grid">
                {technicalSummaryItems.map((item) => (
                  <div key={item.label}>
                    <dt>{item.label}</dt>
                    <dd>{item.value}</dd>
                  </div>
                ))}
              </dl>
            </details>
          )}
        </>
      )}
    </section>
  );
}

function ImportRecoveryHelp({ backupFolderPath, selectedBackupCandidate }) {
  const detail = selectedBackupCandidate?.detail || "";
  const hasBackupFolderPath = backupFolderPath.trim().length > 0;

  return (
    <div className="import-recovery">
      <ol>
        <li>Confirm the path is the backup folder itself, not the Info window or a folder above it.</li>
        <li>Make sure this app is running on the computer that can access that folder.</li>
        <li>If the folder was copied from another drive, copy the whole backup folder again and wait for the copy to finish.</li>
      </ol>
      {(detail || hasBackupFolderPath) && (
        <details className="advanced-details recovery-details">
          <summary>Show technical details</summary>
          {detail && <p>{simplifyBackupDetail(detail)}</p>}
          {hasBackupFolderPath && <p>The app checks the standard iPhone backup message-file location inside the selected folder.</p>}
        </details>
      )}
    </div>
  );
}

function simplifyBackupDetail(detail) {
  if (detail.includes("truncated")) {
    return "The backup index looks incomplete. The app will still try the direct message-file location, but Apple backups need the index and backup files to be fully copied.";
  }
  if (detail.includes("missing or empty")) {
    return "The standard iPhone message file is missing or empty in this folder.";
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
      <dl className="archive-loaded-stats">
        {items.map((item) => (
          <div key={item.label}>
            <dt>{item.label}</dt>
            <dd>{item.value}</dd>
          </div>
        ))}
      </dl>
      <div className="archive-loaded-safeguards" aria-label="Archive safeguards">
        <span className="privacy-badge">
          <ShieldCheck size={14} aria-hidden="true" />
          Local only
        </span>
        <span className="privacy-badge">
          <LockKeyhole size={14} aria-hidden="true" />
          Private storage
        </span>
        <span className="privacy-badge">No cloud sync</span>
      </div>
      <button className="secondary-button" type="button" onClick={onToggleImportTools}>
        {isImportToolsOpen ? "Close Import" : "Manage Import"}
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
  if (candidate.sms_db_copyable) return "Message file available";
  return "Needs review";
}

function backupCandidateDetailClassName(candidate) {
  return candidate.manifest_readable || candidate.sms_db_copyable ? "" : "field-warning";
}

function getPrimaryImportAction({ canRunQuickImport, hasArchiveData, hasDetectedBackup, isBusy }) {
  if (hasArchiveData) {
    return {
      kind: "open",
      label: "Open archive",
      detail: "Your messages are ready to search and export.",
      disabled: isBusy,
      disabledReason: undefined,
    };
  }

  if (!hasDetectedBackup) {
    return {
      kind: "find",
      label: "Find iPhone backup",
      detail: "Back up your iPhone to this computer first, then let the app look for it.",
      disabled: isBusy,
      disabledReason: undefined,
    };
  }

  return {
    kind: "import",
    label: "Import messages",
    detail: "The app will prepare, check, and import your messages into this private archive.",
    disabled: !canRunQuickImport || isBusy,
    disabledReason: canRunQuickImport ? undefined : "Back up your iPhone to this computer, then try again.",
  };
}

function getImportStatus({
  activeStep,
  canUseBackupPath,
  completedSteps,
  hasArchiveData,
  hasDetectedBackup,
  importableBackupCandidate,
  isBusy,
}) {
  if (hasArchiveData) {
    return {
      title: "Archive ready",
      detail: "You can now read, search, and export your local messages.",
    };
  }

  if (isBusy) {
    const busyMessages = {
      diagnostics: ["Checking backup", "Making sure this computer can use the selected backup."],
      locate: ["Finding iPhone backup", "Looking for a usable local backup on this computer."],
      copy: ["Preparing private local copy", "Preparing messages for this app's private local archive."],
      validate: ["Checking message archive", "Checking that the prepared import is ready."],
      inspect: ["Checking message archive", "Checking message totals before import."],
      import: ["Importing messages", "Adding messages to your private local archive."],
      "auto-import": ["Importing messages", "Preparing, checking, and importing messages."],
    };
    const [title, detail] = busyMessages[activeStep] || ["Working", "Preparing your import."];
    return { title, detail };
  }

  if (!hasDetectedBackup && !importableBackupCandidate) {
    return {
      title: "Back up your iPhone first",
      detail: "Use Finder or Apple Devices to make a backup on this computer, then find it here.",
    };
  }

  if (!canUseBackupPath && importableBackupCandidate) {
    return {
      title: "Backup found",
      detail: "Import messages when you are ready.",
    };
  }

  if (!completedSteps.has("import")) {
    return {
      title: "Ready to import",
      detail: "The app will handle the preparation and checks before loading your archive.",
    };
  }

  return {
    title: "Import complete",
    detail: "Browse the updated archive when you are ready.",
  };
}

function getImportProgressSteps({ activeStep, completedSteps, hasArchiveData, hasDetectedBackup }) {
  const isActive = (keys) => keys.includes(activeStep);
  return [
    {
      key: "backup",
      label: "Find iPhone backup",
      number: "1",
      isComplete: hasDetectedBackup || hasArchiveData,
      isActive: isActive(["diagnostics", "locate"]) || (!hasDetectedBackup && !hasArchiveData),
    },
    {
      key: "prepare",
      label: "Prepare private local copy",
      number: "2",
      isComplete: completedSteps.has("copy") || completedSteps.has("import") || hasArchiveData,
      isActive: isActive(["copy"]),
    },
    {
      key: "check",
      label: "Check message archive",
      number: "3",
      isComplete: completedSteps.has("validate") || completedSteps.has("inspect") || completedSteps.has("import") || hasArchiveData,
      isActive: isActive(["validate", "inspect"]),
    },
    {
      key: "import",
      label: "Import messages",
      number: "4",
      isComplete: completedSteps.has("import") || hasArchiveData,
      isActive: isActive(["import", "auto-import"]),
    },
    {
      key: "ready",
      label: "Ready to search",
      number: "5",
      isComplete: hasArchiveData,
      isActive: hasArchiveData,
    },
  ];
}

function toImportErrorMessage(error) {
  if (error?.status) return "The import could not be completed. Try again, or open advanced import options.";
  if (error?.kind === "service-unavailable" || error?.name === "TypeError") {
    return "The local app is not responding. Restart it and try again.";
  }
  return error?.message || "The import could not be completed.";
}

function buildDiagnosticError(data) {
  if (!data.backup_folder_exists) {
    return "This app cannot see that backup folder in its current runtime environment.";
  }
  if (!data.backup_folder_is_directory) {
    return "The selected backup path exists, but it is not a folder.";
  }
  if (!data.manifest_exists) {
    return "The backup index was not found in the selected backup folder.";
  }
  if (!data.manifest_readable_sqlite) {
    return data.manifest_appears_truncated
      ? "The backup index exists but appears incomplete."
      : "The backup index exists but could not be read.";
  }
  if (data.backup_appears_encrypted) {
    return "This backup appears encrypted, so the app cannot copy the iPhone message file directly.";
  }
  if (!data.sms_db_manifest_entry_exists) {
    return "The backup index is readable, but it does not list the iPhone message file.";
  }
  if (!data.sms_db_payload_exists) {
    return "The backup index lists the iPhone message file, but the matching backup file was not found.";
  }
  if (!data.sms_db_payload_nonzero) {
    return "The matching iPhone message file exists but is empty.";
  }
  return "The backup did not pass diagnostics in this runtime environment.";
}

function formatResultLabel(label) {
  return RESULT_LABELS[label] || label.replaceAll("_", " ");
}

function formatResultValue(value) {
  if (typeof value === "number") return new Intl.NumberFormat().format(value);
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (value === null || value === undefined) return "Unknown";
  return String(value);
}

function formatArchiveDate(value) {
  if (!value) return "No messages";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
}
