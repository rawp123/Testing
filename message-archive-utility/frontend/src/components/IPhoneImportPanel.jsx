import {
  CheckCircle2,
  Import,
  Loader2,
  SearchCheck,
} from "lucide-react";
import React, { useEffect, useMemo, useState } from "react";
import BackupGuide from "./BackupGuide.jsx";
import LoadingStatus from "./LoadingStatus.jsx";

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
  chat_message_join: "Messages linked to chats",
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
  message_attachment_join: "Messages with attachments",
  message_attachment_links_imported: "Messages with attachments",
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
  "backup_appears_encrypted",
  "backup_appears_incomplete",
  "backup_folder_exists",
  "backup_folder_path",
  "backup_folder_is_directory",
  "copied_sms_db_path",
  "destination_path",
  "manifest_appears_truncated",
  "manifest_exists",
  "manifest_found",
  "manifest_readable_sqlite",
  "sms_db_found",
  "sms_db_manifest_entry_exists",
  "sms_db_payload_exists",
  "sms_db_payload_nonzero",
  "source_path",
  "sms_db_payload_size_bytes",
]);

export default function IPhoneImportPanel({
  request,
  onArchiveChanged,
  hasArchiveData = false,
  archiveStats = null,
  isArchiveStatsLoading = false,
  onOpenArchive,
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
  const [isImportToolsOpen, setIsImportToolsOpen] = useState(true);
  const [isFindingBackups, setIsFindingBackups] = useState(false);
  const [isRefreshingPreparedFiles, setIsRefreshingPreparedFiles] = useState(false);

  const canUseBackupPath = backupFolderPath.trim().length > 0;
  const canUseCopiedPath = copiedSmsDbPath.trim().length > 0;
  const isBusy = activeStep.length > 0 || isFindingBackups || isRefreshingPreparedFiles;
  const shouldShowImportTools = !hasArchiveData || isImportToolsOpen;
  const selectedBackupCandidate = backupCandidates.find((candidate) => candidate.path === backupFolderPath);
  const selectedCopiedSmsDbCandidate = copiedSmsDbCandidates.find((candidate) => candidate.path === copiedSmsDbPath);
  const importableBackupCandidate = backupCandidates.find((candidate) => (
    candidate.sms_db_copyable || candidate.manifest_readable
  ));
  const selectedBackupIsImportable = Boolean(
    selectedBackupCandidate && (selectedBackupCandidate.sms_db_copyable || selectedBackupCandidate.manifest_readable),
  );
  const hasUsableCheckedBackup = Boolean(
    canUseBackupPath
      && completedSteps.has("diagnostics")
      && result?.usable_without_import === true,
  );
  const canImportSelectedBackup = selectedBackupIsImportable || hasUsableCheckedBackup || (
    !canUseBackupPath && Boolean(importableBackupCandidate)
  );
  const canCopySmsDb = canUseBackupPath && completedSteps.has("locate");
  const canRunQuickImport = canImportSelectedBackup && !isBusy;
  const hasDetectedBackup = backupCandidates.length > 0 || canUseBackupPath;
  const hasBackupSearchFeedback = backupCandidateStatus.trim().length > 0;
  const shouldShowBackupLocator = shouldShowImportTools && (hasDetectedBackup || hasBackupSearchFeedback);
  const shouldOpenManualBackupEntry = hasBackupSearchFeedback && !hasDetectedBackup;

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
    hasArchiveData: false,
    hasDetectedBackup,
    canImportSelectedBackup,
    importableBackupCandidate,
    isBusy,
  }), [activeStep, canImportSelectedBackup, canUseBackupPath, completedSteps, hasDetectedBackup, importableBackupCandidate, isBusy]);
  const importProgressSteps = useMemo(() => getImportProgressSteps({
    activeStep,
    completedSteps,
    hasArchiveData: false,
    hasDetectedBackup,
  }), [activeStep, completedSteps, hasDetectedBackup]);
  const primaryImportAction = getPrimaryImportAction({
    canRunQuickImport,
    hasArchiveData: false,
    hasDetectedBackup,
    canImportSelectedBackup,
    isBusy,
  });
  const loadingStatus = getImportLoadingStatus({
    activeStep,
    isFindingBackups,
    isRefreshingPreparedFiles,
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
      setStatus("Backup found.");
      return;
    }
    setStatus("");
    setError(buildDiagnosticError(data));
  }

  async function loadBackupCandidates({ isCurrent = () => true, showStatus = false } = {}) {
    if (showStatus) setIsFindingBackups(true);
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
        setBackupCandidateStatus("A backup was detected, but it may need review before import.");
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
    } finally {
      if (showStatus && isCurrent()) setIsFindingBackups(false);
    }
  }

  async function loadCopiedSmsDbCandidates({ isCurrent = () => true, showStatus = false } = {}) {
    if (showStatus) setIsRefreshingPreparedFiles(true);
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
          ? "A prepared local copy is available."
          : "No prepared import is available yet.",
      );
    } catch {
      if (isCurrent()) setCopiedSmsDbStatus("");
    } finally {
      if (showStatus && isCurrent()) setIsRefreshingPreparedFiles(false);
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
        "The backup opened, but message data was not found.",
      );
      return;
    }
    setStatus(
      data.manifest_readable
        ? "Backup found."
        : "Backup found. A local preparation step is needed.",
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
    setStatus("Prepared a local copy for import.");
  }

  async function validateSmsDb() {
    const data = await runStep("validate", () =>
      request("/import/iphone-backup/validate-sms-db", {
        method: "POST",
        body: JSON.stringify({ copied_sms_db_path: copiedSmsDbPath.trim() }),
      }),
    );

    if (!data) return;
    setStatus(data.valid ? "Prepared import ready." : "The prepared import needs review.");
  }

  async function inspectSmsDb() {
    const data = await runStep("inspect", () =>
      request("/import/iphone-backup/inspect-sms-db", {
        method: "POST",
        body: JSON.stringify({ copied_sms_db_path: copiedSmsDbPath.trim() }),
      }),
    );

    if (!data) return;
    setStatus(data.inspected ? "Message archive ready." : "Message totals could not be checked.");
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
      label: "Prepare local copy",
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
      title: !canUseCopiedPath ? "Prepare a local copy first." : undefined,
      variant: "secondary-button",
    },
    import: {
      label: "Import prepared messages",
      onClick: importMessages,
      disabled: !canUseCopiedPath || !completedSteps.has("validate") || isBusy,
      title: !canUseCopiedPath
        ? "Prepare a local copy first."
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
          onOpenArchive={onOpenArchive}
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
                <p>Import messages from an iPhone backup on this computer.</p>
              </div>
            </div>

            <p className="backup-encryption-note">
              Start with an unencrypted local iPhone backup on this computer.
            </p>

            <BackupGuide />

            <p className="import-repeat-note">
              You can import again later. Existing messages are skipped, and new messages are added to the archive.
            </p>

            <div className={`import-status-line ${isBusy ? "is-active" : ""}`}>
              {isBusy ? <Loader2 className="spin" size={18} aria-hidden="true" /> : <SearchCheck size={18} aria-hidden="true" />}
              <div>
                <strong>{importStatus.title}</strong>
                <p>{importStatus.detail}</p>
              </div>
            </div>

            {loadingStatus && (
              <LoadingStatus
                label={loadingStatus.label}
                detail={loadingStatus.detail}
                className="import-loading-status"
              />
            )}

            <ol className="import-checklist" aria-label="Import progress">
              {importProgressSteps.map((step) => (
                <li className={`${step.isComplete ? "is-complete" : ""} ${step.isActive ? "is-active" : ""}`} key={step.key}>
                  <span>{step.isComplete ? <CheckCircle2 size={14} aria-hidden="true" /> : step.number}</span>
                  <strong>{step.label}</strong>
                </li>
              ))}
            </ol>

            {shouldShowBackupLocator && (
              <BackupLocatorPanel
                activeStep={activeStep}
                backupCandidates={backupCandidates}
                backupCandidateStatus={backupCandidateStatus}
                backupFolderPath={backupFolderPath}
                canUseBackupPath={canUseBackupPath}
                isBusy={isBusy}
                onBackupFolderPathChange={updateBackupFolderPath}
                onCheckBackup={runBackupDiagnostics}
                onFindBackups={stepActions.backup.onClick}
                openManualEntry={shouldOpenManualBackupEntry}
                selectedBackupCandidate={selectedBackupCandidate}
              />
            )}

            <div className="guided-import-actions">
              <button
                className="primary-button"
                type="button"
                onClick={
                  primaryImportAction.kind === "find"
                    ? stepActions.backup.onClick
                    : primaryImportAction.kind === "open"
                      ? onOpenArchive
                      : primaryImportAction.kind === "check"
                        ? runBackupDiagnostics
                        : importDetectedBackup
                }
                disabled={primaryImportAction.disabled}
                title={primaryImportAction.disabledReason}
              >
                {primaryImportAction.label}
              </button>
              <span>{primaryImportAction.detail}</span>
            </div>
          </section>

          <details className="advanced-details import-options-details">
            <summary>More import options</summary>
            <div className="advanced-import-panel">
              <div>
                <strong>Troubleshooting</strong>
                <p>Use these if an import stops or you need to choose a backup manually.</p>
              </div>
              <div className="advanced-action-row" aria-label="Import troubleshooting actions">
                <button
                  className="primary-button"
                  type="button"
                  onClick={runBackupDiagnostics}
                  disabled={!canUseBackupPath || isBusy}
                  title={!canUseBackupPath ? "Find an iPhone backup first." : undefined}
                >
                  {activeStep === "diagnostics" ? "Checking" : "Check backup"}
                </button>
                <button
                  className="secondary-button"
                  type="button"
                  onClick={stepActions.backup.onClick}
                  disabled={stepActions.backup.disabled}
                >
                  Find iPhone backup
                </button>
                <button
                  className="ghost-button"
                  type="button"
                  onClick={() => loadCopiedSmsDbCandidates({ showStatus: true })}
                  disabled={isBusy}
                >
                  Refresh files
                </button>
              </div>
              {!canUseBackupPath && (
                <p className="advanced-action-note">Find an iPhone backup before checking it.</p>
              )}
            </div>

            <details className="advanced-details technical-import-details">
              <summary>Show file details</summary>
              <div className="troubleshooting-actions" aria-label="Technical import actions">
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
                          {formatBackupCandidateName(candidate)} - {formatBackupCandidateStatus(candidate)}
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
                      {simplifyBackupDetail(selectedBackupCandidate.detail)}
                    </small>
                  )}
                </label>
                <label className="field">
                  <span className="field-heading">
                    Prepared import
                    <button
                      className="inline-text-button"
                      type="button"
                      onClick={() => loadCopiedSmsDbCandidates({ showStatus: true })}
                      disabled={isBusy}
                    >
                      Refresh files
                    </button>
                  </span>
                  {copiedSmsDbCandidates.length > 0 && (
                    <select
                      value={copiedSmsDbCandidates.some((candidate) => candidate.path === copiedSmsDbPath) ? copiedSmsDbPath : ""}
                      onChange={(event) => updateCopiedSmsDbPath(event.target.value)}
                      aria-label="Prepared import files"
                    >
                      <option value="">Choose prepared import</option>
                      {copiedSmsDbCandidates.map((candidate) => (
                        <option key={candidate.path} value={candidate.path}>
                          {maskPathForDisplay(candidate.name)} - {candidate.valid ? "Ready" : "Needs review"}
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
                  {copiedSmsDbImportDir && <small>A prepared local copy is available.</small>}
                  {copiedSmsDbStatus && <small>{copiedSmsDbStatus}</small>}
                  {selectedCopiedSmsDbCandidate?.detail && (
                    <small className={selectedCopiedSmsDbCandidate.valid ? "" : "field-warning"}>
                      {maskPathForDisplay(selectedCopiedSmsDbCandidate.detail)}
                    </small>
                  )}
                </label>
              </div>
            </details>
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
              <summary>Show file details</summary>
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
          <summary>Show file details</summary>
          {detail && <p>{simplifyBackupDetail(detail)}</p>}
          {hasBackupFolderPath && <p>The app checks the standard message location inside the selected backup folder.</p>}
        </details>
      )}
    </div>
  );
}

function BackupLocatorPanel({
  activeStep,
  backupCandidates,
  backupCandidateStatus,
  backupFolderPath,
  canUseBackupPath,
  isBusy,
  onBackupFolderPathChange,
  onCheckBackup,
  onFindBackups,
  openManualEntry,
  selectedBackupCandidate,
}) {
  const hasCandidates = backupCandidates.length > 0;
  const hasBackupLocation = backupFolderPath.trim().length > 0;
  const title = hasCandidates || hasBackupLocation ? "Backup selected" : "Choose a backup";
  const detail = getBackupLocatorDetail({
    backupCandidateStatus,
    hasBackupLocation,
    hasCandidates,
    selectedBackupCandidate,
  });

  return (
    <section className="backup-locator-panel" aria-label="Backup selection">
      <div className="backup-locator-copy">
        <strong>{title}</strong>
        <p>{detail}</p>
      </div>

      {hasCandidates && (
        <label className="backup-locator-field">
          <span>Detected backup</span>
          <select
            value={backupCandidates.some((candidate) => candidate.path === backupFolderPath) ? backupFolderPath : ""}
            onChange={(event) => onBackupFolderPathChange(event.target.value)}
          >
            <option value="">Choose detected backup</option>
            {backupCandidates.map((candidate) => (
              <option key={candidate.path} value={candidate.path}>
                {formatBackupCandidateName(candidate)} - {formatBackupCandidateStatus(candidate)}
              </option>
            ))}
          </select>
        </label>
      )}

      <details className="manual-backup-details" open={openManualEntry}>
        <summary>{hasCandidates || hasBackupLocation ? "Use a different backup" : "Enter backup location"}</summary>
        <label className="backup-locator-field">
          <span>Backup location</span>
          <input
            value={backupFolderPath}
            onChange={(event) => onBackupFolderPathChange(event.target.value)}
            placeholder="Paste the local backup folder location"
          />
        </label>
        <div className="backup-locator-actions">
          <button
            className="primary-button"
            type="button"
            onClick={onCheckBackup}
            disabled={!canUseBackupPath || isBusy}
            title={!canUseBackupPath ? "Choose a backup first." : undefined}
          >
            {activeStep === "diagnostics" ? "Checking" : "Check backup"}
          </button>
          <button className="secondary-button" type="button" onClick={onFindBackups} disabled={isBusy}>
            Find again
          </button>
        </div>
      </details>
    </section>
  );
}

function getBackupLocatorDetail({
  backupCandidateStatus,
  hasBackupLocation,
  hasCandidates,
  selectedBackupCandidate,
}) {
  if (backupCandidateStatus && !hasCandidates && !hasBackupLocation) {
    return backupCandidateStatus;
  }
  if (selectedBackupCandidate) {
    return "The app found a local iPhone backup. Import when you are ready.";
  }
  if (hasCandidates) {
    return "Choose the backup you want to import.";
  }
  if (hasBackupLocation) {
    return "A backup location is selected. Check it before importing.";
  }
  return "Find a backup or enter its location.";
}

function simplifyBackupDetail(detail) {
  if (detail.includes("truncated")) {
    return "The backup looks incomplete. The app will still try the direct preparation step, but the backup files may need to finish copying first.";
  }
  if (detail.includes("missing or empty")) {
    return "The expected message data is missing or empty in this backup.";
  }
  return maskPathForDisplay(detail);
}

function ArchiveLoadedCard({ stats, isLoading, isImportToolsOpen, onOpenArchive, onToggleImportTools }) {
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
            {isLoading ? "Archive ready, updating counts" : "Archive ready"}
          </p>
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
      <div className="archive-loaded-actions">
        <button className="secondary-button" type="button" onClick={onOpenArchive}>
          Open archive
        </button>
        <button className="ghost-button" type="button" onClick={onToggleImportTools}>
          {isImportToolsOpen ? "Hide import options" : "Import another backup"}
        </button>
      </div>
      {isLoading && (
        <LoadingStatus
          compact
          label="Updating archive"
          detail="Refreshing message counts."
          className="archive-ready-loading"
        />
      )}
    </section>
  );
}

function removeSteps(currentSteps, stepKeys) {
  const nextSteps = new Set(currentSteps);
  stepKeys.forEach((stepKey) => nextSteps.delete(stepKey));
  return nextSteps;
}

function formatBackupCandidateStatus(candidate) {
  if (candidate.manifest_readable) return "Backup found";
  if (candidate.sms_db_copyable) return "Prepared import ready";
  return "Needs review";
}

function formatBackupCandidateName(candidate) {
  return maskPathForDisplay(candidate.name || "Detected backup");
}

function maskPathForDisplay(value) {
  if (!value) return "";
  return String(value)
    .replace(/\/Users\/[^/\s]+/g, "~")
    .replace(/(MobileSync\/Backup\/)[^/\s]+/g, "$1...")
    .replace(/([A-Fa-f0-9]{16,})/g, "...");
}

function backupCandidateDetailClassName(candidate) {
  return candidate.manifest_readable || candidate.sms_db_copyable ? "" : "field-warning";
}

function getPrimaryImportAction({ canRunQuickImport, hasArchiveData, hasDetectedBackup, canImportSelectedBackup, isBusy }) {
  if (hasArchiveData) {
    return {
      kind: "open",
      label: "Open archive",
      detail: "Review your imported messages.",
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

  if (!canImportSelectedBackup) {
    return {
      kind: "check",
      label: "Check backup",
      detail: "Confirm the selected backup before importing messages.",
      disabled: isBusy,
      disabledReason: undefined,
    };
  }

  return {
    kind: "import",
    label: "Import messages",
    detail: "The app will prepare, check, and import your messages into this archive.",
    disabled: !canRunQuickImport || isBusy,
    disabledReason: canRunQuickImport ? undefined : "Back up your iPhone to this computer, then try again.",
  };
}

function getImportLoadingStatus({ activeStep, isFindingBackups, isRefreshingPreparedFiles }) {
  if (isFindingBackups) {
    return {
      label: "Looking for backups",
      detail: "Checking this computer for local iPhone backups.",
    };
  }
  if (isRefreshingPreparedFiles) {
    return {
      label: "Refreshing files",
      detail: "Checking prepared import files.",
    };
  }

  const loadingMessages = {
    diagnostics: ["Checking backup", "Looking at the selected local backup."],
    locate: ["Checking backup", "Looking for message data in the backup."],
    copy: ["Preparing import", "Creating the local copy needed for import."],
    validate: ["Checking prepared import", "Making sure the prepared messages can be read."],
    inspect: ["Checking message totals", "Counting the prepared messages."],
    import: ["Importing messages", "Adding new messages to the archive."],
    "auto-import": ["Importing messages", "Preparing, checking, and importing messages."],
  };
  const message = loadingMessages[activeStep];
  if (!message) return null;
  return { label: message[0], detail: message[1] };
}

function getImportStatus({
  activeStep,
  canUseBackupPath,
  canImportSelectedBackup,
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
      copy: ["Preparing local copy", "Preparing messages for this app's archive."],
      validate: ["Checking message archive", "Checking that the prepared import is ready."],
      inspect: ["Checking message archive", "Checking message totals before import."],
      import: ["Importing messages", "Adding messages to your archive."],
      "auto-import": ["Importing messages", "Preparing, checking, and importing messages."],
    };
    const [title, detail] = busyMessages[activeStep] || ["Working", "Preparing your import."];
    return { title, detail };
  }

  if (!hasDetectedBackup && !importableBackupCandidate) {
    return {
      title: "Back up your iPhone first",
      detail: "Plug in your iPhone and use Finder to create a local backup, then find it here.",
    };
  }

  if (!canUseBackupPath && importableBackupCandidate) {
    return {
      title: "Backup found",
      detail: "Import messages when you are ready.",
    };
  }

  if (!completedSteps.has("import")) {
    if (canUseBackupPath && !canImportSelectedBackup) {
      return {
        title: "Check backup first",
        detail: "The app will confirm this backup before importing messages.",
      };
    }

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
      label: "Back up iPhone",
      number: "1",
      isComplete: hasDetectedBackup || hasArchiveData,
      isActive: isActive(["diagnostics", "locate"]) || (!hasDetectedBackup && !hasArchiveData),
    },
    {
      key: "import",
      label: "Import messages",
      number: "2",
      isComplete: completedSteps.has("import") || hasArchiveData,
      isActive: isActive(["copy", "validate", "inspect", "import", "auto-import"]),
    },
    {
      key: "ready",
      label: "Search and export",
      number: "3",
      isComplete: hasArchiveData,
      isActive: hasArchiveData,
    },
  ];
}

function toImportErrorMessage(error) {
  if (error?.status) return "The import could not be completed. Try again, or open technical import details.";
  if (error?.kind === "service-unavailable" || error?.name === "TypeError") {
    return "The local app is not responding. Restart it and try again.";
  }
  return error?.message || "The import could not be completed.";
}

function buildDiagnosticError(data) {
  if (!data.backup_folder_exists) {
    return "This app cannot see that backup folder right now.";
  }
  if (!data.backup_folder_is_directory) {
    return "The selected backup path exists, but it is not a folder.";
  }
  if (!data.manifest_exists) {
    return "The selected backup is missing information this app needs.";
  }
  if (!data.manifest_readable_sqlite) {
    return data.manifest_appears_truncated
      ? "The selected backup appears incomplete."
      : "The selected backup could not be read.";
  }
  if (data.backup_appears_encrypted) {
    return "This backup appears encrypted. The app will need a temporary local backup it can read.";
  }
  if (!data.sms_db_manifest_entry_exists) {
    return "The backup does not list the message data this app needs.";
  }
  if (!data.sms_db_payload_exists) {
    return "The backup lists message data, but the matching file was not found.";
  }
  if (!data.sms_db_payload_nonzero) {
    return "The matching message data exists but is empty.";
  }
  return "The backup did not pass diagnostics.";
}

function formatResultLabel(label) {
  return RESULT_LABELS[label] || label.replaceAll("_", " ");
}

function formatResultValue(value) {
  if (typeof value === "number") return new Intl.NumberFormat().format(value);
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (value === null || value === undefined) return "Unknown";
  return maskPathForDisplay(value);
}

function formatArchiveDate(value) {
  if (!value) return "No messages";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
}
