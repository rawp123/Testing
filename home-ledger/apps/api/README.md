# Home Ledger API Foundation

This package currently contains the SaaS API foundation: database migration tooling, a minimal Fastify runtime, provider-neutral dev/test auth resolution, workspace authorization helpers, session/workspace endpoints, the initial Property, Vendor, Project, Expense, Document, Document File, Document OCR, Dashboard Summary, Generated Follow-up, and Export APIs.

It does not define API-proxied binary upload/download streaming, billing, production OCR provider integration, import, background export jobs, export object-storage persistence, invitation, household sharing, reviewer, or support/admin routes yet.

## API Runtime

Run from the repo root:

```sh
npm run dev:api
```

The runtime reads `DATABASE_URL` and does not run migrations or local data seeding automatically.

Local SaaS review flow:

```sh
TEST_DATABASE_URL=postgres://home_ledger:home_ledger@localhost:5432/home_ledger_test npm run saas:db:reset:test
DATABASE_URL=postgres://home_ledger:home_ledger@localhost:5432/home_ledger_test npm run seed:api:dev
DATABASE_URL=postgres://home_ledger:home_ledger@localhost:5432/home_ledger_test npm run dev:api
```

In another terminal:

```sh
curl -s http://127.0.0.1:4000/api/v1/session | python3 -m json.tool
```

The session should show `dev@example.test` with at least one workspace membership. The dev seed is idempotent, local-only, and creates the configured dev user, a marked dev workspace, and an owner membership. It does not run in production or staging and does not create sample properties, projects, expenses, or documents.

Public endpoint:

```text
GET /health
GET /ready
```

`GET /health` is a liveness check. It only confirms the API process can respond.

`GET /ready` is a safe deployment readiness check. It verifies required runtime configuration and database connectivity, then reports provider connection states for file storage, OCR, auth, and billing without exposing `DATABASE_URL`, secrets, bucket names, signed URLs, storage keys, provider errors, OCR text, or local paths. The endpoint returns `503` when required checks fail or production object storage is missing in production mode.

Authenticated endpoint:

```text
GET /api/v1/session
GET /api/v1/workspaces
POST /api/v1/workspaces
GET /api/v1/workspaces/:workspaceId
PATCH /api/v1/workspaces/:workspaceId
GET /api/v1/workspaces/:workspaceId/dashboard
GET /api/v1/workspaces/:workspaceId/follow-ups
GET /api/v1/workspaces/:workspaceId/follow-ups/summary
POST /api/v1/workspaces/:workspaceId/follow-ups/:followUpId/resolve
POST /api/v1/workspaces/:workspaceId/follow-ups/:followUpId/reopen
GET /api/v1/workspaces/:workspaceId/exports/summary
GET /api/v1/workspaces/:workspaceId/exports/expenses.csv
GET /api/v1/workspaces/:workspaceId/exports/documents.csv
GET /api/v1/workspaces/:workspaceId/exports/full.json
GET /api/v1/workspaces/:workspaceId/properties
POST /api/v1/workspaces/:workspaceId/properties
GET /api/v1/workspaces/:workspaceId/properties/:propertyId
PATCH /api/v1/workspaces/:workspaceId/properties/:propertyId
POST /api/v1/workspaces/:workspaceId/properties/:propertyId/archive
DELETE /api/v1/workspaces/:workspaceId/properties/:propertyId
GET /api/v1/workspaces/:workspaceId/vendors
POST /api/v1/workspaces/:workspaceId/vendors
GET /api/v1/workspaces/:workspaceId/vendors/:vendorId
PATCH /api/v1/workspaces/:workspaceId/vendors/:vendorId
POST /api/v1/workspaces/:workspaceId/vendors/:vendorId/archive
DELETE /api/v1/workspaces/:workspaceId/vendors/:vendorId
GET /api/v1/workspaces/:workspaceId/projects
POST /api/v1/workspaces/:workspaceId/projects
GET /api/v1/workspaces/:workspaceId/projects/filter-options
GET /api/v1/workspaces/:workspaceId/projects/:projectId
PATCH /api/v1/workspaces/:workspaceId/projects/:projectId
POST /api/v1/workspaces/:workspaceId/projects/:projectId/archive
DELETE /api/v1/workspaces/:workspaceId/projects/:projectId
GET /api/v1/workspaces/:workspaceId/expenses
POST /api/v1/workspaces/:workspaceId/expenses
GET /api/v1/workspaces/:workspaceId/expenses/filter-options
GET /api/v1/workspaces/:workspaceId/expenses/:expenseId
PATCH /api/v1/workspaces/:workspaceId/expenses/:expenseId
DELETE /api/v1/workspaces/:workspaceId/expenses/:expenseId
GET /api/v1/workspaces/:workspaceId/documents
POST /api/v1/workspaces/:workspaceId/documents
GET /api/v1/workspaces/:workspaceId/documents/filter-options
GET /api/v1/workspaces/:workspaceId/documents/:documentId
POST /api/v1/workspaces/:workspaceId/documents/:documentId/file-intent
POST /api/v1/workspaces/:workspaceId/documents/:documentId/file-complete
GET /api/v1/workspaces/:workspaceId/documents/:documentId/file
DELETE /api/v1/workspaces/:workspaceId/documents/:documentId/file
POST /api/v1/workspaces/:workspaceId/documents/:documentId/ocr
GET /api/v1/workspaces/:workspaceId/documents/:documentId/ocr
GET /api/v1/workspaces/:workspaceId/documents/:documentId/text
PATCH /api/v1/workspaces/:workspaceId/documents/:documentId
DELETE /api/v1/workspaces/:workspaceId/documents/:documentId
```

Session responses include the authenticated user, provider name, dev-auth marker, and active workspace memberships read from the database. Entitlement details are deferred until billing/entitlement behavior is implemented.

Unauthenticated responses use the shared error envelope:

```json
{
  "error": {
    "code": "unauthenticated",
    "message": "Sign in required.",
    "requestId": "req_..."
  }
}
```

## Dev/Test Auth

`AUTH_PROVIDER=dev` and `DEV_AUTH_ENABLED=true` enable local dev auth. The API uses server-side configuration to load or create the dev user, then reads memberships from `workspace_memberships`.

Use `DATABASE_URL=... npm run seed:api:dev` from the repo root when the dev session has no workspace membership. The seed uses `DEV_AUTH_EMAIL`, `DEV_AUTH_DISPLAY_NAME`, and `DEV_WORKSPACE_NAME` when provided; otherwise it uses `dev@example.test`, `Local Developer`, and `Home Ledger Dev Workspace`.

Tests may use `x-home-ledger-test-auth-email` to select a test email only when `APP_ENV=test`. User ids, roles, workspace ids, memberships, entitlements, and object keys are never accepted from request headers.

The API refuses to start when `APP_ENV=production` and `DEV_AUTH_ENABLED=true`.

## Workspace Authorization

Workspace-specific routes authorize by loading the authenticated user's active `workspace_memberships` row from the database. Session membership data is display context only; route authorization always performs a fresh workspace membership check.

MVP roles:

- `owner`: can read, write, and manage workspace basics.
- `editor`: can read and later write records, but cannot manage workspace basics.
- `viewer`: read-only.

Error behavior:

- Missing auth returns `401 unauthenticated`.
- Invalid workspace id format returns `400 invalid_request`.
- No active membership, inactive membership, or deleted workspace returns `404 not_found`.
- Active member with insufficient role returns `403 forbidden`.

Client-provided user ids, roles, memberships, workspace ids, entitlements, and object keys are ignored for authorization.

Workspace archive/delete endpoints are deferred until retention and deletion policy is resolved.

## Dashboard Summary API

`GET /api/v1/workspaces/:workspaceId/dashboard` returns workspace-scoped aggregate data for the dashboard landing page.

Role behavior:

- `owner`, `editor`, and `viewer` can read dashboard summaries.
- Non-members receive `404 not_found`.

Dashboard rules:

- Every count is scoped to the requested workspace.
- Soft-deleted records are excluded.
- Archived properties and projects are included in top-level `count` and separated into `active_count` and `archived_count`.
- Vendor `count` follows default API semantics and counts active, non-archived vendors.
- Expense totals use integer cents only.
- Document file counts are derived from active available file rows, not client-supplied filenames or object keys.
- OCR text counts are derived from `document_ocr`, but raw OCR text is never returned by dashboard responses.
- Storage keys, bucket names, signed URLs, raw OCR text, property addresses, vendor contact details, legacy metadata, and internal audit fields are not returned.
- `recent_activity` is derived from safe core record metadata for active properties, projects, expenses, and documents until the dedicated activity event service is implemented.
- `follow_ups` is a compact aggregate summary generated by the same service used by the Follow-up API.

Response areas:

- `properties`: total, active, and archived counts.
- `projects`: total, active, archived, status groups, and aggregate open follow-up count.
- `expenses`: count, total amount, classification groups, and review-oriented totals.
- `documents`: count, file availability counts, OCR status counts, and document type groups.
- `vendors`: active vendor count.
- `recent_activity`: safe, compact record activity rows.
- `follow_ups`: safe aggregate follow-up buckets.

## Generated Follow-up API

Follow-up routes generate workspace-scoped review items from current property, project, expense, document, file, and OCR state. Generated items are not stored as permanent records. Only manual resolve/suppress actions are persisted in `follow_up_overrides`.

Routes:

- `GET /api/v1/workspaces/:workspaceId/follow-ups`
- `GET /api/v1/workspaces/:workspaceId/follow-ups?status=open|resolved|all`
- `GET /api/v1/workspaces/:workspaceId/follow-ups/summary`
- `POST /api/v1/workspaces/:workspaceId/follow-ups/:followUpId/resolve`
- `POST /api/v1/workspaces/:workspaceId/follow-ups/:followUpId/reopen`

Role behavior:

- `owner`, `editor`, and `viewer` can list follow-ups and read the summary.
- `owner` and `editor` can resolve and reopen follow-ups.
- `viewer` resolve/reopen requests receive `403 forbidden`.
- Non-members receive `404 not_found`.

Follow-up response fields:

- `id`: deterministic generated id in the form `fu_<32 hex chars>`.
- `target_type`: `property`, `project`, `expense`, or `document`.
- `target_id`, `property_id`, `project_id`, `expense_id`, `document_id`: safe UUID context where applicable.
- `severity`: `missing_file`, `needs_review`, `missing_info`, or `info`.
- `reason_code`: stable generated reason.
- `title`, `description`, `action_label`: direct review-oriented copy.
- `status`: `open` or `resolved`.
- `source`: currently `generated`.
- `created_from`: currently `current_records`.
- `resolved_at`, `created_at`, `updated_at`: override timestamps when resolved; otherwise `null`.

Implemented `reason_code` values:

- `property_missing_purchase_date`
- `property_missing_purchase_price`
- `project_missing_vendor`
- `project_missing_dates`
- `project_missing_scope`
- `project_missing_supporting_document`
- `project_missing_contract_or_estimate`
- `project_missing_permit_or_approval`
- `project_missing_before_after_photo`
- `expense_missing_vendor`
- `expense_review_later`
- `expense_missing_document_support`
- `expense_documented_without_support`
- `document_missing_file`
- `document_ocr_pending`

Compatibility notes:

- Native iOS source is not present in this repository. The downloadable/local app remains the compatibility reference for generated follow-up categories, ordering, project completeness override behavior, expense/document support checks, and project-centered counts.
- Project `completeness_override_note` suppresses generated project-level items for that project. Child expense and document items can still generate when their source records still need attention.
- Follow-up ids are deterministic hashes of workspace, reason code, source-record context, and a small qualifier when needed. They are stable across repeated reads while the same source issue exists, but they do not expose raw object keys, filenames, paths, OCR text, or local ids as public ids.
- Resolving a follow-up creates an active `follow_up_overrides` row. It suppresses the same logical generated item on later reads and does not mutate the source record.
- Reopening a follow-up invalidates the active override. If the source issue still exists, the generated item appears again with the same deterministic id.
- If a source issue is fixed naturally, the generated follow-up disappears and no longer contributes to open counts.
- If the same source issue reappears after being resolved, the same deterministic id remains suppressed until reopened.
- `open_item_count` on project, expense, and document metadata responses is computed from open generated follow-ups. Counts are workspace-scoped, exclude resolved overrides, and exclude deleted records.
- Dashboard `follow_ups` buckets and `projects.open_follow_up_count` come from this generated follow-up service so dashboard and follow-up list behavior stay aligned.

Follow-up safety exclusions:

- Raw OCR text.
- Raw object-storage keys.
- Buckets, object paths, signed URLs, provider internals, access keys, and local filesystem paths.
- File bytes.
- Soft-deleted records.
- Tax, legal, accounting, or compliance conclusions.

## Export API

Export routes generate synchronous workspace-scoped exports for homeowner records. They do not create `exports` table rows, store generated files in object storage, or run background jobs in this ticket.

Routes:

- `GET /api/v1/workspaces/:workspaceId/exports/summary`
- `GET /api/v1/workspaces/:workspaceId/exports/expenses.csv`
- `GET /api/v1/workspaces/:workspaceId/exports/documents.csv`
- `GET /api/v1/workspaces/:workspaceId/exports/full.json`

Role behavior:

- `owner`, `editor`, and `viewer` can export workspace data.
- Non-members receive `404 not_found`.

Export rules:

- Every export is scoped to the requested workspace.
- Soft-deleted records are excluded.
- Archived properties, projects, and vendors are included in full JSON for record continuity. Summary vendor count follows default active-vendor semantics.
- Expenses use integer cents for totals and include a deterministic decimal `Amount` string only to preserve existing local app CSV compatibility.
- CSV responses use `Content-Type: text/csv; charset=utf-8` and attachment filenames like `home-ledger-expenses-YYYY-MM-DD.csv`.
- Full JSON uses `Content-Type: application/json; charset=utf-8` and an attachment filename like `home-ledger-full-YYYY-MM-DD.json`.
- CSV cells neutralize spreadsheet formulas and escape commas, quotes, CRLF, and newlines.
- Exports organize records for professional review. They do not label anything as deductible, allowed, disallowed, taxable, or basis-qualified.

Compatibility with the existing local app:

- The downloadable/local app's existing expense CSV is produced by `backend/domain/model.js` `buildExpensesCsv`.
- The SaaS `expenses.csv` preserves that established header order for the first local-compatible columns: `Export Source`, `Export Date`, `Property`, `Project`, `Vendor ID`, `Category`, `Date`, `Vendor/Payee`, `Description`, `Amount`, `Cost type`, `Receipt/file status`, and `Notes`.
- SaaS exports add safe reconciliation fields such as `Amount cents`, record ids, document count, and timestamps. This keeps the hosted API useful for web/iOS clients while minimizing adapter work for existing CSV consumers.
- The local app does not currently have a separate documents CSV. SaaS `documents.csv` uses stable snake_case headers for web/iOS clients.
- `full.json` includes `document_date` for document records. The current `documents.csv` header contract does not include `document_date`; its date columns are system metadata timestamps `created_at` and `updated_at`.

Export safety exclusions:

- Raw OCR text.
- Raw object-storage keys.
- Buckets, object paths, signed URLs, provider internals, access keys, and local filesystem paths.
- File bytes.
- Soft-deleted records.
- Legacy/source metadata and internal audit fields.

Export response areas:

- Summary JSON: `workspace_id`, `generated_at`, record counts, integer-cent totals, and OCR text availability count.
- Expenses CSV: local-compatible expense columns plus safe SaaS reconciliation metadata.
- Documents CSV: document metadata, file availability, MIME type, size, OCR status, and text availability.
- Full JSON: safe structured arrays for properties, projects, vendors, expenses, documents, file metadata, and OCR status metadata.

## API Field Casing

Public API v1 request and response payloads use `snake_case` for resource fields. Route handlers may map those fields to camelCase internally, but serialized resource data should stay consistent for future web, iOS, and import clients.

Examples:

- `display_address`
- `purchase_date`
- `purchase_price_cents`
- `currency_code`
- `is_primary`
- `created_at`
- `updated_at`
- `archived_at`

Error envelopes keep their existing shape, including `requestId`, because they are shared API infrastructure rather than resource fields.

## Property API

Property routes are the first workspace-scoped business record API.

Role behavior:

- `owner` and `editor` can list, read, create, update, and archive properties.
- `viewer` can list and read properties only.
- Non-members receive `404 not_found`.

Property rules:

- Every property query is scoped by `workspace_id`.
- Archived properties are hidden from default lists.
- `purchase_price_cents` must be a nonnegative integer.
- `currency_code` defaults to `USD`.
- Free-form addresses are stored as `display_address`; no address parsing, geocoding, valuation, tax, legal, or accounting logic is implemented.
- Only one active primary property is allowed per workspace.
- Creating the first active property in a workspace makes it primary by default.
- Creating or updating a property with `is_primary: true` clears primary status from other active properties in that workspace.
- Archiving a primary property clears its primary status and does not promote another property.
- `POST /archive` is the canonical archive route.
- `DELETE` is a compatibility soft-archive alias because the current API contract lists a delete route; it does not hard-delete the row.

Deferred for properties:

- Hard delete.
- Cascading archive/delete to projects, expenses, documents, files, OCR, exports, or activity.
- Import behavior.
- Activity event creation.
- UI.

## Vendor API

Vendor routes follow the same workspace-scoped business record pattern as properties.

Role behavior:

- `owner` and `editor` can list, read, create, update, and archive vendors.
- `viewer` can list and read vendors only.
- Non-members receive `404 not_found`.

Vendor rules:

- Every vendor query is scoped by `workspace_id`.
- Archived vendors are hidden from default lists.
- `name` is required and trimmed.
- `category`, `contact_name`, `phone`, `email`, `website`, and `notes` are trimmed when present.
- `email` is lowercased and basic-format validated for direct API entry.
- `website` must be an `http` or `https` URL for direct API entry.
- `status` is constrained to `active` or `archived`; `POST /archive` is the canonical archive route.
- `normalized_name` is generated from the display name for search/de-dupe support only.
- `normalized_name` is not unique, and duplicate or similar vendor names are allowed.
- `source_confidence` is set to `user_confirmed` for direct API-created vendors.
- No vendor category inference, contact normalization, enrichment, analytics, merge suggestions, or duplicate-resolution behavior is implemented.
- `DELETE` is a compatibility soft-archive alias because the current API contract lists a delete route; it does not hard-delete the row.

Deferred for vendors:

- Automatic merge and duplicate resolution.
- External enrichment or contact normalization.
- Vendor analytics.
- Import mapping.
- Project and expense linking behavior.
- Activity event creation.
- UI.

## Project API

Project routes follow the same workspace-scoped business record pattern as properties and vendors, with relationship validation for linked properties and vendors.

Role behavior:

- `owner` and `editor` can list, read, create, update, and archive projects.
- `viewer` can list, read, and read filter options only.
- Non-members receive `404 not_found`.

Project rules:

- Every project query is scoped by `workspace_id`.
- Archived projects are hidden from default lists.
- `property_id` is required for create and must reference an active, non-archived property in the same workspace.
- `vendor_id` is optional. When present, it must reference an active, non-archived vendor in the same workspace.
- Cross-workspace, missing, or archived relationship targets return `400 invalid_request` with field details and do not reveal whether a record exists elsewhere.
- `name` and `category` are required and trimmed.
- `status` is constrained to `planned`, `in_progress`, `blocked`, `completed`, or `archived`.
- Date fields use `YYYY-MM-DD`; `completion_date` cannot be before `start_date` when both are supplied in the same request.
- `contractor_name_raw`, `permit_number`, `scope_summary`, `notes`, and `completeness_override_note` are trimmed and length-limited.
- `completeness_override_note` suppresses project-level generated follow-ups for that project. Linked expense and document follow-ups may still generate from their own source records.
- List responses may include same-workspace `property_name` and `vendor_name`. They do not include property addresses, vendor contact details, notes, legacy metadata, or object-storage keys.
- `open_item_count` is computed from open generated follow-ups with matching `project_id`.
- `POST /archive` is the canonical archive route.
- `DELETE` is a compatibility soft-archive alias because the current API contract lists a delete route; it does not hard-delete the row or cascade to expenses/documents/files.

Project list behavior:

- Supports `q`, `property_id`, `vendor_id`, `status`, `category`, `start_date_from`, `start_date_to`, `completion_date_from`, `completion_date_to`, `archived`, `include_archived`, `limit`, `offset`, and documented sort values.
- Search covers project name and scope summary.
- `GET /projects/filter-options` returns workspace-safe `properties`, `vendors`, `statuses`, and `categories` from the currently filtered project set. It excludes archived projects by default and applies the same supported filters as project list.

Deferred for projects:

- Expense/document counts and linked record summaries.
- Activity event creation.
- Budgets and templates.
- Collaboration, comments, assignments, reminders, and notifications.
- Import mapping.
- UI.

## Expense API

Expense routes follow the same workspace-scoped business record pattern as properties, vendors, and projects, with relationship validation for linked properties, projects, and vendors.

Role behavior:

- `owner` and `editor` can list, read, create, update, and soft-delete expenses.
- `viewer` can list, read, and read filter options only.
- Non-members receive `404 not_found`.

Expense rules:

- Every expense query is scoped by `workspace_id`.
- Soft-deleted expenses are hidden from default lists.
- `property_id` is required for create and must reference an active, non-archived property in the same workspace.
- `project_id` is optional. When present, it must reference an active, non-archived project in the same workspace and that project must belong to the expense property.
- `vendor_id` is optional. When present, it must reference an active, non-archived vendor in the same workspace.
- Cross-workspace, missing, archived, or property-mismatched relationship targets return `400 invalid_request` with field details and do not reveal whether a record exists elsewhere.
- `description`, `amount_cents`, and `category` are required.
- `amount_cents` must be a nonnegative integer. The API does not accept floating-point money values.
- `currency_code` defaults to `USD` and must be three uppercase letters when provided.
- `expense_date` uses `YYYY-MM-DD`.
- `record_treatment` is constrained to `possible_improvement`, `repair_upkeep`, or `review_later`. These values organize records for professional review and do not represent tax, legal, or accounting conclusions.
- `documentation_status` is constrained to `receipt_attached`, `invoice_attached`, `no_document_yet`, or `needs_follow_up`.
- `vendor_name_raw` and `notes` are trimmed and length-limited.
- List responses may include same-workspace `property_name`, `project_name`, and `vendor_name`. They do not include property addresses, vendor contact details, legacy metadata, or object-storage keys.
- `document_count` counts linked, non-deleted document metadata rows.
- `open_item_count` is computed from open generated follow-ups with matching `expense_id`.
- `DELETE` is a soft-delete route because the current expense table has `deleted_at` and no expense archive/status column. No hard delete is implemented.

Expense list behavior:

- Supports `q`, `property_id`, `project_id`, `vendor_id`, `category`, `record_treatment`, `documentation_status`, `currency_code`, `date_from`, `date_to`, `amount_min_cents`, `amount_max_cents`, `limit`, `offset`, and documented sort values.
- Search covers description, raw vendor name, and notes.
- `GET /expenses/filter-options` returns workspace-safe `properties`, `projects`, `vendors`, `categories`, `record_treatments`, `documentation_statuses`, and `currency_codes` from the currently filtered expense set. It excludes soft-deleted expenses and applies the same supported filters as expense list.

Deferred for expenses:

- File upload and derived document status.
- Derived documentation status.
- Activity event creation.
- Import mapping.
- CSV/export integration.
- UI.

## Document API

Document routes follow the same workspace-scoped business record pattern as expenses, with relationship validation for linked properties, projects, and expenses.

Role behavior:

- `owner` and `editor` can list, read, create, update, and soft-delete document metadata.
- `viewer` can list, read, and read filter options only.
- Non-members receive `404 not_found`.

Document rules:

- Every document query is scoped by `workspace_id`.
- Soft-deleted documents are hidden from default lists.
- A document can exist before binary file upload.
- Document metadata routes do not store object bytes, expose object-storage keys, run OCR, or manage OCR text.
- `property_id` is required unless `expense_id` is supplied; when `expense_id` is supplied, the document property and project are derived from that expense.
- `project_id` is optional. When present, it must reference an active, non-archived project in the same workspace and that project must belong to the document property.
- `expense_id` is optional. When present, it must reference a non-deleted expense in the same workspace. Explicit property/project values must match the linked expense.
- Cross-workspace, missing, archived, deleted, or context-mismatched relationship targets return `400 invalid_request` with field details and do not reveal whether a record exists elsewhere.
- `display_name` is required and trimmed.
- `document_type` defaults to `other` and is stored as text for migration compatibility.
- `document_date` uses `YYYY-MM-DD` and means the user-supplied date associated with the document, receipt, invoice, permit, photo, or record when known. It is not the system creation timestamp and is not the file upload timestamp.
- `created_at` and `updated_at` are system timestamps for the document metadata row.
- `file_availability` defaults to `not_uploaded` and is constrained to the values in the database schema.
- `notes` and `file_status_note` are trimmed and length-limited.
- List responses may include same-workspace `property_name`, `project_name`, and `expense_description`.
- If file or OCR rows already exist, responses include a safe file summary and OCR status summary only. Raw storage keys, local filesystem paths, and OCR text are not exposed.
- Document metadata responses include `open_item_count` as an integer for unresolved generated follow-ups targeting that document, such as missing file or pending OCR items.
- `DELETE` soft-deletes the document metadata row via `deleted_at`. It does not hard-delete file rows or expose file access afterward because file endpoints require a non-deleted document.

Document list behavior:

- Supports `q`, `property_id`, `project_id`, `expense_id`, `document_type`, `file_availability`, `document_date_from`, `document_date_to`, `limit`, `offset`, and documented sort values.
- Search covers document display name, notes, and file status note.
- `GET /documents/filter-options` returns workspace-safe `properties`, `projects`, `expenses`, `document_types`, and `file_availabilities` from the currently filtered document set. It excludes soft-deleted documents and applies the same supported filters as document list.

## Document File API

Document file routes manage the safe file metadata lifecycle for existing documents. They use the `document_files` table and a storage adapter boundary. The local/test adapter does not require network access and returns `null` upload/download URLs. The S3-compatible adapter generates short-lived signed URLs for private buckets.

Role behavior:

- `owner` and `editor` can create upload intents, complete upload metadata, and detach files.
- `viewer` can request safe download metadata for available files only.
- Non-members receive `404 not_found`.

File lifecycle rules:

- `POST /file-intent` validates the existing document, file name, MIME type, size, hash, and source, then creates a `pending_upload` `document_files` row.
- `POST /file-complete` marks a pending file row `available`, sets `uploaded_at`, and updates the parent document `file_availability` to `available`.
- `uploaded_at` is file lifecycle metadata. It does not change or replace the parent document `document_date`.
- `GET /file` returns safe file metadata and adapter download availability for the active available file. It never returns raw storage keys, filesystem paths, OCR text, or file bytes as standalone metadata fields.
- `DELETE /file` soft-deletes the active file row, leaves document metadata intact, and updates the parent document `file_availability` to `removed`.
- A document can have at most one active available file in the current schema. Completing a replacement marks any prior available file row deleted before activating the new file. Production object cleanup for replaced files is deferred until provider-specific cleanup/background jobs are implemented.
- Upload intent and download responses include adapter metadata. In local/test mode `upload_url` and `download_url` are `null`. In S3 mode, `upload_url` and `download_url` are short-lived signed URLs created only for authorized requests.
- Storage keys are generated server-side and do not use the client filename. Normal document metadata responses continue to expose safe file summaries only.

Storage configuration:

```sh
FILE_STORAGE_DRIVER=local

# S3-compatible production storage:
FILE_STORAGE_DRIVER=s3
FILE_STORAGE_BUCKET=home-ledger-documents
FILE_STORAGE_REGION=us-east-1
FILE_STORAGE_ENDPOINT=
FILE_STORAGE_ACCESS_KEY_ID=
FILE_STORAGE_SECRET_ACCESS_KEY=
FILE_STORAGE_FORCE_PATH_STYLE=false
FILE_STORAGE_UPLOAD_URL_TTL_SECONDS=600
FILE_STORAGE_DOWNLOAD_URL_TTL_SECONDS=300
```

S3-compatible storage notes:

- `FILE_STORAGE_BUCKET`, `FILE_STORAGE_REGION`, `FILE_STORAGE_ACCESS_KEY_ID`, and `FILE_STORAGE_SECRET_ACCESS_KEY` are required when `FILE_STORAGE_DRIVER=s3`.
- `FILE_STORAGE_ENDPOINT` is optional for S3-compatible providers such as Cloudflare R2, Backblaze B2 S3 API, or MinIO.
- `FILE_STORAGE_FORCE_PATH_STYLE=true` is commonly needed for MinIO and some S3-compatible endpoints.
- Signed URL TTLs must be between `1` and `3600` seconds.
- Buckets should remain private. The API should be the only component that creates signed upload/download URLs.
- `FILE_STORAGE_DRIVER=local` and `FILE_STORAGE_DRIVER=test` are local/test metadata-only modes. They preserve document file lifecycle metadata and return `null` upload/download URLs, but they are not production-ready object storage.
- `/ready` and `npm run saas:deploy:check` report local/test storage as `local_only` outside production and `not_ready` when `APP_ENV=production`.

Validation:

- Maximum file size is `26214400` bytes (`25 MB`).
- Allowed MIME types are `application/pdf`, `image/jpeg`, `image/png`, `image/heic`, `image/heif`, and `text/plain`.
- Executable, script-like, archive, and unsafe MIME types are rejected.
- `original_file_name` is treated as display metadata only, path parts are stripped, and control characters are removed.
- `sha256`, when supplied, must be lowercase or uppercase hex and exactly 64 characters; it is normalized to lowercase.
- `source` is constrained to `web_upload` or `ios_upload` for direct API uploads.

Deferred for document files:

- Binary upload streaming through the API.
- Malware scanning and quarantine enforcement.
- Activity/audit event creation for download and delete actions.
- Provider-specific immediate object deletion for removed/replaced files.
- Derived expense documentation status.
- Import mapping.
- UI.

## Document OCR API

Document OCR routes manage extracted text status and safe explicit text reads. OCR text is sensitive user data and is stored separately in `document_ocr`.

Role behavior:

- `owner` and `editor` can request OCR.
- `viewer` can read OCR status and extracted text for accessible documents.
- Non-members receive `404 not_found`.

OCR lifecycle rules:

- `POST /ocr` requests OCR for the current available document file.
- `GET /ocr` returns status metadata only.
- `GET /text` returns extracted text only when OCR succeeded for the current available file.
- OCR cannot start for deleted documents or documents without an available file.
- Normal document list/detail responses never include raw OCR text. They only include status and `has_text`.
- Replacing or removing a document file resets or skips OCR and makes prior extracted text unavailable.
- Provider raw errors, stack traces, storage keys, signed URLs, and object-storage internals are not returned from OCR endpoints.

OCR response fields:

- `document_id`
- `document_file_id`
- `ocr_status`
- `ocr_requested_at`
- `ocr_completed_at`
- `text_available`
- `engine`
- `failure_reason`

OCR configuration:

```sh
OCR_MODE=disabled
OCR_MODE=fake
OCR_MODE=test
```

`disabled` records queued lifecycle status without extracting text. `fake` and `test` return deterministic extracted text for tests and local API checks. No external OCR service is called by the current implementation.

Production OCR readiness:

- `OCR_MODE=disabled` is an explicit safe state when production OCR is not connected.
- `OCR_MODE=fake` and `OCR_MODE=test` are local/test-only modes. `/ready` and `npm run saas:deploy:check` report them as `local_only` outside production and `not_ready` when `APP_ENV=production`.
- There is no production OCR provider mode yet. Do not configure fake/test OCR for production deployments.
- Readiness responses never expose raw OCR text, provider request ids, API keys, provider stack traces, storage keys, signed URLs, or local paths.

Deferred for OCR:

- Real production OCR provider integration.
- Async worker queue and retry backoff.
- OCR search.
- OCR read audit events.
- OCR inclusion/exclusion decisions for exports.

Deferred for documents:

- Derived expense documentation status.
- Activity event creation.
- Import mapping.
- UI.

## Local App Compatibility Boundary

`src/compatibility.js` centralizes the safe translation boundary between the current downloadable/local Home Basis Tracker data shape and the SaaS API contract. It is intended for future import, web-client adapter, and iOS companion work. It is not a full import pipeline and does not change public route behavior by itself.

Local app values inspected:

- Local records use camelCase fields, local string ids, decimal-dollar amounts, and document fields such as `hasFile`, `fileId`, `fileName`, `fileSize`, `mimeType`, and `ocrText`.
- Local expense classifications include `potential basis addition`, `repair or maintenance`, and `unclear / ask CPA`.
- Local expense documentation statuses include `receipt attached`, `invoice attached`, `no document yet`, and `needs follow-up`.
- Local project statuses include `planned`, `in progress`, `blocked`, `completed`, and `archived`.
- Local document types include `receipt`, `invoice`, `permit`, `warranty`, `photo`, `contract`, `payment record`, `appraisal`, `inspection`, `plan or drawing`, and `other`.
- Local review packet tables use compact human headers such as `Cost Type`, `Receipt/File`, and `Stored File`.

Canonical SaaS decisions:

- Public API fields stay `snake_case`.
- SaaS ids stay UUIDs. Local ids must be preserved only through import metadata or mapping tables, not reused as SaaS primary keys.
- Money uses integer cents. `localDollarsToCents()` parses local dollar numbers/strings deterministically and rejects invalid or ambiguous precision.
- Expense classifications map to `possible_improvement`, `repair_upkeep`, and `review_later`.
- Documentation statuses map to `receipt_attached`, `invoice_attached`, `no_document_yet`, and `needs_follow_up`.
- Local `in progress` maps to SaaS `in_progress`.
- Unknown legacy classifications map to `review_later`; unknown legacy documentation states map to `needs_follow_up`; unknown project statuses map to `planned`; unknown local categories and document types map to `other`.
- SaaS separates document metadata, file lifecycle, and OCR text/status. Local `hasFile`/`fileName` maps to file availability and file metadata. Local `ocrText` is sensitive and must not appear in normal document/list/dashboard/export/follow-up responses.
- Local `addedDate` maps to SaaS `document_date` as a compatibility fallback because the current local form labels it "Document date." The local field name is ambiguous, so import/client adapters should treat it as a user-supplied document-associated date, not as file upload time or metadata creation time. Invalid or non-ISO local dates should not be imported as `document_date`.
- Local file ids are never object storage keys. Path-like local filenames are reduced to safe filenames before use as file metadata.
- Generated follow-up `reason_code`, severity, and status values are locked by compatibility tests so future clients do not invent parallel enums.
- SaaS export headers are intentionally not identical to local review packet table headers. SaaS CSV exports keep machine-friendly ids, integer-cent fields, and safe metadata while preserving spreadsheet formula neutralization.

Do not copy these local-only assumptions into SaaS:

- local filesystem paths
- browser or desktop document-storage claims
- local ids as SaaS ids
- camelCase public API fields
- floating-point money behavior
- inline OCR text in ordinary metadata
- local backup/restore behavior as cloud import behavior
- old local labels as canonical SaaS values when they conflict with neutral review-oriented terminology

## Commands

Run from the repo root:

```sh
npm run test:api
npm run check:api
npm run saas:deploy:check
npm run saas:db:migrate
npm run saas:db:rollback
npm run saas:db:check
npm run saas:db:reset:test
```

`saas:db:migrate` and `saas:db:rollback` require `DATABASE_URL`.

`saas:db:check` and `saas:db:reset:test` require `TEST_DATABASE_URL`. These commands refuse to use `DATABASE_URL` and require the database name to contain `test`.

`saas:deploy:check` requires `DATABASE_URL` and runs the same readiness logic used by `GET /ready`. It checks database connectivity and safe provider readiness. It does not run migrations, seed data, call external OCR services, create billing customers, or validate a real production auth provider beyond configured/not-connected status. Set `APP_ENV=production` to enforce production object-storage readiness.

## Local PostgreSQL Setup

The API expects a local PostgreSQL server for real schema checks and DB-backed tests. The default local URLs are listed in `apps/api/.env.example`:

```sh
DATABASE_URL=postgres://home_ledger:home_ledger@localhost:5432/home_ledger_dev
TEST_DATABASE_URL=postgres://home_ledger:home_ledger@localhost:5432/home_ledger_test
```

Use one of these macOS setup paths. Homebrew is the preferred local path; Postgres.app is a good GUI alternative. Docker is optional and only needed if you already use it locally.

### Option 1: Homebrew PostgreSQL

Install and start PostgreSQL:

```sh
brew install postgresql@16
brew services start postgresql@16
```

Make sure the PostgreSQL binaries are on your path. Homebrew prints the exact command after install. On Apple Silicon, it is commonly:

```sh
echo 'export PATH="/opt/homebrew/opt/postgresql@16/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc
```

Create the local role and databases:

```sh
createuser -s home_ledger
psql postgres -c "ALTER USER home_ledger WITH PASSWORD 'home_ledger';"
createdb -O home_ledger home_ledger_dev
createdb -O home_ledger home_ledger_test
```

If the role or databases already exist, those commands may report that they exist. That is fine as long as the role can connect.

Reset and migrate the test database:

```sh
TEST_DATABASE_URL=postgres://home_ledger:home_ledger@localhost:5432/home_ledger_test npm run saas:db:reset:test
```

Run the real DB-backed checks:

```sh
TEST_DATABASE_URL=postgres://home_ledger:home_ledger@localhost:5432/home_ledger_test npm run test:api
TEST_DATABASE_URL=postgres://home_ledger:home_ledger@localhost:5432/home_ledger_test npm run saas:db:check
```

### Option 2: Postgres.app

Install Postgres.app from `https://postgresapp.com/`, open it, and start the default server on port `5432`.

Add the bundled tools to your shell path. For the current Postgres.app layout, this is commonly:

```sh
sudo mkdir -p /etc/paths.d
echo /Applications/Postgres.app/Contents/Versions/latest/bin | sudo tee /etc/paths.d/postgresapp
```

Open a new terminal, then create the role and databases:

```sh
createuser -s home_ledger
psql postgres -c "ALTER USER home_ledger WITH PASSWORD 'home_ledger';"
createdb -O home_ledger home_ledger_dev
createdb -O home_ledger home_ledger_test
```

Then run the same reset and check commands from the Homebrew section.

### Option 3: Docker Fallback

Use Docker only if it is already part of your local workflow:

```sh
docker run --name home-ledger-postgres \
  -e POSTGRES_USER=home_ledger \
  -e POSTGRES_PASSWORD=home_ledger \
  -e POSTGRES_DB=home_ledger_test \
  -p 5432:5432 \
  -d postgres:16
```

Create the development database inside the container:

```sh
docker exec home-ledger-postgres createdb -U home_ledger home_ledger_dev
```

Then run the same reset and check commands from the Homebrew section.

### Troubleshooting

If checks fail with `ECONNREFUSED`, PostgreSQL is not running or is not listening on `localhost:5432`.

Check connectivity:

```sh
psql postgres://home_ledger:home_ledger@localhost:5432/home_ledger_test -c "select 1;"
```

Do not run DB-backed tests against `DATABASE_URL`. The test helpers intentionally require `TEST_DATABASE_URL`.

DB-backed authorization and business-record smoke tests require `TEST_DATABASE_URL`:

```sh
TEST_DATABASE_URL=postgres://home_ledger:home_ledger@localhost:5432/home_ledger_test npm run test:api
```

Without `TEST_DATABASE_URL`, DB-backed authorization/property/vendor/project tests skip with an explicit message. Unit and route authorization tests still run with injected fake databases.

## Scope

The initial migration creates the MVP SaaS tables from `docs/implementation-readiness.md` and `docs/saas-schema.md`, including `audit_events` because it is documented as a distinct SaaS operations table.

Import tables are intentionally deferred. The MVP docs keep import confirmation behind the core product workflow unless beta migration requires it.
