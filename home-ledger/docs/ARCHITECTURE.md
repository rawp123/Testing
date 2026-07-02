# Architecture

Home Ledger is a local records binder for property improvement records. It is intentionally separate from Message Archive Utility, Car Care Log, and the root website workspace.

## Product Layers

- `website/`: standalone product website and support pages for Home Ledger.
- `frontend/`: browser UI, app state, document preview, local text extraction, export, backup, and restore flows.
- `backend/domain/`: shared local model rules, validation, CSV export, backup envelope validation, and restore helpers.
- `backend/storage/`: browser storage adapters plus the desktop bridge adapter.
- `desktop/`: Electron shell, private app-managed record/document storage, packaging, signing, notarization, and desktop smoke tests.
- `tests/`: Node tests for domain rules, backup/restore helpers, and desktop storage helpers.
- `docs/`: architecture, safety, release, and real-world QA references.

## Data Model

The structured record file stores four arrays:

- `properties`
- `projects`
- `expenses`
- `documents`

Documents may point to a property, project, and expense. File attachments are stored separately and referenced by `fileId`. Records keep safe metadata only: display name, document type, file name, MIME type, size, added date, stored date, notes, and optional locally extracted text.

`backend/domain/model.js` sanitizes display text, strips raw local paths, validates dates/options/amounts, caps record/text lengths, and normalizes record relationships for normal app saves. Backup restore adds stricter envelope checks in `backend/domain/backup.js` before sanitized data is accepted.

## Storage

The app does not use accounts, cloud sync, analytics, telemetry, server storage, or third-party document APIs.

Desktop storage:

- Records are stored in an app-managed `records.json`.
- A readable `.bak` copy is preserved before record replacement when possible.
- Document blobs are stored in an app-managed `documents/` folder.
- Attachment metadata is stored in `attachments.json`.
- Writes use temporary files, fsync best-effort, rename, and private file modes where supported.
- Desktop file IDs must already match the safe id pattern; unsafe IDs are rejected rather than normalized into possible collisions.

Browser storage:

- Records are stored in `localStorage`.
- Attached files are stored in IndexedDB.
- Browser storage is convenient local app storage, not a backup.

## Backup And Restore

Full backups are private JSON files. They include structured records and attached files encoded as data URLs. New backup file entries include SHA-256 hashes so restore can detect changed or truncated attachment payloads.

Restore currently validates:

- Legacy backup app id.
- Supported backup version.
- Duplicate record IDs.
- Project, expense, and document relationships.
- Duplicate attached file entries.
- Unknown attached file targets.
- File checksum format.
- Blocked active/executable file types.
- Maximum file payload size.

Older backups without attachment checksums can still restore when the rest of the envelope is valid. Newer backups with checksums skip any attachment whose payload hash does not match.

## Local Document Reading

Document text extraction runs locally in the app:

- Images use local Tesseract OCR.
- PDFs use local PDF text/page processing.
- Plain text files are read locally.

Extraction is advisory. It saves notes/text for organization only and does not calculate tax basis, provide tax advice, or upload documents.

## Network Posture

Core app functionality does not require runtime network access. There is no cloud backend, no login, no payment flow, no telemetry, and no third-party OCR or AI service in the app runtime.

## Known Limitations

- Full backups are plaintext JSON and can contain private home, vendor, receipt, invoice, permit, photo, and note data.
- Browser storage can be cleared by browser profile changes or private browsing behavior.
- Text extraction is best effort and should be reviewed by the user.
- The app organizes records for CPA review; it does not compute tax basis or determine deductibility.
