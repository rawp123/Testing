# Home Ledger API Foundation

This package currently contains the SaaS API foundation: database migration tooling, a minimal Fastify runtime, provider-neutral dev/test auth resolution, workspace authorization helpers, session/workspace endpoints, and the initial Property, Vendor, Project, Expense, Document, and Document File APIs.

It does not define production object-storage integration, billing, OCR processing, import, export, invitation, household sharing, reviewer, or support/admin routes yet.

## API Runtime

Run from the repo root:

```sh
npm run dev:api
```

The runtime reads `DATABASE_URL` and does not run migrations automatically.

Public endpoint:

```text
GET /health
```

Authenticated endpoint:

```text
GET /api/v1/session
GET /api/v1/workspaces
POST /api/v1/workspaces
GET /api/v1/workspaces/:workspaceId
PATCH /api/v1/workspaces/:workspaceId
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
- `completeness_override_note` is stored as project metadata only in this ticket. It does not suppress generated follow-ups yet.
- List responses may include same-workspace `property_name` and `vendor_name`. They do not include property addresses, vendor contact details, notes, legacy metadata, or object-storage keys.
- `open_item_count` currently returns `null`; Ticket 11 owns follow-up generation and open-item counts.
- `POST /archive` is the canonical archive route.
- `DELETE` is a compatibility soft-archive alias because the current API contract lists a delete route; it does not hard-delete the row or cascade to expenses/documents/files.

Project list behavior:

- Supports `q`, `property_id`, `vendor_id`, `status`, `category`, `start_date_from`, `start_date_to`, `completion_date_from`, `completion_date_to`, `archived`, `include_archived`, `limit`, `offset`, and documented sort values.
- Search covers project name and scope summary.
- `GET /projects/filter-options` returns workspace-safe `properties`, `vendors`, `statuses`, and `categories` from the currently filtered project set. It excludes archived projects by default and applies the same supported filters as project list.

Deferred for projects:

- Follow-up generation and follow-up override resolution.
- Real `open_item_count`.
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
- `open_item_count` currently returns `null`; Ticket 11 owns follow-up generation and open-item counts.
- `DELETE` is a soft-delete route because the current expense table has `deleted_at` and no expense archive/status column. No hard delete is implemented.

Expense list behavior:

- Supports `q`, `property_id`, `project_id`, `vendor_id`, `category`, `record_treatment`, `documentation_status`, `currency_code`, `date_from`, `date_to`, `amount_min_cents`, `amount_max_cents`, `limit`, `offset`, and documented sort values.
- Search covers description, raw vendor name, and notes.
- `GET /expenses/filter-options` returns workspace-safe `properties`, `projects`, `vendors`, `categories`, `record_treatments`, `documentation_statuses`, and `currency_codes` from the currently filtered expense set. It excludes soft-deleted expenses and applies the same supported filters as expense list.

Deferred for expenses:

- File upload and derived document status.
- Follow-up generation and derived documentation status.
- Real `open_item_count`.
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
- `document_date` uses `YYYY-MM-DD`.
- `file_availability` defaults to `not_uploaded` and is constrained to the values in the database schema.
- `notes` and `file_status_note` are trimmed and length-limited.
- List responses may include same-workspace `property_name`, `project_name`, and `expense_description`.
- If file or OCR rows already exist, responses include a safe file summary and OCR status summary only. Raw storage keys, local filesystem paths, and OCR text are not exposed.
- `DELETE` soft-deletes the document metadata row via `deleted_at`. It does not hard-delete file rows or expose file access afterward because file endpoints require a non-deleted document.

Document list behavior:

- Supports `q`, `property_id`, `project_id`, `expense_id`, `document_type`, `file_availability`, `document_date_from`, `document_date_to`, `limit`, `offset`, and documented sort values.
- Search covers document display name, notes, and file status note.
- `GET /documents/filter-options` returns workspace-safe `properties`, `projects`, `expenses`, `document_types`, and `file_availabilities` from the currently filtered document set. It excludes soft-deleted documents and applies the same supported filters as document list.

## Document File API

Document file routes manage the safe file metadata lifecycle for existing documents. They use the `document_files` table and a small storage adapter boundary. In the current implementation the adapter returns local/test intent metadata only; it does not store binary content or create production signed object-storage URLs.

Role behavior:

- `owner` and `editor` can create upload intents, complete upload metadata, and detach files.
- `viewer` can request safe download metadata for available files only.
- Non-members receive `404 not_found`.

File lifecycle rules:

- `POST /file-intent` validates the existing document, file name, MIME type, size, hash, and source, then creates a `pending_upload` `document_files` row.
- `POST /file-complete` marks a pending file row `available`, sets `uploaded_at`, and updates the parent document `file_availability` to `available`.
- `GET /file` returns safe file metadata and adapter download availability for the active available file. It never returns raw storage keys, buckets, filesystem paths, OCR text, or file bytes.
- `DELETE /file` soft-deletes the active file row, leaves document metadata intact, and updates the parent document `file_availability` to `removed`.
- A document can have at most one active available file in the current schema. Completing a replacement marks any prior available file row deleted before activating the new file. Production object cleanup for replaced files is deferred until a real storage adapter/background cleanup path exists.
- Upload intent and download responses include adapter metadata. In local/test mode `upload_url` and `download_url` are `null`; production object storage must be wired through the adapter in a later ticket.

Validation:

- Maximum file size is `26214400` bytes (`25 MB`).
- Allowed MIME types are `application/pdf`, `image/jpeg`, `image/png`, `image/heic`, `image/heif`, and `text/plain`.
- Executable, script-like, archive, and unsafe MIME types are rejected.
- `original_file_name` is treated as display metadata only, path parts are stripped, and control characters are removed.
- `sha256`, when supplied, must be lowercase or uppercase hex and exactly 64 characters; it is normalized to lowercase.
- `source` is constrained to `web_upload` or `ios_upload` for direct API uploads.

Deferred for document files:

- Real object-storage signed upload/download URLs.
- Binary upload streaming through the API.
- Malware scanning and quarantine enforcement.
- Activity/audit event creation for download and delete actions.
- OCR queueing, OCR retry, and OCR text read APIs.
- Derived expense documentation status.
- Import mapping.
- UI.

Deferred for documents:

- OCR queueing, OCR retry, and OCR text read APIs.
- Derived expense documentation status.
- Activity event creation.
- Import mapping.
- UI.

## Commands

Run from the repo root:

```sh
npm run test:api
npm run check:api
npm run saas:db:migrate
npm run saas:db:rollback
npm run saas:db:check
npm run saas:db:reset:test
```

`saas:db:migrate` and `saas:db:rollback` require `DATABASE_URL`.

`saas:db:check` and `saas:db:reset:test` require `TEST_DATABASE_URL`. These commands refuse to use `DATABASE_URL` and require the database name to contain `test`.

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
