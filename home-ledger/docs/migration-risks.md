# Migration Risks And Ambiguities

This document lists risks in using the current local Home Basis Tracker / Home Ledger app as the source for a future web/iOS migration. It does not define a SaaS schema or API.

## Sources Inspected

- `backend/domain/model.js`: current entities, sanitize rules, relationship normalization, export, follow-up generation.
- `backend/domain/backup.js`: backup envelope, validation, restore file rules.
- `backend/storage/records-storage.js`: local/browser and desktop record storage assumptions.
- `backend/storage/document-storage.js`: browser IndexedDB and desktop document storage bridge.
- `desktop/main.cjs`: desktop filesystem storage, IPC, attachment limits, backup/PDF save behavior.
- `desktop/storage-helpers.cjs`: safe local attachment ids and filenames.
- `frontend/app.js`: UI flows for save/delete/restore/OCR/preview/filtering/dashboard follow-ups.
- `tests/model.test.mjs`: expected model, follow-up, completeness, CSV behavior.
- `tests/backup.test.mjs`: backup validation and restore edge cases.
- `tests/desktop-storage.test.mjs`: desktop storage guardrails.
- `tests/tutorial-data.test.mjs`: tutorial/sample-data assumptions.
- `tests/ui-copy.test.mjs`: copy boundaries and dashboard/document/export expectations.
- Existing docs: `docs/ARCHITECTURE.md`, `docs/DATA_SAFETY.md`, `docs/REAL_WORLD_DOCUMENT_QA.md`, `docs/HUMAN_REVIEW_CHECKLIST.md`, `docs/language-review-export.md`.

## Confirmed Source Constraints

- The local app organizes home records for review. It does not make tax, legal, accounting, or compliance conclusions.
- Current storage is local-first: browser `localStorage` plus IndexedDB, or desktop records JSON plus local document blobs.
- Full backup JSON is the best current migration source because it can contain records and attached file data URLs.
- Backup restore is a replace operation, not a merge/import operation.
- Records use local ids directly in relationships and follow-up ids.
- Amounts are stored as JavaScript numbers rounded to two decimals.
- Attachments are stored as local blobs with separate document metadata.
- OCR text is stored on the document record as `ocrText`.
- Follow-up counts are derived and should be recomputed.

## Lossy Or Ambiguous Field Mappings

### Money

Current source behavior stores amounts as numbers. This can preserve two decimal display behavior but is not ideal for a cloud money model. The SaaS transition guidance should use integer cents, but import must account for existing numeric backup values.

Risk:

- Floating point edge cases.
- Ambiguous currency, currently implied rather than stored.
- Zero can mean true zero or invalid/blank input sanitized to zero.

### Dates

Dates are accepted only as valid ISO `YYYY-MM-DD` strings by model sanitization. Invalid dates become blank.

Risk:

- No timezone or timestamp semantics for purchase/start/completion/expense/document dates.
- `addedDate` is optional in the model but required in the current document form.
- Existing blank dates may be meaningful gaps rather than unknown user intent.

### Addresses

Property address is a single free-form string.

Risk:

- Street/city/state/ZIP parsing would be lossy and error-prone.
- A cloud schema should not assume normalized address parts can be safely derived.

### Vendor Identity

`normalizeRelationships(data)` merges explicit vendors, project contractors, and expense vendor names by normalized name.

Risk:

- Distinct vendors with similar names can merge.
- Legacy contractor text can become a vendor id.
- Expense/project vendor text may conflict with explicit vendor ids.
- Future import should preserve original legacy vendor text and source ids where possible.

### Classification Language

Current stored values include `potential basis addition`, `repair or maintenance`, and `unclear / ask CPA`. UI labels use safer review-oriented language.

Risk:

- Stored enum values are legacy strings and should not be exposed as product claims in new public copy.
- Migration needs explicit mapping between stored values and display labels.

## Legacy Id Risks

Current ids are used in:

- entity relationships
- document file payload matching
- follow-up item ids
- follow-up override ids
- UI selection state

Risk:

- Replacing ids during import can break relationships unless all links are remapped atomically.
- Replacing ids can break `followUpOverrides` because override ids embed source ids.
- Duplicate ids currently reject backup restore. A future cloud importer that supports multiple imports must preserve legacy ids in import metadata and generate new cloud primary keys.

## File Import Risks

Source files can be represented in several ways:

- Real stored file copied into backup as a data URL.
- Document metadata says `hasFile: true`, but file payload is missing.
- File was too large, blocked, missing, corrupt, or checksum failed.
- Tutorial file metadata exists without real file content.
- User removed the stored file but kept the document record.

Risk:

- `hasFile` cannot be treated as guaranteed file content until a valid file payload is imported.
- Empty checksum values are allowed in current backups.
- File ids are local storage ids and should not become cloud object ids.
- Blocked extensions and MIME prefixes should remain blocked or reviewed before upload.
- Raw object storage keys must not be exposed in a cloud product.

## OCR Import Risks

Current OCR behavior stores only `ocrText` on the document record. Processing status is UI state and is not persisted as a durable workflow state.

Risk:

- The importer cannot know whether OCR never ran, failed, or produced blank text unless `ocrText` is present.
- OCR text can contain sensitive information and must be protected like uploaded documents.
- Re-running OCR in the cloud or on iOS may produce different output from the current local Tesseract/PDF.js behavior.

## Duplicate Import Risks

Current restore rejects duplicate ids inside one backup. It does not address importing multiple backups into one account/workspace.

Risk:

- Same local app backup imported twice could duplicate every record.
- Later backups may represent updated versions of earlier records.
- Attachments can duplicate even when document metadata looks similar.
- Vendor normalization can make duplicate detection harder because legacy records may already be merged by name.

Potential import design need:

- Preserve legacy backup id, backup created timestamp, and source app id in import metadata.
- Define idempotency rules before allowing repeated imports.

## Follow-up Override Matching Risks

Source: `followUpOverrides` and deterministic follow-up ids in `backend/domain/model.js`.

Risk:

- Overrides suppress exact generated ids.
- If migration changes project/expense/document ids or rule id strings, existing overrides will no longer suppress the intended item.
- Project `completenessOverrideNote` suppresses all project follow-ups and may hide child expense/document gaps after migration if copied directly.

Recommended source behavior preservation:

- Import override records.
- Preserve legacy ids in metadata.
- Recompute follow-ups after import using either legacy ids or a migration-aware id mapping.

## Relationship And Delete Behavior Risks

Confirmed local delete behavior:

- Delete property removes related projects, expenses, documents, and stored copies.
- Delete project keeps related expenses/documents but clears project links.
- Delete expense keeps documents but clears expense links.
- Delete document can delete stored copy and reconcile expense document status.

Risk:

- Cloud soft-delete/archive behavior may differ from local destructive delete behavior.
- Restore currently replaces all data; a cloud import should not blindly replace a workspace unless explicitly designed.
- Documents linked to expenses inherit expense property/project context, so import must preserve that derivation or reconcile conflicts.

## Local-only Assumptions Not To Copy Directly

- Browser `localStorage` and IndexedDB storage labels.
- Desktop app data directory paths.
- Desktop IPC trust model and file blob paths.
- Local file ids as durable attachment identifiers.
- Save-dialog based backup/PDF flows.
- Local OCR dependency loading paths from `node_modules`.
- Tutorial metadata that pretends file details exist without real files.

## Export And Copy Risks

Source: `buildExpensesCsv(data)` in `backend/domain/model.js`, PDF generation in `frontend/app.js`, and `tests/ui-copy.test.mjs`.

Confirmed behavior:

- CSV includes expense-oriented review fields and neutralizes spreadsheet formulas.
- PDF review packet includes property, project, expense, and document index sections.
- Attached file contents are not embedded in the PDF.
- Product copy should preserve the distinction between organizing records and making conclusions.

Risk:

- Future SaaS export should keep spreadsheet formula neutralization.
- Export copy should avoid tax/legal/accounting conclusions.
- Public copy should not expose old internal classification strings as claims.

## Open Product/Engineering Questions

- What is the canonical cloud workspace boundary: one household, one user, multiple properties, or shareable professional-review workspaces?
- Should import preserve current local ids as visible/importable identifiers, or only as hidden legacy metadata?
- What is the idempotency rule for importing the same backup more than once?
- How should duplicate vendors be detected without accidentally merging unrelated vendors?
- Should `classification` be renamed in the cloud model while preserving legacy backup values?
- Should `unclear / ask CPA` remain a stored enum value, or migrate to a neutral value like `review later`?
- Should `completenessOverrideNote` continue suppressing all project follow-ups, including child expense/document issues?
- Should item-level follow-up overrides expire or be rechecked when the underlying source record changes?
- Should the cloud importer accept backups with blank checksums, or require users to confirm lower-confidence file imports?
- Should OCR text be imported automatically, reprocessed, or marked as legacy extracted text?
- What is the maximum cloud attachment size, and should it match the local `25 MB` limit?
- Should blocked file extension/MIME rules match the local backup rules exactly?
- How should free-form property addresses be handled if the web/iOS product wants structured address fields?
- What explicit data deletion/export promises should the SaaS product make?
- What support/admin access model is acceptable for uploaded documents and OCR text?

