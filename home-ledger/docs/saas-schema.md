# SaaS Schema Design

This document proposes a PostgreSQL-ready SaaS schema for a web-first Home Ledger product with iOS as a capture/review companion. It is a design document only. It does not create migrations, API routes, or runtime behavior.

## Source Context

Primary source docs:

- `docs/current-app-model.md`
- `docs/backup-format.md`
- `docs/follow-up-rules.md`
- `docs/migration-risks.md`

Confirmed local behavior comes from those docs, which cite:

- `backend/domain/model.js`
- `backend/domain/backup.js`
- `backend/storage/document-storage.js`
- `backend/storage/records-storage.js`
- `frontend/app.js`
- `tests/model.test.mjs`
- `tests/backup.test.mjs`

## Confirmed Local Behavior To Preserve

- The product organizes home records for review. It must not make tax, legal, accounting, or compliance conclusions.
- Local entities are vendors, properties, projects, expenses, documents, and follow-up overrides.
- Local backups preserve records, document metadata, optional file payloads, and missing file notes.
- Follow-ups are derived from records and overrides. Generated open items should be recomputed, not imported as permanent records.
- Documents have metadata separate from stored file content.
- OCR text is currently stored on the document, but OCR processing state is not persisted locally.
- Local ids are embedded in relationships and follow-up override ids.
- Local money values are numbers, but future SaaS storage should use integer cents.

## Recommended SaaS Design Decisions

- Use UUID primary keys for SaaS records.
- Preserve local legacy ids in import metadata, never as SaaS primary keys.
- Use `amount_cents bigint` for money and keep `currency_code char(3)` for future clarity. Default imported currency to `USD` with an import note because local backups do not store currency.
- Preserve property addresses as display/raw text. Do not parse into street/city/state/ZIP unless the user later confirms structured fields.
- Preserve raw imported vendor names and contractor/payee strings even when linked to a vendor record.
- Keep document metadata separate from file/blob records.
- Store object storage keys only in server-side file rows. Never expose raw object storage keys to clients.
- Persist OCR state separately from OCR text.
- Treat local `hasFile` ambiguity as file availability/import status, not as one SaaS boolean.
- Recompute follow-ups after import.
- Preserve follow-up override intent by storing source follow-up id plus resolved source record/type context.
- Soft-delete user records where practical, while supporting explicit export and deletion workflows.
- Keep subscriptions, entitlements, and reminders simple for MVP.

## Recommended Table List

Identity and tenancy:

- `users`
- `workspaces`
- `workspace_memberships`

Core records:

- `properties`
- `vendors`
- `projects`
- `expenses`
- `documents`
- `document_files`
- `document_ocr`
- `follow_up_overrides`
- `activity_events`

Import/export:

- `import_batches`
- `import_records`
- `import_files`
- `exports`

Design-level SaaS operations:

- `subscriptions`
- `workspace_entitlements`
- `notifications`
- `reminders`
- `audit_events`

Later, only if needed:

- `workspace_invitations`
- `reviewer_access_grants`
- `saved_filter_views`
- `webhook_events`
- `billing_events`

## Relationship Diagram

```text
users
  -> workspace_memberships <- workspaces

workspaces
  -> properties
  -> vendors
  -> projects -> properties
              -> vendors
  -> expenses -> properties
              -> projects
              -> vendors
  -> documents -> properties
               -> projects
               -> expenses
  -> document_files -> documents
  -> document_ocr -> documents
  -> follow_up_overrides -> properties/projects/expenses/documents
  -> activity_events -> optional record references
  -> import_batches -> import_records/import_files
  -> exports
  -> subscriptions/workspace_entitlements
  -> notifications/reminders
  -> audit_events
```

## Shared Column Conventions

Recommended for most workspace-scoped tables:

- `id uuid primary key`
- `workspace_id uuid not null references workspaces(id)`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`
- `deleted_at timestamptz null`
- `created_by_user_id uuid null references users(id)`
- `updated_by_user_id uuid null references users(id)`
- `legacy_source jsonb not null default '{}'::jsonb`

`legacy_source` should hold import-only identifiers and raw values, for example:

```json
{
  "source_app": "home-basis-tracker",
  "backup_version": 1,
  "import_batch_id": "...",
  "legacy_entity": "project",
  "legacy_id": "project_1",
  "raw": {
    "classification": "unclear / ask CPA"
  }
}
```

For common lists, prefer partial indexes where `deleted_at is null`.

## Authorization Model Summary

MVP roles:

- `owner`: manage workspace, billing, members, export, deletion, all records.
- `editor`: create/edit/delete records, upload documents, run OCR, export records.
- `viewer`: view records and download/export if allowed by workspace settings.

Recommended permission checks:

- Every record request must be scoped by `workspace_id`.
- Membership is required for workspace access.
- Owners can remove members and request workspace deletion.
- Support/admin access to documents, OCR text, exports, and activity must be intentional and logged in `audit_events`.
- iOS companion access should use the same workspace membership rules.

Do not rely on client-side filtering as an authorization boundary.

## Table Specifications

### `users`

Purpose: Stores account identity. Authentication provider details can be added by implementation, but this table is the product-level user record.

Key fields:

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `id` | `uuid` | Yes | Primary key. |
| `email` | `citext` or `text` | Yes | Unique when not deleted. Use normalized lowercase if `citext` is unavailable. |
| `display_name` | `text` | No | User-facing name. |
| `status` | `text` | Yes | Suggested values: `active`, `disabled`, `pending_deletion`, `deleted`. |
| `timezone` | `text` | No | Used for reminders and activity display. |
| `created_at` | `timestamptz` | Yes |  |
| `updated_at` | `timestamptz` | Yes |  |
| `deleted_at` | `timestamptz` | No | Set for account deletion/anonymization. |

Constraints and indexes:

- Unique active email index: `unique(lower(email)) where deleted_at is null`.
- Index on `status`.

Sensitive fields:

- Email, display name, timezone.

Deletion policy:

- Account deletion should anonymize or delete user identity fields after any required retention window.
- If the user owns workspaces, product must either transfer ownership, delete the workspace, or block deletion until ownership is resolved.

Migration notes:

- Local app has no users. The importer should attach imported records to the importing user and target workspace.

### `workspaces`

Purpose: Tenant boundary for records, files, membership, subscription, exports, imports, and deletion.

Key fields:

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `id` | `uuid` | Yes | Primary key. |
| `name` | `text` | Yes | Workspace name. |
| `owner_user_id` | `uuid` | Yes | References `users(id)`. |
| `status` | `text` | Yes | `active`, `suspended`, `pending_deletion`, `deleted`. |
| `settings` | `jsonb` | Yes | Default `{}`. Use for low-risk UI settings, not authorization. |
| `created_at` | `timestamptz` | Yes |  |
| `updated_at` | `timestamptz` | Yes |  |
| `deleted_at` | `timestamptz` | No | Soft deletion marker. |

Constraints and indexes:

- Index on `owner_user_id`.
- Index on `status`.

Sensitive fields:

- Workspace name can identify a household or property group.

Deletion policy:

- Workspace deletion should cascade or queue deletion of records, documents, files, OCR text, exports, imports, notifications, and activity according to retention policy.
- Hard delete of object files should happen asynchronously and be audited.

Migration notes:

- A local backup should import into one workspace. Multiple imported properties live under that workspace.

### `workspace_memberships`

Purpose: Joins users to workspaces and grants roles.

Key fields:

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `id` | `uuid` | Yes | Primary key. |
| `workspace_id` | `uuid` | Yes | References `workspaces(id)`. |
| `user_id` | `uuid` | Yes | References `users(id)`. |
| `role` | `text` | Yes | `owner`, `editor`, `viewer`. |
| `status` | `text` | Yes | `active`, `invited`, `disabled`, `removed`. |
| `created_at` | `timestamptz` | Yes |  |
| `updated_at` | `timestamptz` | Yes |  |
| `removed_at` | `timestamptz` | No | Membership removal timestamp. |

Constraints and indexes:

- Unique active membership: `(workspace_id, user_id) where removed_at is null`.
- Index on `(user_id, status)`.
- Index on `(workspace_id, role)`.

Sensitive fields:

- Membership records reveal household/workspace access.

Deletion policy:

- Removing a member should not delete records they created.
- Keep creator references nullable so account deletion can anonymize users without deleting records.

Migration notes:

- Local app has no membership model.

### `properties`

Purpose: Stores homes or properties being organized.

Key fields:

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `id` | `uuid` | Yes | Primary key. |
| `workspace_id` | `uuid` | Yes | Tenant scope. |
| `name` | `text` | Yes | Local `property.name`. |
| `display_address` | `text` | No | Preserve local free-form address. |
| `purchase_date` | `date` | No | Local ISO date if present. |
| `purchase_price_cents` | `bigint` | No | Local purchase price converted to cents. |
| `currency_code` | `char(3)` | Yes | Default `USD` for local imports with warning. |
| `notes` | `text` | No | Sensitive. |
| `is_primary` | `boolean` | Yes | Default `false`. Only one active primary property per workspace. |
| `archived_at` | `timestamptz` | No | Optional archive state. |
| `deleted_at` | `timestamptz` | No | Soft deletion marker. |
| `legacy_source` | `jsonb` | Yes | Legacy id/raw fields. |

Constraints and indexes:

- Partial unique index on `(workspace_id) where is_primary = true and deleted_at is null`.
- Index on `(workspace_id, deleted_at, name)`.
- Index on `(workspace_id, archived_at)`.

Sensitive fields:

- Address, purchase price, notes.

Deletion policy:

- Soft-delete first.
- Product decision required before cascading delete of child projects, expenses, documents, and files. Local app deletes child records when deleting a property.

Migration notes:

- Preserve raw local `address` in `display_address`.
- Do not parse address fields during MVP import.
- Convert `purchasePrice` number to cents by rounding `amount * 100`.
- Store source `isPrimary` and legacy id in `legacy_source`.

### `vendors`

Purpose: Stores contractors, vendors, suppliers, and payees.

Key fields:

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `id` | `uuid` | Yes | Primary key. |
| `workspace_id` | `uuid` | Yes | Tenant scope. |
| `name` | `text` | Yes | Display name. |
| `normalized_name` | `text` | No | For search/de-dupe suggestions only. |
| `category` | `text` | No | Preserve local category when present. |
| `contact_name` | `text` | No |  |
| `phone` | `text` | No | Sensitive contact data. |
| `email` | `text` | No | Sensitive contact data. |
| `website` | `text` | No |  |
| `notes` | `text` | No | Sensitive. |
| `status` | `text` | Yes | `active`, `archived`. |
| `source_confidence` | `text` | No | `explicit`, `inferred`, `user_confirmed`. |
| `archived_at` | `timestamptz` | No |  |
| `deleted_at` | `timestamptz` | No |  |
| `legacy_source` | `jsonb` | Yes | Preserve raw local names and ids. |

Constraints and indexes:

- Index on `(workspace_id, deleted_at, name)`.
- Index on `(workspace_id, normalized_name)`.
- Do not make `normalized_name` unique for MVP.

Sensitive fields:

- Contact details, notes, vendor relationships.

Deletion policy:

- Soft-delete vendors.
- Expenses/projects should keep raw vendor/contractor text even if vendor link is cleared.

Migration notes:

- Local normalization can infer vendors from contractor/payee names. Preserve source confidence and raw names.
- Do not force automatic vendor merges in SaaS import.

### `projects`

Purpose: Groups work performed on a property.

Key fields:

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `id` | `uuid` | Yes | Primary key. |
| `workspace_id` | `uuid` | Yes | Tenant scope. |
| `property_id` | `uuid` | Yes | References `properties(id)`. |
| `vendor_id` | `uuid` | No | References `vendors(id)`. |
| `name` | `text` | Yes | Local `project.name`. |
| `category` | `text` | Yes | Local category value. |
| `status` | `text` | Yes | `planned`, `in_progress`, `blocked`, `completed`, `archived`. |
| `start_date` | `date` | No |  |
| `completion_date` | `date` | No |  |
| `contractor_name_raw` | `text` | No | Preserve local `contractor`. |
| `permit_number` | `text` | No |  |
| `scope_summary` | `text` | No | Sensitive. |
| `notes` | `text` | No | Sensitive. |
| `completeness_override_note` | `text` | No | Preserves current project-level override behavior. |
| `completeness_overridden_at` | `timestamptz` | No | SaaS addition for auditability. |
| `archived_at` | `timestamptz` | No |  |
| `deleted_at` | `timestamptz` | No |  |
| `legacy_source` | `jsonb` | Yes | Legacy id and raw fields. |

Constraints and indexes:

- Foreign key `(workspace_id, property_id)` should be enforced by application or composite FK if tables use composite unique keys.
- Index on `(workspace_id, property_id, deleted_at)`.
- Index on `(workspace_id, status, deleted_at)`.
- Index on `(workspace_id, category, deleted_at)`.
- Index on `(workspace_id, start_date)`.
- Index on `(workspace_id, completion_date)`.
- Full-text or trigram index on project name/scope can be added later.

Sensitive fields:

- Scope, notes, permit numbers, contractor context.

Deletion policy:

- Soft-delete by default.
- Local delete clears project links on expenses/documents instead of deleting those records. SaaS should follow that behavior for record-level delete unless product chooses archive-only.

Migration notes:

- Map local status `in progress` to `in_progress`.
- Preserve raw contractor text even when linked to a vendor.
- Preserve `completenessOverrideNote` but flag it as migrated in `legacy_source`.

### `expenses`

Purpose: Stores cost records linked to properties, optional projects, and optional vendors.

Key fields:

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `id` | `uuid` | Yes | Primary key. |
| `workspace_id` | `uuid` | Yes | Tenant scope. |
| `property_id` | `uuid` | Yes | References `properties(id)`. |
| `project_id` | `uuid` | No | References `projects(id)`. |
| `vendor_id` | `uuid` | No | References `vendors(id)`. |
| `vendor_name_raw` | `text` | No | Preserve local expense `vendor`. |
| `expense_date` | `date` | No | Local `date`. |
| `description` | `text` | Yes | Local `description`. |
| `amount_cents` | `bigint` | Yes | Local amount converted to cents. |
| `currency_code` | `char(3)` | Yes | Default `USD` for local imports with warning. |
| `category` | `text` | Yes | Local category value. |
| `record_treatment` | `text` | Yes | Suggested values: `possible_improvement`, `repair_upkeep`, `review_later`. |
| `legacy_classification` | `text` | No | Preserve source value such as `unclear / ask CPA`. |
| `documentation_status` | `text` | Yes | `receipt_attached`, `invoice_attached`, `no_document_yet`, `needs_follow_up`. |
| `notes` | `text` | No | Sensitive. |
| `deleted_at` | `timestamptz` | No |  |
| `legacy_source` | `jsonb` | Yes | Legacy id/raw fields. |

Constraints and indexes:

- `amount_cents >= 0`.
- Index on `(workspace_id, property_id, deleted_at)`.
- Index on `(workspace_id, project_id, deleted_at)`.
- Index on `(workspace_id, vendor_id, deleted_at)`.
- Index on `(workspace_id, expense_date desc)`.
- Index on `(workspace_id, record_treatment, deleted_at)`.
- Index on `(workspace_id, category, deleted_at)`.
- Index on `(workspace_id, documentation_status, deleted_at)`.

Sensitive fields:

- Amount, vendor, description, category, notes.

Deletion policy:

- Soft-delete expenses.
- Local delete unlinks documents from the expense. SaaS should soft-delete the expense and preserve documents, or allow unlinking when the user intentionally deletes the expense.

Migration notes:

- Convert amount with `Math.round(localAmount * 100)` equivalent.
- Preserve `legacy_classification` and map display treatment:
  - `potential basis addition` -> `possible_improvement`
  - `repair or maintenance` -> `repair_upkeep`
  - `unclear / ask CPA` -> `review_later`
- Preserve raw vendor name even when vendor link exists.

### `documents`

Purpose: Stores document metadata and links documents to properties, projects, expenses, and file records.

Key fields:

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `id` | `uuid` | Yes | Primary key. |
| `workspace_id` | `uuid` | Yes | Tenant scope. |
| `property_id` | `uuid` | Yes | References `properties(id)`. |
| `project_id` | `uuid` | No | References `projects(id)`. |
| `expense_id` | `uuid` | No | References `expenses(id)`. |
| `display_name` | `text` | Yes | Local `displayName`. |
| `document_type` | `text` | Yes | Local document type value with normalized spelling. |
| `document_date` | `date` | No | Local `addedDate`; name chosen for current UI copy. |
| `notes` | `text` | No | Sensitive. |
| `file_availability` | `text` | Yes | `available`, `missing`, `not_uploaded`, `removed`, `blocked`, `skipped`, `tutorial_metadata`, `corrupt`, `checksum_failed`. |
| `file_status_note` | `text` | No | Local `fileStatusNote` and import notes. |
| `deleted_at` | `timestamptz` | No |  |
| `legacy_source` | `jsonb` | Yes | Legacy id, local `hasFile`, local file id/name metadata. |

Constraints and indexes:

- Index on `(workspace_id, property_id, deleted_at)`.
- Index on `(workspace_id, project_id, deleted_at)`.
- Index on `(workspace_id, expense_id, deleted_at)`.
- Index on `(workspace_id, document_type, deleted_at)`.
- Index on `(workspace_id, file_availability, deleted_at)`.
- Index on `(workspace_id, document_date desc)`.

Sensitive fields:

- Document names, notes, links to expenses/projects, file status.

Deletion policy:

- Soft-delete document metadata.
- Deleting a document should queue deletion of associated `document_files` object content unless retained by export/audit policy.

Migration notes:

- Local `hasFile` should not map to a boolean. Use `file_availability` plus `document_files` rows.
- If a local document is linked to an expense, preserve the expense-derived property/project relationship.

### `document_files`

Purpose: Stores metadata for uploaded or imported file blobs associated with documents. Object bytes live in private object storage.

Key fields:

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `id` | `uuid` | Yes | Primary key. |
| `workspace_id` | `uuid` | Yes | Tenant scope. |
| `document_id` | `uuid` | Yes | References `documents(id)`. |
| `storage_provider` | `text` | Yes | Example: `s3`, `r2`, `gcs`. |
| `storage_key` | `text` | Yes | Server-only object key. Never expose directly. |
| `original_file_name` | `text` | Yes | Safe display filename. |
| `mime_type` | `text` | Yes |  |
| `size_bytes` | `bigint` | Yes | Must be nonnegative. |
| `sha256` | `text` | No | Hex hash when available. |
| `source` | `text` | Yes | `web_upload`, `ios_upload`, `legacy_import`, `generated_export`. |
| `status` | `text` | Yes | `available`, `pending_upload`, `blocked`, `quarantined`, `deleted`, `failed`. |
| `uploaded_by_user_id` | `uuid` | No | References `users(id)`. |
| `uploaded_at` | `timestamptz` | No |  |
| `deleted_at` | `timestamptz` | No |  |
| `legacy_source` | `jsonb` | Yes | Legacy file id, checksum, data URL import metadata excluding data URL content after import. |

Constraints and indexes:

- Unique active file per document can be enforced with `unique(document_id) where deleted_at is null and status = 'available'` for MVP.
- Index on `(workspace_id, document_id)`.
- Index on `(workspace_id, status)`.
- Index on `(workspace_id, sha256)`.
- `size_bytes >= 0`.

Sensitive fields:

- Filename, MIME type, size, object key, hash.

Deletion policy:

- Soft-delete metadata first.
- Object bytes should be physically deleted by a background job after retention window.
- Access/downloads should be logged in `audit_events` when sensitive access occurs.

Migration notes:

- Import only valid, allowed, size-compliant file payloads.
- Do not carry local file ids into `storage_key`.
- Preserve local file ids only in `legacy_source`.

### `document_ocr`

Purpose: Persists OCR processing state and extracted text separately from document metadata and file storage.

Key fields:

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `id` | `uuid` | Yes | Primary key. |
| `workspace_id` | `uuid` | Yes | Tenant scope. |
| `document_id` | `uuid` | Yes | References `documents(id)`. |
| `document_file_id` | `uuid` | No | References `document_files(id)`. |
| `status` | `text` | Yes | `not_requested`, `queued`, `processing`, `succeeded`, `failed`, `skipped`. |
| `text` | `text` | No | Extracted OCR/plain/PDF text. Sensitive. |
| `text_sha256` | `text` | No | Optional hash for integrity/dedup/debugging. |
| `engine` | `text` | No | Example: `legacy_import`, `tesseract`, `provider_name`. |
| `error_code` | `text` | No | Internal-safe code. |
| `error_message` | `text` | No | Avoid storing unnecessary sensitive content. |
| `started_at` | `timestamptz` | No |  |
| `completed_at` | `timestamptz` | No |  |
| `created_at` | `timestamptz` | Yes |  |
| `updated_at` | `timestamptz` | Yes |  |
| `legacy_source` | `jsonb` | Yes | Marks imported local `ocrText`. |

Constraints and indexes:

- Unique current OCR row per document: `unique(document_id)`.
- Index on `(workspace_id, status)`.
- Full-text search index on `text` can be added later only after privacy/product review.

Sensitive fields:

- OCR text can contain full document content.

Deletion policy:

- Delete or anonymize OCR text with document/workspace deletion.
- Support access to OCR text must be intentional and audited.

Migration notes:

- If local `ocrText` is nonblank, import `status = 'succeeded'`, `engine = 'legacy_import'`.
- If local `ocrText` is blank, import `status = 'not_requested'` unless file import failure indicates `skipped`.

### `follow_up_overrides`

Purpose: Persists user intent to mark a generated follow-up item complete without changing the source record.

Key fields:

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `id` | `uuid` | Yes | Primary key. |
| `workspace_id` | `uuid` | Yes | Tenant scope. |
| `follow_up_type` | `text` | Yes | SaaS rule type. |
| `source_follow_up_id` | `text` | No | Local deterministic id if imported. |
| `property_id` | `uuid` | No | References `properties(id)`. |
| `project_id` | `uuid` | No | References `projects(id)`. |
| `expense_id` | `uuid` | No | References `expenses(id)`. |
| `document_id` | `uuid` | No | References `documents(id)`. |
| `label_snapshot` | `text` | No | Imported/current label snapshot. |
| `detail_snapshot` | `text` | No | Imported/current detail snapshot. |
| `note` | `text` | No | User note. |
| `completed_by_user_id` | `uuid` | No | References `users(id)`. |
| `completed_at` | `timestamptz` | Yes |  |
| `invalidated_at` | `timestamptz` | No | Optional later behavior if source changes. |
| `legacy_source` | `jsonb` | Yes | Local override id/raw context. |

Constraints and indexes:

- Index on `(workspace_id, follow_up_type)`.
- Index on `(workspace_id, project_id)`.
- Index on `(workspace_id, expense_id)`.
- Index on `(workspace_id, document_id)`.
- Unique active override candidate: `(workspace_id, follow_up_type, property_id, project_id, expense_id, document_id) where invalidated_at is null`.

Sensitive fields:

- Notes and detail snapshots can reference expenses, documents, vendors, and projects.

Deletion policy:

- Soft-delete through source record deletion or keep as audit/history depending on workspace retention settings.

Migration notes:

- Resolve local record ids to SaaS ids through `import_records`.
- Preserve local override id in `source_follow_up_id`.
- Recompute follow-ups after import and apply overrides by source id or matched type/context.

### `activity_events`

Purpose: Shows Recent activity, supports user history, and gives the dashboard a unified activity stream.

Key fields:

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `id` | `uuid` | Yes | Primary key. |
| `workspace_id` | `uuid` | Yes | Tenant scope. |
| `actor_user_id` | `uuid` | No | References `users(id)`. Null for import/system. |
| `event_type` | `text` | Yes | `created`, `updated`, `deleted`, `uploaded_file`, `removed_file`, `ocr_completed`, `imported`, `exported`, `follow_up_overridden`. |
| `record_type` | `text` | Yes | `property`, `vendor`, `project`, `expense`, `document`, `file`, `export`, `import`. |
| `record_id` | `uuid` | No | Record id. No cross-table FK. |
| `property_id` | `uuid` | No | Optional context. |
| `project_id` | `uuid` | No | Optional context. |
| `expense_id` | `uuid` | No | Optional context. |
| `document_id` | `uuid` | No | Optional context. |
| `summary` | `text` | Yes | Compact display summary. |
| `metadata` | `jsonb` | Yes | Default `{}`. Avoid sensitive payloads beyond display needs. |
| `occurred_at` | `timestamptz` | Yes |  |

Constraints and indexes:

- Index on `(workspace_id, occurred_at desc)`.
- Index on `(workspace_id, record_type, occurred_at desc)`.
- Index on `(workspace_id, property_id, occurred_at desc)`.
- Index on `(workspace_id, project_id, occurred_at desc)`.

Sensitive fields:

- Activity can reveal amounts, vendors, document names, and usage patterns. Keep summaries minimal.

Deletion policy:

- Retain or purge according to workspace retention. If records are hard-deleted, activity should be redacted or removed.

Migration notes:

- Local app does not persist activity. Import can create activity events for imported records at batch level or synthesize created events with `actor_user_id = null`.

### `import_batches`

Purpose: Tracks one import run from a local backup or future import source.

Key fields:

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `id` | `uuid` | Yes | Primary key. |
| `workspace_id` | `uuid` | Yes | Tenant scope. |
| `imported_by_user_id` | `uuid` | No | References `users(id)`. |
| `source_app` | `text` | Yes | Expected `home-basis-tracker` for local backup. |
| `source_product_version` | `text` | No | Local `productVersion`. |
| `source_backup_version` | `integer` | No | Local `backupVersion`. |
| `source_created_at` | `timestamptz` | No | Backup `createdAt`. |
| `status` | `text` | Yes | `pending`, `validating`, `importing`, `completed`, `completed_with_warnings`, `failed`, `cancelled`. |
| `record_counts` | `jsonb` | Yes | Counts by source/target entity. |
| `file_counts` | `jsonb` | Yes | Expected/imported/skipped/missing counts. |
| `warnings` | `jsonb` | Yes | Structured warnings. |
| `error_message` | `text` | No |  |
| `started_at` | `timestamptz` | No |  |
| `completed_at` | `timestamptz` | No |  |
| `created_at` | `timestamptz` | Yes |  |

Constraints and indexes:

- Index on `(workspace_id, created_at desc)`.
- Index on `(workspace_id, status)`.

Sensitive fields:

- Import warnings can mention filenames, addresses, and vendors.

Deletion policy:

- Keep import logs long enough for user support and migration troubleshooting.
- Do not retain raw backup file contents unless explicitly required by a background import job, and then only temporarily.

Migration notes:

- Supports duplicate import/idempotency design. See unresolved decisions.

### `import_records`

Purpose: Maps each local entity id to its SaaS record id and records transformation warnings.

Key fields:

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `id` | `uuid` | Yes | Primary key. |
| `workspace_id` | `uuid` | Yes | Tenant scope. |
| `import_batch_id` | `uuid` | Yes | References `import_batches(id)`. |
| `source_entity` | `text` | Yes | `property`, `vendor`, `project`, `expense`, `document`, `follow_up_override`. |
| `source_id` | `text` | Yes | Local id. |
| `target_table` | `text` | Yes | SaaS table name. |
| `target_id` | `uuid` | No | SaaS id if imported. |
| `status` | `text` | Yes | `imported`, `skipped`, `merged`, `failed`, `needs_review`. |
| `warnings` | `jsonb` | Yes | Structured warnings. |
| `raw_snapshot` | `jsonb` | No | Optional sanitized source record snapshot. |
| `created_at` | `timestamptz` | Yes |  |

Constraints and indexes:

- Unique per batch source: `(import_batch_id, source_entity, source_id)`.
- Index on `(workspace_id, source_entity, source_id)`.
- Index on `(workspace_id, target_table, target_id)`.

Sensitive fields:

- Raw snapshots can contain addresses, amounts, notes, document names, and OCR context. Store only if needed.

Deletion policy:

- Delete or redact with workspace deletion.
- Consider removing `raw_snapshot` after an import review window.

Migration notes:

- Required for relationship remapping and follow-up override preservation.

### `import_files`

Purpose: Tracks local backup file payload import outcomes.

Key fields:

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `id` | `uuid` | Yes | Primary key. |
| `workspace_id` | `uuid` | Yes | Tenant scope. |
| `import_batch_id` | `uuid` | Yes | References `import_batches(id)`. |
| `source_document_id` | `text` | No | Local document id. |
| `source_file_id` | `text` | No | Local file id. |
| `document_id` | `uuid` | No | SaaS document. |
| `document_file_id` | `uuid` | No | SaaS file row. |
| `source_file_name` | `text` | No |  |
| `source_mime_type` | `text` | No |  |
| `source_size_bytes` | `bigint` | No |  |
| `source_sha256` | `text` | No |  |
| `status` | `text` | Yes | `imported`, `missing`, `blocked`, `too_large`, `checksum_failed`, `corrupt`, `skipped`, `failed`. |
| `warning` | `text` | No | User-safe summary. |
| `created_at` | `timestamptz` | Yes |  |

Constraints and indexes:

- Index on `(workspace_id, import_batch_id)`.
- Index on `(workspace_id, document_id)`.
- Index on `(workspace_id, status)`.

Sensitive fields:

- File names, sizes, hashes, warnings.

Deletion policy:

- Delete with import batch/workspace or retain as migration audit metadata.

Migration notes:

- Models `hasFile` ambiguity explicitly.

### `exports`

Purpose: Tracks generated review packets, CSVs, full backups, and future exports.

Key fields:

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `id` | `uuid` | Yes | Primary key. |
| `workspace_id` | `uuid` | Yes | Tenant scope. |
| `created_by_user_id` | `uuid` | No | References `users(id)`. |
| `export_type` | `text` | Yes | `review_packet_pdf`, `expenses_csv`, `full_backup`, `document_archive`. |
| `status` | `text` | Yes | `queued`, `processing`, `ready`, `failed`, `expired`, `deleted`. |
| `file_id` | `uuid` | No | Could reference `document_files` or a later `stored_files` table. For MVP, keep export object metadata here. |
| `storage_provider` | `text` | No |  |
| `storage_key` | `text` | No | Server-only. |
| `file_name` | `text` | No |  |
| `mime_type` | `text` | No |  |
| `size_bytes` | `bigint` | No |  |
| `parameters` | `jsonb` | Yes | Filters/date range used. |
| `record_counts` | `jsonb` | Yes | Counts included. |
| `expires_at` | `timestamptz` | No |  |
| `created_at` | `timestamptz` | Yes |  |
| `completed_at` | `timestamptz` | No |  |
| `deleted_at` | `timestamptz` | No |  |

Constraints and indexes:

- Index on `(workspace_id, created_at desc)`.
- Index on `(workspace_id, export_type, status)`.
- Index on `(workspace_id, expires_at)`.

Sensitive fields:

- Export files can contain addresses, amounts, vendors, notes, document indexes, and OCR-derived information if included later.

Deletion policy:

- Exports should expire by default.
- Deleting a workspace queues export object deletion.

Migration notes:

- Current local PDF does not embed attached file contents. Preserve that expectation unless product intentionally adds document bundles.

### `subscriptions`

Purpose: Design-level subscription tracking. Keep MVP minimal and provider-agnostic until billing is implemented.

Key fields:

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `id` | `uuid` | Yes | Primary key. |
| `workspace_id` | `uuid` | Yes | Tenant scope. |
| `provider` | `text` | Yes | Example: `stripe`, `app_store`, `manual`. |
| `provider_customer_id` | `text` | No | Sensitive billing identifier. |
| `provider_subscription_id` | `text` | No | Sensitive billing identifier. |
| `plan_code` | `text` | Yes | Internal plan code. |
| `status` | `text` | Yes | `trialing`, `active`, `past_due`, `cancelled`, `expired`, `manual`. |
| `current_period_start` | `timestamptz` | No |  |
| `current_period_end` | `timestamptz` | No |  |
| `cancel_at` | `timestamptz` | No |  |
| `created_at` | `timestamptz` | Yes |  |
| `updated_at` | `timestamptz` | Yes |  |

Constraints and indexes:

- Index on `(workspace_id, status)`.
- Unique provider subscription id where not null.

Sensitive fields:

- Billing identifiers and plan status.

Deletion policy:

- Billing retention may be governed by provider and financial record requirements. Product/legal decision required.

Migration notes:

- Local app has no subscription model.

### `workspace_entitlements`

Purpose: Design-level feature limits derived from subscription or manual grants.

Key fields:

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `id` | `uuid` | Yes | Primary key. |
| `workspace_id` | `uuid` | Yes | Tenant scope. |
| `key` | `text` | Yes | Example: `max_properties`, `max_storage_bytes`, `ocr_enabled`, `ios_capture_enabled`. |
| `value` | `jsonb` | Yes | Typed by application. |
| `source` | `text` | Yes | `subscription`, `manual`, `trial`, `system_default`. |
| `expires_at` | `timestamptz` | No |  |
| `created_at` | `timestamptz` | Yes |  |
| `updated_at` | `timestamptz` | Yes |  |

Constraints and indexes:

- Unique active key per workspace: `(workspace_id, key) where expires_at is null`.
- Index on `(workspace_id, key)`.

Sensitive fields:

- Usage limits and plan features.

Migration notes:

- Local record count and file size limits should inform defaults, not silently impose cloud limits without product decision.

### `notifications`

Purpose: Design-level notification delivery records.

Key fields:

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `id` | `uuid` | Yes | Primary key. |
| `workspace_id` | `uuid` | Yes | Tenant scope. |
| `user_id` | `uuid` | Yes | Recipient. |
| `type` | `text` | Yes | `reminder_due`, `import_completed`, `export_ready`, `file_issue`, `subscription_notice`. |
| `channel` | `text` | Yes | `in_app`, `email`, `push`. |
| `status` | `text` | Yes | `queued`, `sent`, `failed`, `dismissed`. |
| `title` | `text` | Yes | Avoid sensitive details where possible. |
| `body` | `text` | No | Avoid sensitive details for email/push. |
| `metadata` | `jsonb` | Yes | Default `{}`. |
| `created_at` | `timestamptz` | Yes |  |
| `sent_at` | `timestamptz` | No |  |
| `read_at` | `timestamptz` | No |  |

Constraints and indexes:

- Index on `(workspace_id, user_id, created_at desc)`.
- Index on `(workspace_id, status)`.

Sensitive fields:

- Notification content can leak record names if not carefully designed.

Migration notes:

- Local app has no notification records.

### `reminders`

Purpose: Design-level user-created reminders for review tasks and document collection.

Key fields:

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `id` | `uuid` | Yes | Primary key. |
| `workspace_id` | `uuid` | Yes | Tenant scope. |
| `created_by_user_id` | `uuid` | No | References `users(id)`. |
| `assigned_user_id` | `uuid` | No | References `users(id)`. |
| `record_type` | `text` | No | Optional related record type. |
| `record_id` | `uuid` | No | Optional related record id. |
| `title` | `text` | Yes |  |
| `note` | `text` | No | Sensitive. |
| `due_at` | `timestamptz` | No |  |
| `status` | `text` | Yes | `open`, `completed`, `dismissed`. |
| `completed_at` | `timestamptz` | No |  |
| `created_at` | `timestamptz` | Yes |  |
| `updated_at` | `timestamptz` | Yes |  |
| `deleted_at` | `timestamptz` | No |  |

Constraints and indexes:

- Index on `(workspace_id, status, due_at)`.
- Index on `(workspace_id, record_type, record_id)`.

Sensitive fields:

- Reminder titles/notes can reveal home work, files, vendors, and costs.

Migration notes:

- Local app has generated follow-ups, not persisted reminders. Do not import open follow-ups as reminders by default.

### `audit_events`

Purpose: Records sensitive operational access and administrative/support actions.

Key fields:

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `id` | `uuid` | Yes | Primary key. |
| `workspace_id` | `uuid` | No | Null only for global account events. |
| `actor_user_id` | `uuid` | No | User/support/admin actor when applicable. |
| `actor_type` | `text` | Yes | `user`, `support`, `system`, `admin`. |
| `action` | `text` | Yes | `view_document`, `download_file`, `view_ocr`, `export_created`, `workspace_deleted`, `support_access_granted`, etc. |
| `record_type` | `text` | No |  |
| `record_id` | `uuid` | No |  |
| `ip_address` | `inet` | No | Sensitive. |
| `user_agent` | `text` | No | Sensitive. |
| `metadata` | `jsonb` | Yes | Default `{}`; avoid storing document text or raw files. |
| `occurred_at` | `timestamptz` | Yes |  |

Constraints and indexes:

- Index on `(workspace_id, occurred_at desc)`.
- Index on `(actor_user_id, occurred_at desc)`.
- Index on `(workspace_id, action, occurred_at desc)`.

Sensitive fields:

- Access history, IP addresses, user agents, record references.

Deletion policy:

- Retention requires product/legal decision. Keep enough for user trust and security investigations without over-retaining sensitive usage history.

Migration notes:

- Local app does not persist audit events.

## Indexing Strategy For Common Filters

Projects:

- `(workspace_id, property_id, deleted_at)`
- `(workspace_id, status, deleted_at)`
- `(workspace_id, category, deleted_at)`
- `(workspace_id, start_date)`
- `(workspace_id, completion_date)`

Expenses:

- `(workspace_id, property_id, deleted_at)`
- `(workspace_id, project_id, deleted_at)`
- `(workspace_id, vendor_id, deleted_at)`
- `(workspace_id, expense_date desc)`
- `(workspace_id, record_treatment, deleted_at)`
- `(workspace_id, category, deleted_at)`
- `(workspace_id, documentation_status, deleted_at)`

Documents:

- `(workspace_id, property_id, deleted_at)`
- `(workspace_id, project_id, deleted_at)`
- `(workspace_id, expense_id, deleted_at)`
- `(workspace_id, document_type, deleted_at)`
- `(workspace_id, file_availability, deleted_at)`
- `(workspace_id, document_date desc)`

Dashboard:

- `activity_events(workspace_id, occurred_at desc)`
- `activity_events(workspace_id, record_type, occurred_at desc)`
- follow-ups should be generated from indexed source records plus overrides, not queried from a permanent open-items table.

Imports/exports:

- `import_batches(workspace_id, created_at desc)`
- `exports(workspace_id, created_at desc)`

## Storage And OCR Notes

- Keep uploaded bytes outside PostgreSQL in private object storage.
- Keep only file metadata and server-side object keys in PostgreSQL.
- Generate signed download/preview URLs through the server after authorization.
- Log sensitive support/admin file access in `audit_events`.
- Keep OCR text in `document_ocr.text`; do not duplicate it into `documents`.
- OCR search is a later feature because it requires careful privacy and performance decisions.
- Import local OCR text as `legacy_import`, not as freshly processed text.
- Use file availability states to model missing, skipped, blocked, checksum-failed, and tutorial metadata cases.

## Import And Migration Notes

- Import must create an `import_batches` row first.
- Import must validate backup envelope and relationships before writing target records.
- Import must map each source record to SaaS ids through `import_records`.
- Import must preserve source ids in `legacy_source`.
- Import should not silently merge vendors across imports.
- Import should not import generated follow-up items as records.
- Import should import follow-up overrides and then recompute follow-ups.
- Import should create file rows only for valid, available, imported file payloads.
- Import should create `import_files` rows for every expected file outcome.
- Import should produce user-visible warnings for currency assumption, missing files, blocked files, checksum failures, duplicate imports, and ambiguous vendor/address mappings.

## Data Retention And Deletion Notes

- Workspace deletion must include records, document files, OCR text, exports, imports, activity, reminders, and notifications.
- Object storage deletion should be asynchronous but auditable.
- Account deletion must resolve workspace ownership first.
- Deleting documents should remove associated file bytes after retention.
- Exports should have expiration by default.
- Import raw snapshots should have a defined retention window.
- Activity/audit retention needs a separate product/legal decision before implementation.

## Resolved, Deferred, And Open Migration Ambiguities

Resolved by this design:

- Money uses integer cents plus currency code.
- Legacy ids are stored in import metadata, not used as primary keys.
- Free-form addresses remain display/raw text.
- Raw vendor names are preserved.
- Document metadata and file storage are separate.
- Raw object storage keys stay server-side.
- OCR state is separate from OCR text.
- `hasFile` ambiguity is represented through file availability and import file status.
- Follow-ups are recomputed after import.
- Follow-up override intent is preserved with source id plus type/context matching.

Deferred:

- Reviewer portals and external professional access.
- AI extraction/classification.
- Complex household sharing beyond owner/editor/viewer.
- Advanced billing event history.
- Full-text OCR search.
- Structured address validation.
- Automatic vendor merge suggestions.

Open product/engineering questions:

- Should project `completeness_override_note` continue suppressing child expense/document issues in SaaS?
- Should item-level follow-up overrides be invalidated when source records materially change?
- Should repeated backup imports be blocked, merged, or treated as separate import batches?
- What cloud attachment size limit should be used, and should it match the local 25 MB limit?
- Should backups with blank file checksums import normally or require user confirmation?
- What is the exact retention window for exports, import raw snapshots, activity, and audit events?
- How should subscription ownership interact with workspace ownership if the owner leaves?
- Should iOS uploads create draft documents, files first, or full document records immediately?

