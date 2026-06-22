# SaaS API Contract Design

This document proposes a REST-style API contract for the web-first Home Ledger SaaS product with iOS as a capture/review companion. It is a design document only. It does not create routes, migrations, dependencies, frontend screens, or backend behavior.

## Source Context

Primary sources:

- `docs/current-app-model.md`
- `docs/backup-format.md`
- `docs/follow-up-rules.md`
- `docs/migration-risks.md`
- `docs/saas-schema.md`
- `docs/legacy-to-saas-mapping.md`

The contract maps to the schema design in `docs/saas-schema.md` and preserves source behavior documented in the local app model. The product organizes records for professional review and does not make tax, legal, accounting, or compliance conclusions.

## Non-goals

- No auth provider is chosen here.
- No API routes are implemented here.
- No database migrations are created here.
- No billing provider integration is chosen here.
- No AI extraction, reviewer portal, or complex household sharing is included in MVP.

## API Conventions

Base path:

```text
/api/v1
```

Data conventions:

- Resource ids in URLs are SaaS UUIDs.
- Legacy ids appear only in import metadata or mapping responses.
- Money uses integer cents: `amount_cents`, `purchase_price_cents`.
- Currency uses ISO-like three-character codes, defaulting to `USD` for imported local backups with warning.
- Date-only fields use `YYYY-MM-DD`.
- Timestamps use ISO 8601 `timestamptz`.
- Every workspace-scoped response must be filtered by authenticated workspace authorization, not only by client-supplied filters.
- Raw object storage keys are never returned to clients.
- Generated follow-ups are read-derived. Only follow-up overrides are persisted.

Recommended response envelope for single resources:

```json
{
  "data": {
    "id": "uuid",
    "type": "project",
    "attributes": {},
    "relationships": {},
    "meta": {}
  }
}
```

Recommended response envelope for lists:

```json
{
  "data": [],
  "meta": {
    "limit": 50,
    "next_cursor": "opaque-cursor-or-null",
    "total_count": 125,
    "filter_options_url": "/api/v1/workspaces/{workspaceId}/projects/filter-options"
  }
}
```

Plain object responses are acceptable for MVP if consistent, but every list should include pagination metadata.

## Auth And Session Assumptions

The API assumes an upstream authentication layer verifies the request and provides authenticated user identity to the API. This document does not choose the provider.

Assumed request context:

```json
{
  "auth": {
    "user_id": "uuid",
    "session_id": "opaque-session-id",
    "auth_provider": "provider-name",
    "auth_subject": "provider-user-id",
    "issued_at": "2026-06-06T12:00:00Z"
  }
}
```

The API resolves workspace authorization from `workspace_memberships`, not from client claims.

Session endpoints:

| Method and path | Purpose | Role |
| --- | --- | --- |
| `GET /session` | Return authenticated user, current workspace preference, memberships, and entitlement summary. | Authenticated user |
| `PATCH /session/preferences` | Update non-security preferences such as current workspace id, theme, density. | Authenticated user |
| `POST /session/logout` | Optional server-side logout hook if auth provider supports it. | Authenticated user |

Request shape:

```json
{
  "current_workspace_id": "uuid-or-null",
  "theme": "system",
  "density": "comfortable"
}
```

Response shape:

```json
{
  "data": {
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "display_name": "Homeowner"
    },
    "current_workspace_id": "uuid",
    "workspaces": [
      {
        "id": "uuid",
        "name": "Home records",
        "role": "owner",
        "status": "active"
      }
    ],
    "entitlements": {
      "plan_code": "starter",
      "storage_used_bytes": 123456,
      "storage_limit_bytes": 1073741824
    }
  }
}
```

Validation and errors:

- `401 unauthenticated` if no valid authenticated user reaches the API.
- `403 forbidden` if a requested current workspace is not available to the user.
- `422 validation_failed` for invalid preference values.

Sensitive-data considerations:

- Do not return support/admin access state beyond what the user should see.
- Do not include object storage details.

Web use cases:

- Initial app boot and workspace switcher.
- Settings panel.

iOS use cases:

- Boot capture companion into the last workspace.
- Verify the account has permission to upload documents.

Unresolved decisions:

- Auth provider, refresh-token behavior, session duration, and device trust model.
- Whether `admin` ships in MVP or remains a reserved role while owner/editor/viewer ship first.

## Error Envelope

All error responses should use one shape:

```json
{
  "error": {
    "code": "validation_failed",
    "message": "Fix the highlighted fields.",
    "request_id": "req_123",
    "details": [
      {
        "field": "amount_cents",
        "issue": "must_be_nonnegative"
      }
    ]
  }
}
```

Common status/code pairs:

| HTTP status | Code | Use |
| --- | --- | --- |
| `400` | `bad_request` | Malformed JSON, invalid cursor, unsupported query shape. |
| `401` | `unauthenticated` | Missing/invalid authenticated user. |
| `403` | `forbidden` | User lacks workspace role/permission. |
| `404` | `not_found` | Resource does not exist in authorized workspace or is deleted. |
| `409` | `conflict` | `updated_at`/ETag conflict, duplicate import, state transition conflict. |
| `413` | `payload_too_large` | Upload/import exceeds limit. |
| `415` | `unsupported_media_type` | Blocked or unsupported file/content type. |
| `422` | `validation_failed` | Valid JSON but invalid data. |
| `429` | `rate_limited` | Too many requests. |
| `500` | `internal_error` | Unexpected server error. |

Sensitive error rule:

- Errors can name record types and safe field labels, but should avoid echoing full OCR text, raw file content, object storage keys, or highly sensitive notes.

## Pagination, Sorting, Filtering, And Dynamic Filter Options

Default list query parameters:

| Parameter | Purpose |
| --- | --- |
| `limit` | Default `50`, max `200`. |
| `cursor` | Opaque cursor from prior response. |
| `sort` | Stable sort key, for example `date_desc`, `name_asc`, `updated_desc`. |
| `include_deleted` | Owner/editor only; default false. |
| `q` | Text search where supported. |

Dynamic dependent filters:

- Each grid endpoint that has filters should also expose a `filter-options` endpoint.
- Options must be computed using all active filters except the option's own field.
- Options should only include values that produce at least one matching record.
- Sort dropdowns are not treated as record-limiting filters.

Standard filter-options response:

```json
{
  "data": {
    "property_id": [
      { "value": "uuid", "label": "Office", "count": 5 }
    ],
    "status": [
      { "value": "completed", "label": "Completed", "count": 3 }
    ]
  }
}
```

## Optimistic Concurrency

Recommended MVP approach:

- `GET` responses include `updated_at`.
- `PATCH` and destructive actions accept `If-Match: "updated_at:<timestamp>"`.
- If the current `updated_at` differs, return `409 conflict`.
- For clients that cannot set headers easily, allow body field `expected_updated_at`.

Conflict response:

```json
{
  "error": {
    "code": "edit_conflict",
    "message": "This record changed since you opened it.",
    "details": [
      { "field": "updated_at", "issue": "stale" }
    ]
  }
}
```

## Roles And Permissions

Role summary:

| Capability | Owner | Admin | Editor | Viewer |
| --- | --- | --- | --- | --- |
| View records | Yes | Yes | Yes | Yes |
| Create/edit records | Yes | Yes | Yes | No |
| Archive/delete records | Yes | Yes | Yes | No |
| Upload/remove files | Yes | Yes | Yes | No |
| Read OCR text | Yes | Yes | Yes | Yes, if workspace allows |
| Queue OCR | Yes | Yes | Yes | No |
| Export data | Yes | Yes | Yes | Optional workspace setting |
| Manage editor/viewer members | Yes | Yes | No | No |
| Manage admins/owners | Yes | No | No | No |
| Manage billing | Yes | No | No | No |
| Request workspace deletion | Yes | No | No | No |

Every workspace-scoped endpoint must:

1. Load membership by authenticated `user_id` and `workspace_id`.
2. Verify membership status is active.
3. Verify required role.
4. Apply `workspace_id` filter to every database query.

## Workspace And Tenancy APIs

### Endpoints

| Method and path | Purpose | Required role |
| --- | --- | --- |
| `GET /workspaces` | List workspaces available to the user. | Authenticated user |
| `POST /workspaces` | Create a workspace. | Authenticated user |
| `GET /workspaces/{workspaceId}` | Get workspace details. | Viewer |
| `PATCH /workspaces/{workspaceId}` | Update workspace name/settings. | Owner |
| `POST /workspaces/{workspaceId}/archive` | Archive workspace. | Owner |
| `POST /workspaces/{workspaceId}/restore` | Restore archived workspace. | Owner |
| `GET /workspaces/{workspaceId}/memberships` | List members. | Owner or admin |
| `POST /workspaces/{workspaceId}/memberships` | Invite/add editor/viewer member. | Owner or admin |
| `PATCH /workspaces/{workspaceId}/memberships/{membershipId}` | Change role/status. | Owner; admin only for editor/viewer members |
| `DELETE /workspaces/{workspaceId}/memberships/{membershipId}` | Remove member. | Owner; admin only for editor/viewer members |

Workspace authorization:

- `GET /workspaces` returns only workspaces with active membership.
- Workspace-specific routes require active membership in that workspace.
- Owners can manage all members, billing, archive, restore, and deletion.
- Admins can manage editor/viewer members if MVP includes the admin role.

Create request:

```json
{
  "name": "Home records",
  "settings": {
    "viewer_can_export": false
  }
}
```

Workspace response:

```json
{
  "data": {
    "id": "uuid",
    "name": "Home records",
    "status": "active",
    "role": "owner",
    "settings": {
      "viewer_can_export": false
    },
    "created_at": "2026-06-06T12:00:00Z",
    "updated_at": "2026-06-06T12:00:00Z"
  }
}
```

Validation:

- `name` required, trimmed, max length product decision.
- Cannot remove last active owner.
- Cannot downgrade last owner.
- Admins cannot grant owner/admin roles or modify owners.

Error cases:

- `403 forbidden` if not owner for membership/billing/archive routes.
- `409 conflict` if removing/downgrading last owner.
- `422 validation_failed` for invalid role/status.

Sensitive data:

- Workspace names and membership reveal household access. Avoid broad admin exposure.

Web use cases:

- Workspace switcher, settings, members panel, archive flow.

iOS use cases:

- Choose target workspace for capture.
- Confirm upload permission.

Implementation notes:

- Member invitation mechanics are provider-dependent and can be deferred.
- Workspace archive should block writes but keep reads available to owners unless product decides otherwise.

Unresolved decisions:

- Whether MVP allows multiple members or keeps memberships single-user until later.
- Invitation flow and email delivery provider.

## Core Record APIs

All core record routes are workspace-scoped:

```text
/workspaces/{workspaceId}/...
```

All create/update/delete routes require `owner` or `editor`. List/detail routes require `viewer`.

All record responses should include:

- `id`
- resource fields
- relationship ids
- `created_at`
- `updated_at`
- `deleted_at` only when requested/authorized
- `legacy_source` only on import/admin endpoints, not normal grids

### Properties

Endpoints:

| Method and path | Purpose | Role |
| --- | --- | --- |
| `GET /workspaces/{workspaceId}/properties` | List property grid rows. | Viewer |
| `GET /workspaces/{workspaceId}/properties/filter-options` | Dynamic property filters where needed. | Viewer |
| `POST /workspaces/{workspaceId}/properties` | Create property. | Editor |
| `GET /workspaces/{workspaceId}/properties/{propertyId}` | Get property details. | Viewer |
| `PATCH /workspaces/{workspaceId}/properties/{propertyId}` | Update property. | Editor |
| `POST /workspaces/{workspaceId}/properties/{propertyId}/archive` | Archive property. | Editor |
| `POST /workspaces/{workspaceId}/properties/{propertyId}/restore` | Restore property. | Editor |
| `DELETE /workspaces/{workspaceId}/properties/{propertyId}` | Request/delete property record. | Editor |

List filters/sort:

- `q`
- `is_primary`
- `archived`
- `sort=name_asc|name_desc|updated_desc|created_desc`

Request shape:

```json
{
  "name": "Office",
  "display_address": "1124 Huminger Drive",
  "purchase_date": "2020-01-15",
  "purchase_price_cents": 20000000,
  "currency_code": "USD",
  "notes": "Optional note",
  "is_primary": true
}
```

Response shape:

```json
{
  "data": {
    "id": "uuid",
    "name": "Office",
    "display_address": "1124 Huminger Drive",
    "purchase_date": "2020-01-15",
    "purchase_price_cents": 20000000,
    "currency_code": "USD",
    "notes": "Optional note",
    "is_primary": true,
    "summary": {
      "project_count": 6,
      "expense_count": 12,
      "document_count": 8,
      "tracked_spend_cents": 3825550
    },
    "created_at": "2026-06-06T12:00:00Z",
    "updated_at": "2026-06-06T12:00:00Z"
  }
}
```

Validation:

- `name` required.
- `purchase_price_cents` nonnegative if present.
- `currency_code` required if money present.
- Only one active primary property per workspace.

Errors:

- `409 conflict` if stale `updated_at`.
- `422 validation_failed` for negative money or invalid date.

Sensitive-data considerations:

- Addresses, purchase price, and notes are sensitive.

Web use cases:

- Property grid/detail, add/edit property, primary property display.

iOS use cases:

- Choose property when capturing a document or quick expense.

Implementation notes:

- Delete behavior should be soft-delete first. Local app cascades property deletion; SaaS should require explicit confirmation and background file cleanup.

Unresolved decisions:

- Whether property delete should cascade immediately or archive by default.

### Vendors

Endpoints:

| Method and path | Purpose | Role |
| --- | --- | --- |
| `GET /workspaces/{workspaceId}/vendors` | List vendors. | Viewer |
| `GET /workspaces/{workspaceId}/vendors/filter-options` | Dynamic vendor filters. | Viewer |
| `POST /workspaces/{workspaceId}/vendors` | Create vendor. | Editor |
| `GET /workspaces/{workspaceId}/vendors/{vendorId}` | Get vendor details. | Viewer |
| `PATCH /workspaces/{workspaceId}/vendors/{vendorId}` | Update vendor. | Editor |
| `POST /workspaces/{workspaceId}/vendors/{vendorId}/archive` | Archive vendor. | Editor |
| `DELETE /workspaces/{workspaceId}/vendors/{vendorId}` | Soft-delete vendor. | Editor |

List filters/sort:

- `q`
- `category`
- `status`
- `source_confidence`
- `sort=name_asc|name_desc|updated_desc`

Request shape:

```json
{
  "name": "Cedarline Carpentry",
  "category": "deck/patio/porch",
  "contact_name": "",
  "phone": "",
  "email": "",
  "website": "",
  "notes": "",
  "status": "active"
}
```

Response shape:

```json
{
  "data": {
    "id": "uuid",
    "name": "Cedarline Carpentry",
    "category": "deck/patio/porch",
    "status": "active",
    "source_confidence": "user_confirmed",
    "summary": {
      "project_count": 2,
      "expense_count": 4,
      "total_spend_cents": 1475500
    },
    "created_at": "2026-06-06T12:00:00Z",
    "updated_at": "2026-06-06T12:00:00Z"
  }
}
```

Validation:

- `name` required.
- Do not enforce unique normalized name for MVP.
- Keep raw imported vendor names in linked records.

Errors:

- `422 validation_failed` for invalid status/category.
- `409 conflict` for stale update.

Sensitive data:

- Contact info and vendor relationships are sensitive.

Web use cases:

- Vendor dropdowns, vendor grid, edit vendor.

iOS use cases:

- Quick vendor selection while adding an expense/document.

Implementation notes:

- Automatic merge suggestions are later. Do not merge silently through API.

Unresolved decisions:

- Vendor category taxonomy and whether users can create custom categories.

### Projects

Endpoints:

| Method and path | Purpose | Role |
| --- | --- | --- |
| `GET /workspaces/{workspaceId}/projects` | List compact project grid rows. | Viewer |
| `GET /workspaces/{workspaceId}/projects/filter-options` | Dynamic dependent project filters. | Viewer |
| `POST /workspaces/{workspaceId}/projects` | Create project. | Editor |
| `GET /workspaces/{workspaceId}/projects/{projectId}` | Get project detail. | Viewer |
| `PATCH /workspaces/{workspaceId}/projects/{projectId}` | Update project. | Editor |
| `POST /workspaces/{workspaceId}/projects/{projectId}/archive` | Archive project. | Editor |
| `POST /workspaces/{workspaceId}/projects/{projectId}/restore` | Restore project. | Editor |
| `DELETE /workspaces/{workspaceId}/projects/{projectId}` | Soft-delete/unlink project. | Editor |

List filters/sort:

- `property_id`
- `vendor_id`
- `status`
- `category`
- `open_items=any|none`
- `start_date_from`
- `start_date_to`
- `completion_date_from`
- `completion_date_to`
- `q`
- `sort=updated_desc|start_date_desc|completion_date_desc|name_asc|status_asc`

Filter-options:

```text
GET /workspaces/{workspaceId}/projects/filter-options?property_id=uuid&open_items=any&status=completed
```

Response includes relevant properties, statuses, categories, vendors, and open-item states based on other active filters.

Create/update request:

```json
{
  "property_id": "uuid",
  "vendor_id": "uuid-or-null",
  "name": "Deck repair and railing",
  "category": "deck/patio/porch",
  "status": "in_progress",
  "start_date": "2026-06-01",
  "completion_date": null,
  "contractor_name_raw": "Cedarline Carpentry",
  "permit_number": "",
  "scope_summary": "Deck repair and railing work.",
  "notes": ""
}
```

Grid response:

```json
{
  "data": [
    {
      "id": "uuid",
      "property_id": "uuid",
      "property_name": "Office",
      "vendor_id": "uuid",
      "name": "Deck repair and railing",
      "category": "deck/patio/porch",
      "status": "in_progress",
      "start_date": "2026-06-01",
      "completion_date": null,
      "expense_count": 1,
      "expense_total_cents": 5000,
      "document_count": 1,
      "open_item_count": 2,
      "updated_at": "2026-06-06T12:00:00Z"
    }
  ],
  "meta": {
    "next_cursor": null,
    "total_count": 1
  }
}
```

Detail response should include linked expense/document counts and may include recent linked records, but secondary details should remain compact.

Validation:

- `property_id` required and must belong to workspace.
- `vendor_id` must belong to workspace if present.
- `status` must be valid.
- `completion_date` can be null, but completed/archived projects missing it generate follow-up items.

Errors:

- `404 not_found` if related property/vendor is outside workspace.
- `409 conflict` for stale update.
- `422 validation_failed` for invalid status/date/category.

Sensitive data:

- Project scope, permit number, notes, contractor names, spend summaries.

Web use cases:

- Projects grid, dynamic filters, project detail modal, open item expansion, issue resolution.

iOS use cases:

- Select project for captured receipt/photo.
- Review project open items.

Implementation notes:

- Project delete should preserve expenses/documents and clear project links, matching local behavior, unless product chooses archive-only.
- Open item count is generated at read time from follow-up logic plus overrides.

Unresolved decisions:

- Whether `completeness_override_note` should suppress child expense/document follow-ups in SaaS.

### Expenses

Endpoints:

| Method and path | Purpose | Role |
| --- | --- | --- |
| `GET /workspaces/{workspaceId}/expenses` | List compact expense grid rows. | Viewer |
| `GET /workspaces/{workspaceId}/expenses/filter-options` | Dynamic dependent expense filters. | Viewer |
| `POST /workspaces/{workspaceId}/expenses` | Create expense. | Editor |
| `GET /workspaces/{workspaceId}/expenses/{expenseId}` | Get expense detail. | Viewer |
| `PATCH /workspaces/{workspaceId}/expenses/{expenseId}` | Update expense. | Editor |
| `DELETE /workspaces/{workspaceId}/expenses/{expenseId}` | Soft-delete expense and optionally unlink documents. | Editor |

List filters/sort:

- `property_id`
- `project_id`
- `vendor_id`
- `record_treatment`
- `category`
- `documentation_status`
- `date_from`
- `date_to`
- `amount_min_cents`
- `amount_max_cents`
- `q`
- `sort=date_desc|date_asc|amount_desc|amount_asc|vendor_asc|updated_desc`

Request:

```json
{
  "property_id": "uuid",
  "project_id": "uuid-or-null",
  "vendor_id": "uuid-or-null",
  "vendor_name_raw": "Northside Painting Co.",
  "expense_date": "2026-06-04",
  "description": "Paint outside railing",
  "amount_cents": 68000,
  "currency_code": "USD",
  "category": "exterior painting",
  "record_treatment": "repair_upkeep",
  "documentation_status": "receipt_attached",
  "notes": ""
}
```

Response:

```json
{
  "data": {
    "id": "uuid",
    "property_id": "uuid",
    "project_id": "uuid",
    "vendor_id": "uuid",
    "vendor_name_raw": "Northside Painting Co.",
    "expense_date": "2026-06-04",
    "description": "Paint outside railing",
    "amount_cents": 68000,
    "currency_code": "USD",
    "record_treatment": "repair_upkeep",
    "documentation_status": "receipt_attached",
    "document_count": 1,
    "open_item_count": 0,
    "created_at": "2026-06-06T12:00:00Z",
    "updated_at": "2026-06-06T12:00:00Z"
  }
}
```

Validation:

- `property_id` required.
- `project_id`, if present, must belong to the same workspace and property.
- `vendor_id`, if present, must belong to workspace.
- `description` required.
- `amount_cents` required and nonnegative.
- `currency_code` required.
- `record_treatment` must be one of `possible_improvement`, `repair_upkeep`, `review_later`.
- API must not return or imply professional conclusions from `record_treatment`.

Errors:

- `422 validation_failed` for negative money or invalid enum.
- `404 not_found` for cross-workspace relationships.
- `409 conflict` for stale update.

Sensitive data:

- Amounts, vendors, descriptions, notes, linked documents.

Web use cases:

- Expenses grid, dynamic filters, edit expense, attach support from issue modal.

iOS use cases:

- Quick add expense from receipt capture.
- Select expense when uploading support.

Implementation notes:

- Expense delete should preserve linked documents by unlinking or soft-deleting only by explicit user choice.

Unresolved decisions:

- Whether `documentation_status` should remain user-editable or become derived from linked documents/files.

### Documents

Endpoints:

| Method and path | Purpose | Role |
| --- | --- | --- |
| `GET /workspaces/{workspaceId}/documents` | List document grid rows. | Viewer |
| `GET /workspaces/{workspaceId}/documents/filter-options` | Dynamic dependent document filters. | Viewer |
| `POST /workspaces/{workspaceId}/documents` | Create document metadata. | Editor |
| `GET /workspaces/{workspaceId}/documents/{documentId}` | Get document detail. | Viewer |
| `PATCH /workspaces/{workspaceId}/documents/{documentId}` | Update document metadata. | Editor |
| `DELETE /workspaces/{workspaceId}/documents/{documentId}` | Soft-delete document and queue file deletion. | Editor |

List filters/sort:

- `property_id`
- `project_id`
- `expense_id`
- `document_type`
- `file_availability`
- `document_date_from`
- `document_date_to`
- `q`
- `sort=document_date_desc|document_date_asc|name_asc|type_asc|updated_desc`

Request:

```json
{
  "property_id": "uuid",
  "project_id": "uuid-or-null",
  "expense_id": "uuid-or-null",
  "display_name": "Cedarline Carpentry - Receipt",
  "document_type": "receipt",
  "document_date": "2026-06-05",
  "notes": ""
}
```

Response:

```json
{
  "data": {
    "id": "uuid",
    "property_id": "uuid",
    "project_id": "uuid",
    "expense_id": "uuid",
    "display_name": "Cedarline Carpentry - Receipt",
    "document_type": "receipt",
    "document_date": "2026-06-05",
    "file_availability": "available",
    "file_status_note": "",
    "file": {
      "id": "uuid",
      "original_file_name": "receipt.pdf",
      "mime_type": "application/pdf",
      "size_bytes": 92112,
      "status": "available"
    },
    "ocr": {
      "status": "succeeded",
      "has_text": true,
      "completed_at": "2026-06-06T12:00:00Z"
    },
    "updated_at": "2026-06-06T12:00:00Z"
  }
}
```

Validation:

- `property_id` required unless `expense_id` supplies property context; recommended API still requires or derives explicitly.
- If `expense_id` is present, document property/project must match the expense.
- `display_name` required.
- `document_type` required.

Errors:

- `422 validation_failed` for mismatched property/project/expense context.
- `404 not_found` for cross-workspace linked records.

Sensitive data:

- Document names, notes, context, file status, OCR summary.

Web use cases:

- Documents grid, add document modal, linked expense support, preview, OCR text.

iOS use cases:

- Create document metadata from capture.
- Link captured file to expense/project/property.

Implementation notes:

- A document can exist before file upload.
- File availability comes from `documents.file_availability` and active `document_files`.

Unresolved decisions:

- Whether new document records require a date, matching current form behavior, or allow null like the local model.

## File APIs

File endpoints are nested under documents or workspace. They must never return raw object storage keys.

### Endpoints

| Method and path | Purpose | Role |
| --- | --- | --- |
| `POST /workspaces/{workspaceId}/documents/{documentId}/files/upload-intents` | Create direct upload intent. | Editor |
| `POST /workspaces/{workspaceId}/documents/{documentId}/files/confirm` | Confirm upload and create/activate file row. | Editor |
| `GET /workspaces/{workspaceId}/documents/{documentId}/files/{fileId}` | Get file metadata/status. | Viewer |
| `POST /workspaces/{workspaceId}/documents/{documentId}/files/{fileId}/download-url` | Create short-lived download URL. | Viewer, if allowed |
| `POST /workspaces/{workspaceId}/documents/{documentId}/files/{fileId}/preview-url` | Create short-lived preview URL/status. | Viewer, if allowed |
| `DELETE /workspaces/{workspaceId}/documents/{documentId}/files/{fileId}` | Remove stored file and keep document entry. | Editor |

Upload intent request:

```json
{
  "file_name": "receipt.pdf",
  "mime_type": "application/pdf",
  "size_bytes": 92112,
  "sha256": "optional-hex-sha256"
}
```

Upload intent response:

```json
{
  "data": {
    "upload_id": "uuid",
    "document_file_id": "uuid",
    "upload_url": "https://storage-provider.example/signed-upload",
    "upload_headers": {
      "content-type": "application/pdf"
    },
    "expires_at": "2026-06-06T12:10:00Z",
    "max_size_bytes": 26214400
  }
}
```

Confirm request:

```json
{
  "document_file_id": "uuid",
  "upload_id": "uuid",
  "size_bytes": 92112,
  "sha256": "optional-hex-sha256"
}
```

File response:

```json
{
  "data": {
    "id": "uuid",
    "document_id": "uuid",
    "original_file_name": "receipt.pdf",
    "mime_type": "application/pdf",
    "size_bytes": 92112,
    "sha256": "optional-hex-sha256",
    "source": "web_upload",
    "status": "available",
    "scan_status": "passed",
    "preview_status": "ready",
    "uploaded_at": "2026-06-06T12:00:00Z"
  }
}
```

Validation:

- Document must belong to workspace.
- File size must be within entitlement and product limit.
- Block executable/script-like extensions and MIME types at least as strictly as local backup blocked rules.
- Only one active available file per document for MVP unless product decides otherwise.

Errors:

- `413 payload_too_large` for size limit.
- `415 unsupported_media_type` for blocked file type.
- `409 conflict` if document already has active file.
- `422 validation_failed` if confirmation metadata does not match upload intent.

Sensitive data:

- File names, hashes, downloads, previews, and scan statuses are sensitive.
- Download and preview URL creation should write `audit_events`.

Web use cases:

- Attach file, view/download file, remove file, preview file.

iOS use cases:

- Direct camera/file upload.
- Retry upload after network interruption.

Implementation notes:

- Object storage key is generated server-side.
- Scan status can be `not_required`, `pending`, `passed`, `failed`, `quarantined`.
- Preview status can be `not_supported`, `pending`, `ready`, `failed`.
- Deleting a file sets document `file_availability = removed` unless a replacement exists.

Unresolved decisions:

- Exact cloud file size limit.
- Malware scanning provider and whether download is blocked until scan passes.

## OCR APIs

### Endpoints

| Method and path | Purpose | Role |
| --- | --- | --- |
| `GET /workspaces/{workspaceId}/documents/{documentId}/ocr` | Get OCR status and text availability. | Viewer |
| `GET /workspaces/{workspaceId}/documents/{documentId}/ocr/text` | Read OCR text. | Viewer, if allowed |
| `POST /workspaces/{workspaceId}/documents/{documentId}/ocr/jobs` | Queue OCR. | Editor |
| `POST /workspaces/{workspaceId}/documents/{documentId}/ocr/retry` | Retry failed OCR. | Editor |
| `GET /workspaces/{workspaceId}/ocr/search` | Search OCR text. | Viewer, if enabled |

Status response:

```json
{
  "data": {
    "document_id": "uuid",
    "document_file_id": "uuid",
    "status": "succeeded",
    "engine": "legacy_import",
    "has_text": true,
    "started_at": "2026-06-06T12:00:00Z",
    "completed_at": "2026-06-06T12:01:00Z",
    "error_code": null
  }
}
```

Text response:

```json
{
  "data": {
    "document_id": "uuid",
    "text": "Extracted document text...",
    "engine": "legacy_import",
    "completed_at": "2026-06-06T12:01:00Z"
  }
}
```

Queue request:

```json
{
  "document_file_id": "uuid",
  "force": false
}
```

OCR search query:

```text
GET /workspaces/{workspaceId}/ocr/search?q=railing&property_id=uuid&limit=25
```

Search response:

```json
{
  "data": [
    {
      "document_id": "uuid",
      "display_name": "Receipt",
      "snippet": "paint outside railing",
      "document_type": "receipt",
      "document_date": "2026-06-05"
    }
  ],
  "meta": {
    "next_cursor": null
  }
}
```

Validation:

- Document and file must belong to workspace.
- OCR requires file availability `available`.
- OCR search requires entitlement and privacy/product approval.

Errors:

- `409 conflict` if OCR already processing unless `force` is allowed.
- `422 validation_failed` if file type is not readable.
- `403 forbidden` if OCR/search entitlement disabled.

Sensitive data:

- OCR text can contain full document contents.
- Reading OCR text and support-sensitive access should write `audit_events`.
- Search snippets should be short and avoid overexposing content in notifications.

Web use cases:

- Read text/OCR in document preview.
- Search document text if enabled.

iOS use cases:

- Show processing status after capture.
- Read OCR text for captured document if user opens detail.

Implementation notes:

- Imported legacy OCR text should have `engine = legacy_import`.
- Do not reprocess imported OCR automatically without user action or product decision.

Unresolved decisions:

- Whether OCR search is MVP or later.
- OCR engine/provider and privacy posture.

## Follow-up APIs

Follow-ups are generated read models. They are not stored as open item records.

### Endpoints

| Method and path | Purpose | Role |
| --- | --- | --- |
| `GET /workspaces/{workspaceId}/follow-ups` | List generated open items. | Viewer |
| `GET /workspaces/{workspaceId}/projects/{projectId}/follow-ups` | List project-centered open items. | Viewer |
| `POST /workspaces/{workspaceId}/follow-up-overrides` | Override and mark an item complete. | Editor |
| `GET /workspaces/{workspaceId}/follow-up-overrides` | List persisted overrides. | Viewer |
| `DELETE /workspaces/{workspaceId}/follow-up-overrides/{overrideId}` | Reopen/remove override. | Editor |

List filters/sort:

- `surface=dashboard|projects|export`
- `property_id`
- `project_id`
- `expense_id`
- `document_id`
- `type`
- `severity`
- `sort=priority_asc|created_context_desc`

Follow-up response:

```json
{
  "data": [
    {
      "key": "project:uuid:supporting-document:contract",
      "type": "project-missing-supporting-documents",
      "type_label": "Project documents",
      "label": "Add contract or estimate",
      "detail": "Deck repair and railing is missing a contract or estimate document record.",
      "severity": "medium",
      "priority": 50,
      "property_id": "uuid",
      "project_id": "uuid",
      "expense_id": null,
      "document_id": null,
      "primary_action": {
        "label": "Add contract or estimate",
        "action": "open_document_form",
        "destination": "project_modal"
      }
    }
  ],
  "meta": {
    "recomputed_at": "2026-06-06T12:00:00Z"
  }
}
```

Override request:

```json
{
  "follow_up_key": "project:uuid:supporting-document:contract",
  "follow_up_type": "project-missing-supporting-documents",
  "property_id": "uuid",
  "project_id": "uuid",
  "expense_id": null,
  "document_id": null,
  "label_snapshot": "Add contract or estimate",
  "detail_snapshot": "Deck repair and railing is missing a contract or estimate document record.",
  "note": "Handled outside the app."
}
```

Override response:

```json
{
  "data": {
    "id": "uuid",
    "follow_up_type": "project-missing-supporting-documents",
    "source_follow_up_id": null,
    "project_id": "uuid",
    "note": "Handled outside the app.",
    "completed_at": "2026-06-06T12:00:00Z"
  }
}
```

Validation:

- Context record ids must belong to workspace.
- `follow_up_key` must match a currently generated item unless API allows legacy override recovery.
- Override note optional but recommended.

Errors:

- `404 not_found` if follow-up no longer exists and override recovery is not allowed.
- `409 conflict` if override already exists.
- `422 validation_failed` for mismatched context.

Sensitive data:

- Details and notes can include property, project, expense, vendor, and document references.

Web use cases:

- Dashboard Needs attention subtab.
- Project open-item expansion.
- Focused resolution modals.

iOS use cases:

- Show project open items during capture/review.
- Allow simple override if user has editor role.

Implementation notes:

- Recompute after record edits, file changes, imports, and override changes.
- Cache generated follow-ups only if invalidated reliably.
- Project-centered follow-ups should keep users anchored in project/dashboard context.

Unresolved decisions:

- Whether overrides should auto-invalidate when the source record changes.

## Activity Event APIs

Endpoints:

| Method and path | Purpose | Role |
| --- | --- | --- |
| `GET /workspaces/{workspaceId}/activity-events` | List Recent activity. | Viewer |

Filters/sort:

- `record_type=project|expense|document|property|vendor|file|export|import`
- `property_id`
- `project_id`
- `actor_user_id`
- `occurred_from`
- `occurred_to`
- `sort=occurred_desc`

Response:

```json
{
  "data": [
    {
      "id": "uuid",
      "event_type": "created",
      "record_type": "expense",
      "record_id": "uuid",
      "summary": "Expense added",
      "property_id": "uuid",
      "project_id": "uuid",
      "occurred_at": "2026-06-06T12:00:00Z"
    }
  ],
  "meta": {
    "next_cursor": null
  }
}
```

Validation/errors:

- Viewer access required.
- No client create endpoint for MVP; activity is system-generated.

Sensitive data:

- Activity can reveal file names, costs, vendors, and usage. Keep summaries compact.

Web use cases:

- Dashboard Recent activity.

iOS use cases:

- Recent capture confirmation/history.

Implementation notes:

- Sensitive actions also write `audit_events`, not just activity.

Unresolved decisions:

- How much imported/synthetic activity to show after backup import.

## Import And Migration APIs

Import is workspace-scoped and editor-only. Owner may be required for import into a workspace with existing records.

### Endpoints

| Method and path | Purpose | Role |
| --- | --- | --- |
| `POST /workspaces/{workspaceId}/imports/backup-upload-intents` | Create upload target for backup JSON. | Editor |
| `POST /workspaces/{workspaceId}/imports/backup-validations` | Validate uploaded backup and create import batch. | Editor |
| `GET /workspaces/{workspaceId}/imports/{importBatchId}/preview` | Preview records, warnings, duplicates, file outcomes. | Editor |
| `POST /workspaces/{workspaceId}/imports/{importBatchId}/confirm` | Confirm import. | Editor or Owner if existing records affected |
| `GET /workspaces/{workspaceId}/imports/{importBatchId}` | Import status. | Editor |
| `GET /workspaces/{workspaceId}/imports/{importBatchId}/error-report` | Error/warning report. | Editor |
| `GET /workspaces/{workspaceId}/imports/{importBatchId}/mappings` | Legacy id to SaaS id mapping. | Editor |
| `GET /workspaces/{workspaceId}/imports/{importBatchId}/files` | File import outcomes. | Editor |

Upload intent request:

```json
{
  "file_name": "home-basis-backup.json",
  "size_bytes": 1048576,
  "sha256": "optional-hex-sha256"
}
```

Validation request:

```json
{
  "uploaded_backup_id": "uuid",
  "duplicate_strategy": "detect_only"
}
```

Preview response:

```json
{
  "data": {
    "import_batch_id": "uuid",
    "status": "validated",
    "source": {
      "app": "home-basis-tracker",
      "backup_version": 1,
      "created_at": "2026-06-06T12:00:00Z"
    },
    "counts": {
      "properties": 2,
      "vendors": 10,
      "projects": 12,
      "expenses": 25,
      "documents": 30,
      "follow_up_overrides": 3
    },
    "files": {
      "expected": 18,
      "importable": 15,
      "missing": 2,
      "blocked": 1
    },
    "warnings": [
      {
        "code": "currency_defaulted",
        "message": "Imported money values will use USD unless changed later.",
        "count": 27
      }
    ],
    "duplicates": {
      "same_backup_seen": false,
      "legacy_ids_seen": []
    }
  }
}
```

Confirm request:

```json
{
  "mode": "append",
  "duplicate_strategy": "skip_existing_legacy_ids",
  "import_ocr_text": true,
  "accept_blank_file_checksums": false,
  "acknowledged_warning_codes": [
    "currency_defaulted",
    "missing_files"
  ]
}
```

Status response:

```json
{
  "data": {
    "id": "uuid",
    "status": "completed_with_warnings",
    "record_counts": {},
    "file_counts": {},
    "started_at": "2026-06-06T12:00:00Z",
    "completed_at": "2026-06-06T12:02:00Z"
  }
}
```

Validation:

- Backup must match supported `app` and `backupVersion`.
- Backup size limit enforced.
- Duplicate ids inside backup are rejected.
- Broken relationships are rejected or previewed as blocking errors.
- File payloads must pass blocked-type, size, data URL, and checksum checks.
- Legacy ids preserved only through import metadata.

Repeated import/duplicate design:

- `detect_only`: preview duplicate risk and block confirm until user chooses.
- `skip_existing_legacy_ids`: import only records without matching `(workspace_id, source_app, source_entity, source_id)`.
- `new_copy`: import all records with new UUIDs and duplicate warnings.
- `replace_workspace` is not MVP and should require owner role plus explicit deletion/export guardrails.

Errors:

- `413 payload_too_large` for backup over limit.
- `422 validation_failed` for invalid backup envelope.
- `409 conflict` for duplicate import without chosen strategy.
- `415 unsupported_media_type` for non-JSON upload.

Sensitive data:

- Backups can contain all records and file data. Upload, validation, confirm, download of reports, and failed import access should write `audit_events`.
- Do not retain raw uploaded backup longer than needed.

Web use cases:

- Guided migration from local backup.
- Preview warnings before committing import.

iOS use cases:

- View import status and imported records after web import. Full backup upload from iOS can be later.

Implementation notes:

- Import should be asynchronous after confirm.
- Preview should not create core records.
- Confirm should create `import_records` and `import_files`.
- Follow-ups should be recomputed after successful import.

Unresolved decisions:

- Default duplicate strategy.
- Whether blank file checksums are accepted by default.
- Raw backup retention window.

## Export APIs

### Endpoints

| Method and path | Purpose | Role |
| --- | --- | --- |
| `POST /workspaces/{workspaceId}/exports` | Request export. | Editor, or Viewer if allowed |
| `GET /workspaces/{workspaceId}/exports` | List exports. | Editor, or Viewer if allowed |
| `GET /workspaces/{workspaceId}/exports/{exportId}` | Export status/detail. | Editor, or Viewer if allowed |
| `POST /workspaces/{workspaceId}/exports/{exportId}/download-url` | Create short-lived download URL. | Export creator, editor, owner, or allowed viewer |
| `DELETE /workspaces/{workspaceId}/exports/{exportId}` | Delete/expire export. | Editor or owner |

Request:

```json
{
  "export_type": "review_packet_pdf",
  "filters": {
    "property_id": "uuid",
    "project_ids": ["uuid"]
  },
  "include_documents_index": true,
  "include_ocr_text": false
}
```

Supported export types:

- `expenses_csv`
- `review_packet_pdf`
- `full_data_export`
- `document_archive` later

Response:

```json
{
  "data": {
    "id": "uuid",
    "export_type": "review_packet_pdf",
    "status": "queued",
    "file_name": null,
    "expires_at": "2026-06-13T12:00:00Z",
    "created_at": "2026-06-06T12:00:00Z"
  }
}
```

Validation:

- Filters must reference records in workspace.
- `include_ocr_text` requires explicit entitlement/product decision.
- Review packet copy should preserve professional-review framing and avoid conclusions.
- CSV should neutralize spreadsheet formulas.

Errors:

- `403 forbidden` if viewer export disabled.
- `422 validation_failed` for invalid filters/export type.
- `409 conflict` if export expired/deleted.

Sensitive data:

- Export creation and download should write `audit_events`.
- Export files should expire by default.
- Download URLs must be short-lived and not expose object keys.

Web use cases:

- Export page, review packet, expenses CSV, full data export.

iOS use cases:

- Show export status and optionally share/download if allowed.

Implementation notes:

- Export generation should be asynchronous.
- Full data export should include enough data for user portability.

Unresolved decisions:

- Export retention/expiration period.
- Whether OCR text can be included in exports.

## Billing And Entitlement APIs

Design-level only. No billing provider is chosen.

### Endpoints

| Method and path | Purpose | Role |
| --- | --- | --- |
| `GET /workspaces/{workspaceId}/entitlements` | Current plan, features, and limits. | Viewer |
| `GET /workspaces/{workspaceId}/usage` | Storage and record usage. | Viewer |
| `POST /workspaces/{workspaceId}/billing-portal-link` | Placeholder for billing portal URL. | Owner |

Entitlement response:

```json
{
  "data": {
    "plan_code": "starter",
    "status": "active",
    "features": {
      "ocr_enabled": true,
      "ios_capture_enabled": true,
      "exports_enabled": true
    },
    "limits": {
      "max_storage_bytes": 1073741824,
      "max_file_size_bytes": 26214400,
      "max_properties": 10
    }
  }
}
```

Usage response:

```json
{
  "data": {
    "storage_used_bytes": 123456,
    "document_file_count": 8,
    "property_count": 2,
    "project_count": 12,
    "expense_count": 25,
    "document_count": 30
  }
}
```

Validation/errors:

- Owner required for billing portal.
- `403 forbidden` if feature disabled.

Sensitive data:

- Usage can reveal household record volume and file activity.

Web use cases:

- Settings/billing panel, upload limit messaging.

iOS use cases:

- Decide whether capture/upload is available.

Implementation notes:

- Keep provider ids out of normal client responses.

Unresolved decisions:

- Billing provider, plan limits, trials, app store purchase model.

## Account And Data APIs

### Endpoints

| Method and path | Purpose | Role |
| --- | --- | --- |
| `GET /account` | Get account settings. | Authenticated user |
| `PATCH /account` | Update account settings. | Authenticated user |
| `POST /account/full-data-exports` | Request account-level export across accessible owned workspaces. | Authenticated user |
| `POST /account/deletion-requests` | Request account deletion. | Authenticated user |
| `GET /account/deletion-requests/{requestId}` | Check deletion status. | Authenticated user |
| `POST /workspaces/{workspaceId}/deletion-requests` | Request workspace deletion. | Owner |
| `GET /workspaces/{workspaceId}/deletion-requests/{requestId}` | Check workspace deletion status. | Owner |

Account response:

```json
{
  "data": {
    "id": "uuid",
    "email": "user@example.com",
    "display_name": "Homeowner",
    "timezone": "America/New_York",
    "status": "active"
  }
}
```

Deletion request:

```json
{
  "confirm": true,
  "requested_scope": "account",
  "acknowledged": [
    "owned_workspaces_must_be_transferred_or_deleted",
    "exports_should_be_downloaded_first"
  ]
}
```

Deletion status response:

```json
{
  "data": {
    "id": "uuid",
    "status": "pending",
    "requested_at": "2026-06-06T12:00:00Z",
    "scheduled_deletion_at": "2026-06-20T12:00:00Z",
    "blocking_items": [
      {
        "type": "workspace_ownership",
        "workspace_id": "uuid",
        "message": "Transfer or delete this workspace before account deletion."
      }
    ]
  }
}
```

Validation:

- Account deletion cannot orphan a workspace without an owner unless workspace deletion is also confirmed.
- Workspace deletion requires owner role and explicit confirmation.

Errors:

- `409 conflict` for unresolved workspace ownership or active subscription blockers.
- `403 forbidden` for non-owner workspace deletion.

Sensitive data:

- Full data exports and deletion workflows are high sensitivity and should write `audit_events`.

Web use cases:

- Account settings, data export, account/workspace deletion.

iOS use cases:

- Show account info and deletion/export status; destructive flows may redirect to web.

Implementation notes:

- Full data export should be asynchronous and expire.
- Deletion should queue object storage cleanup, OCR deletion, export deletion, import raw snapshot deletion, and activity/audit retention handling.

Unresolved decisions:

- Retention windows, cancellation window, and what audit data remains after deletion.

## Audit Event Expectations

Write audit events for:

- File download URL creation.
- File preview URL creation if it exposes document content.
- OCR text read.
- Export requested.
- Export download URL creation.
- Import upload, validation, confirm, and error report access.
- Workspace deletion request and completion.
- Account deletion request and completion.
- Support/admin sensitive access.
- Billing portal link creation.

Audit event metadata should include record ids and action context, not raw OCR text, raw notes, raw file bytes, or object storage keys.

## MVP Endpoint Checklist

Minimum web MVP:

- Session and workspace list.
- Workspace detail.
- CRUD/list/filter-options for properties, vendors, projects, expenses, documents.
- File upload intent, confirm, download, remove.
- OCR status/read/queue.
- Follow-up list and overrides.
- Activity list.
- Backup import validate/preview/confirm/status.
- Export request/status/download.
- Entitlement/usage.
- Account/workspace deletion request stubs.

Minimum iOS companion MVP:

- Session/workspaces.
- Properties/projects/expenses/vendors lightweight lookup.
- Create document metadata.
- Upload file intent/confirm.
- OCR status.
- Project follow-ups read-only or simple override if editor.
- Usage/entitlement check.
