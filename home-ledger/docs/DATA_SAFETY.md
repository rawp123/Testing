# Data Safety

Home Basis Tracker is designed to keep private home records local and understandable.

## What Stays Local

- Properties, projects, expenses, documents, notes, and extracted text stay in local app storage.
- Attached files are copied into app-managed local storage.
- Full backups and exports are created only when the user chooses to download or save them.
- No account, cloud sync, analytics, telemetry, remote OCR, or external document API is part of the app runtime.

## What Users Must Protect

Full backup JSON files can include:

- Property addresses.
- Vendor names.
- Amounts and dates.
- Notes.
- Receipts, invoices, permits, contracts, and photos encoded in the file.
- Locally extracted document text.

Treat backups like private financial and home records. Store them somewhere already trusted for important personal files.

## Restore Guardrails

Restore validates the backup envelope before replacing local records. It rejects or skips unsafe conditions including duplicate record IDs, broken relationships, duplicate file entries, unknown attachment targets, blocked executable-style attachment types, oversized files, malformed checksums, and mismatched checksums on newer backups.

Restore does not upload the backup. It replaces the current local records after user confirmation.

## Path Privacy

User-facing fields are sanitized to remove raw local file paths such as `/Users/...`, `C:\...`, `~/...`, and `file://...`. Desktop storage uses safe file names and app-managed IDs instead of original source paths.

## Deletion Behavior

When a document or attachment is removed, the app tries to delete the stored file before removing the record reference. If file deletion fails, the record stays visible so the user can retry instead of losing track of a private stored copy.

## Practical Backup Advice

- Download a full backup before restoring another backup.
- Keep at least one backup outside the app storage location.
- Do not commit private documents, backups, exports, or fixture files.
- Re-test restore after meaningful storage or backup changes.
