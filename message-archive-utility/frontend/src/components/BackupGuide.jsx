import React from "react";

const BACKUP_STEPS = [
  "Connect your iPhone to this Mac with a cable.",
  "Open Finder.",
  "Select your iPhone in the Finder sidebar.",
  "If prompted, unlock your iPhone and tap Trust This Computer.",
  "In Finder, choose General.",
  "Under Backups, select \"Back up all of the data on your iPhone to this Mac.\"",
  "Make sure \"Encrypt local backup\" is not selected for this import.",
  "Click Back Up Now.",
  "When the backup finishes, return here and click Import Messages or Find iPhone backup.",
];

export default function BackupGuide({ className = "", compact = false }) {
  return (
    <details className={`backup-guide ${compact ? "is-compact" : ""} ${className}`.trim()}>
      <summary>How to create the backup</summary>
      <div className="backup-guide-body">
        <p>This app needs an unencrypted local iPhone backup on this Mac.</p>
        <ol>
          {BACKUP_STEPS.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
        <p className="backup-guide-caution">
          This version imports unencrypted local backups only. If your regular backup is encrypted, create a temporary unencrypted backup for this import, then delete it afterward if you do not want to keep it.
        </p>
      </div>
    </details>
  );
}
