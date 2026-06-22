# Current Local App Model

This document captures the existing local Home Basis Tracker / Home Ledger data model. It is descriptive, not a new schema proposal.

## Sources Inspected

- `backend/domain/model.js`: `EMPTY_DATA`, constants, sanitize functions, relationship normalization, CSV export, readiness and follow-up helpers.
- `backend/storage/records-storage.js`: browser and desktop record persistence.
- `backend/storage/document-storage.js`: document file metadata and blob persistence.
- `desktop/main.cjs`: desktop record and attachment storage limits, IPC handlers, PDF save behavior.
- `desktop/storage-helpers.cjs`: desktop safe id, filename, and buffer helpers.
- `frontend/app.js`: add/edit flows, document upload, OCR, preview, delete/unlink behavior, filters, dashboard activity.
- `tests/model.test.mjs`: model, CSV, readiness, follow-up, completeness, helper edge cases.
- `tests/tutorial-data.test.mjs`: tutorial/sample data shape and expected coverage.
- `tests/ui-copy.test.mjs`: production copy expectations for dashboard, document form, export/backup, tutorial mode.
- Existing docs: `docs/ARCHITECTURE.md`, `docs/DATA_SAFETY.md`, `docs/REAL_WORLD_DOCUMENT_QA.md`, `docs/HUMAN_REVIEW_CHECKLIST.md`.

## Confirmed Behavior

### Data Root

The canonical local data object is defined by `EMPTY_DATA` in `backend/domain/model.js`:

```js
{
  vendors: [],
  properties: [],
  projects: [],
  expenses: [],
  documents: [],
  followUpOverrides: [],
}
```

Records are sanitized through `sanitizeData(data)`. Each record collection is capped by `MAX_RECORDS_PER_TYPE = 5000`. Text-like fields are trimmed, local paths are removed by `removeLocalPaths(value)`, and text is capped by `MAX_TEXT_LENGTH = 5000`.

Record persistence uses `loadRecords(storageKey)` and `saveRecords(storageKey, data)` in `backend/storage/records-storage.js`. Browser mode stores sanitized records in `localStorage` under `STORAGE_KEY = "home-ledger:v1"`. Desktop mode delegates to the desktop bridge.

### Vendors

Source: `sanitizeVendor(record)` and `normalizeRelationships(data)` in `backend/domain/model.js`.

Fields:

| Field | Rule |
| --- | --- |
| `id` | Clean string. Required for persisted vendor records. |
| `name` | Clean string. Required for persisted vendor records. |
| `category` | Clean option from expense categories. Defaults to `other`. |
| `contactName` | Optional clean string. |
| `phone` | Optional clean string. |
| `email` | Optional clean string. |
| `website` | Optional clean string. |
| `notes` | Optional clean string. |
| `status` | `active` or `archived`. Defaults to `active`. |

Vendor records can also be inferred from legacy project contractor names and expense vendor/payee names during `normalizeRelationships(data)`. Inferred ids use the form `vendor_<slug>`. Vendor names are de-duplicated by normalized name.

### Properties

Source: `sanitizeProperty(record)` and `normalizeRelationships(data)` in `backend/domain/model.js`.

Fields:

| Field | Rule |
| --- | --- |
| `id` | Clean string. Required for persisted property records. |
| `name` | Clean string. Required for persisted property records. |
| `address` | Optional clean string. |
| `purchaseDate` | Optional ISO date, `YYYY-MM-DD`. Invalid dates become blank. |
| `purchasePrice` | Nonnegative parsed amount. Defaults to `0`. |
| `notes` | Optional clean string. |
| `isPrimary` | Boolean. Only the first primary property remains primary after normalization. |

Properties without both `id` and `name` are dropped. Properties are sorted with the primary property first.

### Projects

Source: `sanitizeProject(record)`, `normalizeRelationships(data)`, and project form handling in `frontend/app.js`.

Fields:

| Field | Rule |
| --- | --- |
| `id` | Clean string. Required for persisted project records. |
| `propertyId` | Required after normalization. Invalid property ids fall back to the first usable property. Project is dropped if no property exists. |
| `vendorId` | Optional. Resolved against normalized vendors when possible. |
| `name` | Clean string. Required for persisted project records. |
| `category` | Expense category option. Defaults to `other`. |
| `startDate` | Optional ISO date. |
| `completionDate` | Optional ISO date. |
| `contractor` | Optional clean string. Also used to infer or resolve vendor. |
| `permitNumber` | Optional clean string. |
| `status` | One of `planned`, `in progress`, `blocked`, `completed`, `archived`. Defaults to `planned`. |
| `scopeSummary` | Optional clean string. |
| `notes` | Optional clean string. |
| `completenessOverrideNote` | Optional clean string. When present, project completeness is marked complete by note. |

Deleting a project in `frontend/app.js` keeps related expenses and documents but clears their `projectId`.

### Expenses

Source: `sanitizeExpense(record)`, `normalizeRelationships(data)`, `saveExpense(values)` in `frontend/app.js`, and tests in `tests/model.test.mjs`.

Fields:

| Field | Rule |
| --- | --- |
| `id` | Clean string. Required for persisted expense records. |
| `propertyId` | Required after normalization. Invalid property ids fall back to the first usable property. Expense is dropped if no property exists. |
| `projectId` | Optional. Kept only if the project exists and belongs to the same property. |
| `vendorId` | Optional. Resolved against normalized vendors when possible. |
| `date` | Optional ISO date. |
| `vendor` | Optional clean string. Also used to infer or resolve vendor. |
| `description` | Clean string. Required for persisted expense records. |
| `amount` | Nonnegative parsed amount rounded to 2 decimal places. Defaults to `0`. |
| `classification` | One of the classification values below. Defaults to `unclear / ask CPA`. |
| `category` | Expense category option. Defaults to `other`. |
| `documentationStatus` | One of the document status values below. Defaults to `no document yet`. |
| `notes` | Optional clean string. |

Deleting an expense keeps related documents but clears their `expenseId`.

Money is stored as a JavaScript number rounded to two decimals. Future migration should not infer that this is the desired cloud representation.

### Documents

Source: `sanitizeDocument(record)`, `saveDocument(values, file)` in `frontend/app.js`, document storage helpers, and backup tests.

Fields:

| Field | Rule |
| --- | --- |
| `id` | Clean string. Required for persisted document records. |
| `propertyId` | Required after normalization. If linked to an expense, it is derived from the expense. |
| `projectId` | Optional. If linked to an expense, it is derived from the expense. Otherwise it must belong to the selected property. |
| `expenseId` | Optional. If present and valid, document property/project context follows the expense. |
| `displayName` | Clean string. Required after form save. Defaults to explicit name, file name, linked expense draft name, previous name, or `Untitled document`. |
| `documentType` | One of the document type values below. Defaults to `other`. |
| `addedDate` | Optional ISO date in model sanitization. The form requires a valid date before saving. |
| `notes` | Optional clean string. |
| `ocrText` | Optional clean string. Persisted text extracted from document reading. |
| `hasFile` | Boolean. True when file metadata points to a stored copy or tutorial sample metadata. |
| `fileId` | Optional clean string id for stored blob. |
| `fileName` | Optional safe filename. |
| `fileStatusNote` | Optional status note for missing, removed, tutorial, or unrestored file states. |
| `mimeType` | Optional clean string. |
| `fileSize` | Number. Defaults to `0`. |
| `fileLastModified` | Optional value from file metadata. |
| `fileStoredAt` | Optional timestamp string. |

Deleting a document removes the stored copy if one exists and the document is not tutorial-only. Removing an attachment keeps the document entry and clears file metadata.

### Follow-up Overrides

Source: `sanitizeFollowUpOverride(record)`, `getRecordFollowUps(data, options)`, `saveFollowUpOverride` flow in `frontend/app.js`, and `tests/model.test.mjs`.

Fields:

| Field | Rule |
| --- | --- |
| `id` | Clean string. Required. Must match the follow-up item id to suppress that item. |
| `label` | Clean string copied from the completed item. |
| `typeLabel` | Clean string copied from the completed item. |
| `detail` | Clean string copied from the completed item. |
| `propertyId` | Optional context id. |
| `projectId` | Optional context id. |
| `expenseId` | Optional context id. |
| `documentId` | Optional context id. |
| `note` | Optional clean string. |
| `completedAt` | Optional timestamp string. |

Overrides suppress only the exact generated follow-up id. They do not change the underlying source record.

### Enums And Constants

Source: `backend/domain/model.js`.

Project statuses:

- `planned`
- `in progress`
- `blocked`
- `completed`
- `archived`

Classification values and labels:

- `potential basis addition`: `Possible improvement`
- `repair or maintenance`: `Repair / upkeep`
- `unclear / ask CPA`: `Not sure, review later`

Document statuses:

- `receipt attached`
- `invoice attached`
- `no document yet`
- `needs follow-up`

Document types:

- `receipt`
- `invoice`
- `permit`
- `warranty`
- `photo`
- `contract`
- `payment record`
- `appraisal`
- `inspection`
- `plan or drawing`
- `other`

Vendor statuses:

- `active`
- `archived`

Limits:

- App records per type: `5000`.
- Text fields: `5000` characters after path scrubbing.
- Document file size: `25 MB`.
- Backup file size: `500 MB`.
- Desktop records JSON size: `15 MB`.
- Desktop review HTML size: `5 MB`.
- Desktop review PDF size: `50 MB`.
- OCR plain text file reading: `2 MB`.
- OCR PDF reading: first `25` pages.
- OCR PDF page render: up to `12,000,000` pixels, scale between `0.65` and `3`.

### Relationships

Source: `normalizeRelationships(data)` and `validateBackupRelationships(data)` in `backend/domain/model.js` and `backend/domain/backup.js`.

Confirmed rules:

- Every retained project, expense, and document must resolve to a property.
- Invalid project `propertyId` values fall back to the first usable property during sanitize.
- Invalid expense `projectId` values are cleared unless the project belongs to the same property.
- Documents linked to expenses inherit the expense property and project.
- Documents not linked to expenses can link to a property and optional project.
- Vendor ids are optional when a legacy vendor or contractor name exists.
- Deleting a property removes its projects, expenses, documents, and stored document copies.
- Deleting a project keeps expenses and documents and clears their project links.
- Deleting an expense keeps documents and clears their expense links.
- Deleting a document removes or clears only that document and reconciles linked expense document status.

Backup relationship validation is stricter than normal sanitization: duplicate ids and broken property/project/document/expense relationships can reject restore rather than silently normalize.

### Tutorial And Sample Data

Source: `tests/tutorial-data.test.mjs`, `tests/ui-copy.test.mjs`, and tutorial paths in `frontend/app.js`.

Confirmed behavior:

- Tutorial data is expected to include at least two properties, twelve projects, twenty-five expenses, and thirty documents.
- Tutorial data exercises multiple statuses, classifications, document types, permit/scope behavior, export, backup, and restore flows.
- Tutorial document files are metadata-only. They should not create real stored file content.
- Tutorial backups validate with no embedded file payloads.
- Tutorial copy must keep sample data clearly separate from real home records.

## Inferred Or Ambiguous Behavior

- `addedDate` is optional in model sanitization but required by the current document form save flow. A migration should preserve blank legacy values if they exist, while new UI can require dates.
- Amounts are stored as numbers, not integer cents. This is source behavior, not a recommendation for cloud storage.
- Address is one free-form string. No source code currently parses street/city/state/ZIP.
- Vendor normalization is name-based and can merge legacy vendors with matching normalized names. There is no canonical vendor identity beyond local ids and names.
- Project `contractor` remains as a legacy text field even when `vendorId` is resolved. It should not be treated as a separate guaranteed vendor entity without import rules.
- `classification` values use legacy strings. The app displays safer labels, but migration must preserve legacy values or map them explicitly.
- `document.hasFile` can mean a real stored copy, tutorial sample metadata, or stale metadata until preview/download detects the missing blob.

