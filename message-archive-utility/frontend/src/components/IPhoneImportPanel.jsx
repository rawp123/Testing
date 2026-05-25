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
    key: "backup",
    label: "Back up your iPhone to this computer",
    detail: "Use Finder or Apple Devices to make a local backup first. Your messages stay on this device.",
    icon: LockKeyhole,
  },
  {
    key: "locate",
    label: "Let the app find the backup",
    detail: "Looks for a local backup that contains an iPhone message file.",
    icon: FolderSearch,
    requirement: "Add a backup folder path.",
  },
  {
    key: "copy",
    label: "Copy the message file into private local storage",
    detail: "Makes a local message copy for this app to use. Nothing is uploaded.",
    icon: Database,
    requirement: "Use the same backup folder path.",
  },
  {
    key: "validate",
    label: "Check that the message file looks valid",
    detail: "Checks message totals without reading message text.",
    icon: ClipboardCheck,
    requirement: "Copy the local message file first.",
  },
  {
    key: "import",
    label: "Import messages",
    detail: "Adds messages, conversations, contacts, and attachment details to your local archive.",
    icon: Import,
    requirement: "Check the local message copy first.",
  },
  {
    key: "review",
    label: "Review and export your archive",
    detail: "Read, search, and export after the archive is loaded.",
    icon: SearchCheck,
  },
];

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
  const [isGuideOpen, setIsGuideOpen] = useState(!hasArchiveData);

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
    setIsGuideOpen(!hasArchiveData);
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

  const nextAction = useMemo(() => {
    if (isBusy) {
      const step = STEP_DEFS.find((definition) => definition.key === activeStep);
      return step ? `${step.label} is running...` : "Working...";
    }
    if (!canUseBackupPath && importableBackupCandidate) return "A backup was detected. Import it when you are ready.";
    if (!canUseBackupPath) return "Use a detected backup, or open advanced details to choose one manually.";
    if (!completedSteps.has("locate")) return "Start by letting the app find your backup.";
    if (!completedSteps.has("copy")) return "Copy the message file into private local storage.";
    if (!canUseCopiedPath) return "Copy the message file, or choose an existing local message copy in advanced details.";
    if (!completedSteps.has("validate")) return "Validate the local message copy.";
    if (!completedSteps.has("inspect")) return "You can check message totals, or import when you are ready.";
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
      label: "Find Backup",
      onClick: () => loadBackupCandidates({ showStatus: true }),
      disabled: isBusy,
      variant: "secondary-button",
    },
    locate: {
      label: "Find Message File",
      onClick: locateBackup,
      disabled: !canUseBackupPath || isBusy,
      title: !canUseBackupPath ? STEP_DEFS[1].requirement : undefined,
      variant: "primary-button",
    },
    copy: {
      label: "Copy Locally",
      onClick: copySmsDb,
      disabled: !canCopySmsDb || isBusy,
      title: !canUseBackupPath
        ? STEP_DEFS[2].requirement
        : !completedSteps.has("locate")
          ? "Locate a copyable iPhone message file first."
          : undefined,
      variant: "primary-button",
    },
    validate: {
      label: completedSteps.has("validate") && !completedSteps.has("inspect") ? "Check Totals" : "Check File",
      onClick: completedSteps.has("validate") && !completedSteps.has("inspect") ? inspectSmsDb : validateSmsDb,
      disabled: !canUseCopiedPath || isBusy,
      title: !canUseCopiedPath ? STEP_DEFS[3].requirement : undefined,
      variant: "secondary-button",
    },
    import: {
      label: "Import",
      onClick: importMessages,
      disabled: !canUseCopiedPath || !completedSteps.has("validate") || isBusy,
      title: !canUseCopiedPath
        ? STEP_DEFS[4].requirement
        : !completedSteps.has("validate")
          ? "Check the local message copy first."
          : undefined,
      variant: "primary-button",
    },
    review: {
      label: "Open Archive",
      onClick: () => setIsImportToolsOpen(false),
      disabled: !hasArchiveData || isBusy,
      title: !hasArchiveData ? "Import messages first." : undefined,
      variant: "secondary-button",
    },
  };

  const guideStatuses = {
    backup: hasDetectedBackup ? "Local backup detected" : "Waiting for a local backup",
    locate: completedSteps.has("locate")
      ? "Message file found"
      : canUseBackupPath
        ? "Ready to find"
        : "Waiting for backup",
    copy: completedSteps.has("copy")
      ? "Local message copy ready"
      : canCopySmsDb
        ? "Ready to copy"
        : "Waiting for message file",
    validate: completedSteps.has("inspect")
      ? "Totals checked"
      : completedSteps.has("validate")
        ? "Message file looks valid"
        : canUseCopiedPath
          ? "Ready to check"
          : "Waiting for local copy",
    import: completedSteps.has("import") || hasArchiveData
      ? "Archive loaded"
      : completedSteps.has("validate")
        ? "Ready to import"
        : "Waiting for checks",
    review: hasArchiveData ? "Ready to read, search, and export" : "Waiting for import",
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
            <div className="panel-actions">
              <button
                className="secondary-button"
                type="button"
                onClick={() => setIsGuideOpen((isOpen) => !isOpen)}
                aria-expanded={isGuideOpen}
              >
                Import Guide
              </button>
            </div>
          </header>

          <div className="flow-strip" aria-label="App flow">
            <span>Import</span>
            <span className="flow-separator" aria-hidden="true"> → </span>
            <span>Read</span>
            <span className="flow-separator" aria-hidden="true"> → </span>
            <span>Search</span>
            <span className="flow-separator" aria-hidden="true"> → </span>
            <span>Export</span>
          </div>

          <div className="privacy-safeguards" aria-label="Import privacy notes">
            <span className="privacy-badge">
              <LockKeyhole size={16} aria-hidden="true" />
              Messages stay on this device
            </span>
            <span className="privacy-badge">No cloud sync</span>
            <span className="privacy-badge">No external upload</span>
            <span className="privacy-badge">No account required</span>
          </div>

          <div className="import-status-card">
            <SearchCheck size={18} aria-hidden="true" />
            <p>{nextAction}</p>
          </div>

          {isGuideOpen && (
            <div className="import-guide-card">
              <div className="guide-intro">
                <div>
                  <p className="eyebrow">Get Started</p>
                  <h3>Import your messages</h3>
                  <p>
                    Follow these steps from local iPhone backup to loaded archive. Attachments may be detected even if their files are not copied.
                  </p>
                </div>
                <button
                  className="primary-button"
                  type="button"
                  onClick={importDetectedBackup}
                  disabled={!canRunQuickImport}
                  title={canRunQuickImport ? undefined : "Add or detect an importable backup first."}
                >
                  Import Detected Backup
                </button>
              </div>

              <ol className="step-list" aria-label="iPhone import guide">
                {STEP_DEFS.map(({ key, label, detail, icon: Icon }) => {
                  const isComplete = getGuideStepComplete(key, completedSteps, hasArchiveData, hasDetectedBackup);
                  const isActive = activeStep === key || (key === "validate" && activeStep === "inspect");
                  const isReady = getGuideStepReady(key, {
                    canUseBackupPath,
                    canCopySmsDb,
                    canUseCopiedPath,
                    completedSteps,
                    hasArchiveData,
                    hasDetectedBackup,
                    isBusy,
                  });
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
                        <span className="step-status">{isActive ? "Running" : guideStatuses[key]}</span>
                        {action && (
                          <button
                            className={action.variant}
                            type="button"
                            onClick={action.onClick}
                            disabled={action.disabled}
                            title={action.title}
                          >
                            {action.label}
                          </button>
                        )}
                        {isComplete && <CheckCircle2 className="step-complete-icon" size={17} aria-label="Complete" />}
                      </div>
                    </li>
                  );
                })}
              </ol>
            </div>
          )}

          <details className="advanced-details">
            <summary>Advanced details</summary>
            <div className="diagnostics-card">
              <div>
                <strong>Check backup</strong>
                <span>Checks the selected local backup before any copy or import step.</span>
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

            <div className="import-grid">
              <label className="field">
                <span>Backup folder</span>
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
                  placeholder="Paste local backup folder path"
                />
                <small>
                  Use this only if the app cannot detect your local iPhone backup automatically.
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
                  Local message copy
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
                  placeholder="Filled after copy, or paste a local copy path"
                />
                <small>
                  Use this only when you already have a local message copy prepared for import.
                </small>
                {copiedSmsDbImportDir && <small>Import folder is available in this app's local storage.</small>}
                {copiedSmsDbStatus && <small>{copiedSmsDbStatus}</small>}
                {selectedCopiedSmsDbCandidate?.detail && (
                  <small className={selectedCopiedSmsDbCandidate.valid ? "" : "field-warning"}>
                    {selectedCopiedSmsDbCandidate.detail}
                  </small>
                )}
              </label>
            </div>
          </details>

          <p className="privacy-note">
            Messages stay on this device. The app uses local private storage and does not upload your archive.
          </p>
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

function getGuideStepComplete(key, completedSteps, hasArchiveData, hasDetectedBackup) {
  if (key === "backup") return hasDetectedBackup;
  if (key === "validate") return completedSteps.has("validate") && completedSteps.has("inspect");
  if (key === "review") return hasArchiveData;
  return completedSteps.has(key);
}

function getGuideStepReady(key, state) {
  if (state.isBusy) return false;
  if (key === "backup") return !state.hasDetectedBackup;
  if (key === "locate") return state.canUseBackupPath && !state.completedSteps.has("locate");
  if (key === "copy") return state.canCopySmsDb && !state.completedSteps.has("copy");
  if (key === "validate") return state.canUseCopiedPath && !(state.completedSteps.has("validate") && state.completedSteps.has("inspect"));
  if (key === "import") return state.canUseCopiedPath && state.completedSteps.has("validate") && !state.hasArchiveData;
  if (key === "review") return state.hasArchiveData;
  return false;
}

function toImportErrorMessage(error) {
  if (error?.status) return "The local app service could not complete that step. Try again or open technical details.";
  if (error?.kind === "service-unavailable" || error?.name === "TypeError") {
    return "The local app service is not responding. Restart the app and try again.";
  }
  return error?.message || "That step could not be completed.";
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
