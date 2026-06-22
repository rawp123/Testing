# Legacy To SaaS Mapping

This document maps the existing local Home Basis Tracker / Home Ledger model to the proposed SaaS schema in `docs/saas-schema.md`. It is a design document only. It does not create migrations or import code.

## Source Context

Primary source docs:

- `docs/current-app-model.md`
- `docs/backup-format.md`
- `docs/follow-up-rules.md`
- `docs/migration-risks.md`

Confirmed local source behavior comes from those docs and their cited source files/tests. SaaS target fields come from `docs/saas-schema.md`.

## Mapping Status Terms

- `lossless`: Source value can be preserved without meaningful loss.
- `lossy`: Source value must be transformed or loses detail.
- `inferred`: Target value is derived from source context or app rules.
- `requires user review`: Import can preserve data but should warn the user.
- `not imported`: Source behavior is generated, UI-only, or local-only.

## Global Import Rules

| Source | Target | Transformation | Mapping status | Import warnings |
| --- | --- | --- | --- | --- |
| Backup envelope `app` | `import_batches.source_app` | Preserve string. Expected `home-basis-tracker`. | Lossless | Warn/reject if unsupported. |
| Backup envelope `productVersion` | `import_batches.source_product_version` | Preserve string. | Lossless | None. |
| Backup envelope `backupVersion` | `import_batches.source_backup_version` | Preserve integer. | Lossless | Reject newer unsupported versions. |
| Backup envelope `createdAt` | `import_batches.source_created_at` | Parse as timestamp if valid. | Lossless if valid | Warn if missing/invalid. |
| Local record ids | `import_records.source_id`, `legacy_source.legacy_id` | Preserve as metadata. Generate new UUID primary keys. | Lossless for metadata | Warn if duplicate inside backup; reject or require import policy. |
| Local generated follow-up open items | None | Recompute after import. | Not imported | None; counts may differ if SaaS rules change. |
| Local UI filters/sort state | None | Do not import. | Not imported | None. |
| Local tutorial/sample data | Normal records only if user imports it intentionally | Preserve as imported records with tutorial/source flags. | Requires user review | Warn that sample metadata is not real file content. |

## Identity And Tenancy

| Source local entity/field | Target SaaS table/field | Transformation rule | Mapping status | Import warning conditions | Open questions |
| --- | --- | --- | --- | --- | --- |
| No local user | `users` | Use authenticated importing user. | Inferred | None. | None. |
| No local workspace | `workspaces` | Import into selected or newly created workspace. | Inferred | Warn before importing into workspace with existing records. | Should imports create a new workspace by default? |
| No local membership | `workspace_memberships` | Create owner membership for importing user if new workspace. | Inferred | None. | How should invited users see imported history? |

## Vendors

| Source local entity/field | Target SaaS table/field | Transformation rule | Mapping status | Import warning conditions | Open questions |
| --- | --- | --- | --- | --- | --- |
| `vendors[].id` | `vendors.legacy_source.legacy_id`, `import_records.source_id` | Preserve metadata; generate SaaS UUID. | Lossless for metadata | Duplicate source ids reject or require import policy. | None. |
| `vendors[].name` | `vendors.name` | Preserve cleaned string. | Lossless | Warn if blank after cleaning; skip if unusable. | None. |
| `vendors[].category` | `vendors.category` | Preserve local category string. | Lossless | Warn if unknown to SaaS category list. | Should vendor category stay aligned to expense categories? |
| `vendors[].contactName` | `vendors.contact_name` | Preserve cleaned string. | Lossless | None. | None. |
| `vendors[].phone` | `vendors.phone` | Preserve cleaned string. | Lossless | None. | Should phone normalization happen later? |
| `vendors[].email` | `vendors.email` | Preserve cleaned string. | Lossless | Warn if invalid email format but keep raw value if product allows. | Should invalid emails be stored as notes/raw metadata instead? |
| `vendors[].website` | `vendors.website` | Preserve cleaned string. | Lossless | Warn if invalid URL but keep as text if product allows. | Should URL validation be strict? |
| `vendors[].notes` | `vendors.notes` | Preserve cleaned string. | Lossless | Sensitive. | None. |
| `vendors[].status` | `vendors.status`, `vendors.archived_at` | Map `active`/`archived`; `archived_at` unknown for imported archived vendors. | Lossy | Warn only if unknown status. | Should imported archived records get import timestamp as `archived_at`? |
| Inferred vendor from project contractor/payee | `vendors.source_confidence`, `vendors.legacy_source` | Store `source_confidence = 'inferred'`; preserve raw name. | Inferred | Warn if inferred vendor collides by normalized name. | Should import create inferred vendors or leave raw names only? |

## Properties

| Source local entity/field | Target SaaS table/field | Transformation rule | Mapping status | Import warning conditions | Open questions |
| --- | --- | --- | --- | --- | --- |
| `properties[].id` | `properties.legacy_source.legacy_id`, `import_records.source_id` | Preserve metadata; generate UUID. | Lossless for metadata | Duplicate ids reject or require import policy. | None. |
| `properties[].name` | `properties.name` | Preserve cleaned string. | Lossless | Warn/skip if blank. | None. |
| `properties[].address` | `properties.display_address` | Preserve free-form address exactly after local cleaning. Do not parse. | Lossless for display text | Warn if user expects structured address fields. | Should structured address fields exist later? |
| `properties[].purchaseDate` | `properties.purchase_date` | Parse ISO `YYYY-MM-DD` to `date`; blank remains null. | Lossless if valid | Warn if blank. Local invalid dates sanitize to blank before backup. | None. |
| `properties[].purchasePrice` | `properties.purchase_price_cents` | Convert number to cents with rounding. | Lossy | Warn currency assumed USD; warn if zero may represent missing/invalid. | Should users confirm currency per workspace? |
| No local currency | `properties.currency_code` | Default `USD`. | Inferred | Always include import note. | Multi-currency support scope? |
| `properties[].notes` | `properties.notes` | Preserve cleaned string. | Lossless | Sensitive. | None. |
| `properties[].isPrimary` | `properties.is_primary` | Preserve boolean. Local sanitize keeps one primary. | Lossless | Warn if source had conflicts before sanitization is unknown. | None. |

## Projects

| Source local entity/field | Target SaaS table/field | Transformation rule | Mapping status | Import warning conditions | Open questions |
| --- | --- | --- | --- | --- | --- |
| `projects[].id` | `projects.legacy_source.legacy_id`, `import_records.source_id` | Preserve metadata; generate UUID. | Lossless for metadata | Duplicate ids reject or require import policy. | None. |
| `projects[].propertyId` | `projects.property_id` | Resolve through imported property id map. | Lossless if source relationship valid | Reject or warn if missing property; local backup validation should catch. | None. |
| `projects[].vendorId` | `projects.vendor_id` | Resolve through imported vendor id map. | Lossless if source vendor exists | Warn if unresolved and contractor name exists. | Should unresolved vendor ids create review tasks? |
| `projects[].name` | `projects.name` | Preserve cleaned string. | Lossless | Warn/skip if blank. | None. |
| `projects[].category` | `projects.category` | Preserve local category string. | Lossless | Warn if unknown to SaaS category list. | Should SaaS category list be editable? |
| `projects[].status` | `projects.status` | Map `in progress` to `in_progress`; other values preserve normalized equivalents. | Lossless by enum mapping | Warn if unknown. | None. |
| `projects[].startDate` | `projects.start_date` | Parse ISO date; blank remains null. | Lossless if valid | Warn if missing only through recomputed follow-up, not import error. | None. |
| `projects[].completionDate` | `projects.completion_date` | Parse ISO date; blank remains null. | Lossless if valid | Warn through recomputed follow-up if completed/archived and missing. | None. |
| `projects[].contractor` | `projects.contractor_name_raw` | Preserve raw contractor text. | Lossless | Warn if conflicts with linked vendor name. | Should UI show raw contractor when vendor link exists? |
| `projects[].permitNumber` | `projects.permit_number` | Preserve cleaned string. | Lossless | None. | None. |
| `projects[].scopeSummary` | `projects.scope_summary` | Preserve cleaned string. | Lossless | Sensitive. | None. |
| `projects[].notes` | `projects.notes` | Preserve cleaned string. | Lossless | Sensitive. | None. |
| `projects[].completenessOverrideNote` | `projects.completeness_override_note` | Preserve note. Set `legacy_source.completeness_override_imported = true`. | Lossless | Warn that this can suppress project follow-ups. | Should override continue suppressing child issues? |
| No local override timestamp | `projects.completeness_overridden_at` | Leave null or set import timestamp with marker. Recommended: null. | Lossy | None. | Should import timestamp be used for audit clarity? |

## Expenses

| Source local entity/field | Target SaaS table/field | Transformation rule | Mapping status | Import warning conditions | Open questions |
| --- | --- | --- | --- | --- | --- |
| `expenses[].id` | `expenses.legacy_source.legacy_id`, `import_records.source_id` | Preserve metadata; generate UUID. | Lossless for metadata | Duplicate ids reject or require import policy. | None. |
| `expenses[].propertyId` | `expenses.property_id` | Resolve through imported property id map. | Lossless if valid | Reject/warn if missing. | None. |
| `expenses[].projectId` | `expenses.project_id` | Resolve through imported project id map; blank remains null. | Lossless if valid | Warn if source project missing. | None. |
| `expenses[].vendorId` | `expenses.vendor_id` | Resolve through imported vendor id map. | Lossless if valid | Warn if unresolved. | None. |
| `expenses[].vendor` | `expenses.vendor_name_raw` | Preserve raw payee/vendor text. | Lossless | Warn if conflicts with linked vendor name. | Should raw vendor be searchable independently? |
| `expenses[].date` | `expenses.expense_date` | Parse ISO date; blank remains null. | Lossless if valid | Warn if blank only if product requires date. | Should SaaS require expense date for new records? |
| `expenses[].description` | `expenses.description` | Preserve cleaned string. | Lossless | Warn/skip if blank. | None. |
| `expenses[].amount` | `expenses.amount_cents` | Convert number to cents with rounding. | Lossy | Warn currency assumed USD; warn if zero may be missing/invalid. | Should import preserve original numeric string if available? |
| No local currency | `expenses.currency_code` | Default `USD`. | Inferred | Always include import note. | Workspace-level currency? |
| `expenses[].classification` | `expenses.record_treatment` | Map to neutral SaaS enum: `possible_improvement`, `repair_upkeep`, `review_later`. | Lossy by rename | Warn if unknown. | Should stored enum names avoid legacy wording entirely? |
| `expenses[].classification` | `expenses.legacy_classification`, `legacy_source.raw.classification` | Preserve raw source string. | Lossless | None. | None. |
| `expenses[].category` | `expenses.category` | Preserve local category string. | Lossless | Warn if unknown category. | None. |
| `expenses[].documentationStatus` | `expenses.documentation_status` | Map spaces/hyphen to SaaS enum: `receipt_attached`, `invoice_attached`, `no_document_yet`, `needs_follow_up`. | Lossless by enum mapping | Warn if unknown. | Should this field be derived from documents in SaaS? |
| `expenses[].notes` | `expenses.notes` | Preserve cleaned string. | Lossless | Sensitive. | None. |

## Documents

| Source local entity/field | Target SaaS table/field | Transformation rule | Mapping status | Import warning conditions | Open questions |
| --- | --- | --- | --- | --- | --- |
| `documents[].id` | `documents.legacy_source.legacy_id`, `import_records.source_id` | Preserve metadata; generate UUID. | Lossless for metadata | Duplicate ids reject or require import policy. | None. |
| `documents[].propertyId` | `documents.property_id` | Resolve through imported property id map. If linked expense exists, prefer expense-derived property. | Lossless if valid | Warn if source conflicts with linked expense. | None. |
| `documents[].projectId` | `documents.project_id` | Resolve through imported project id map. If linked expense exists, prefer expense-derived project. | Lossless if valid | Warn if source conflicts with linked expense. | None. |
| `documents[].expenseId` | `documents.expense_id` | Resolve through imported expense id map. Blank remains null. | Lossless if valid | Warn if missing linked expense. | None. |
| `documents[].displayName` | `documents.display_name` | Preserve cleaned string. | Lossless | Warn/skip if blank. | None. |
| `documents[].documentType` | `documents.document_type` | Preserve normalized document type. Suggested mapping: spaces stay text or normalize to snake case consistently. | Lossless by enum mapping | Warn if unknown. | Should target use snake case or display strings? |
| `documents[].addedDate` | `documents.document_date` | Parse ISO date; blank remains null. | Lossless if valid | Warn if blank and UI requires date for new records. | None. |
| `documents[].notes` | `documents.notes` | Preserve cleaned string. | Lossless | Sensitive. | None. |
| `documents[].ocrText` | `document_ocr.text` | If nonblank, create OCR row with `status = 'succeeded'`, `engine = 'legacy_import'`. | Lossless for text | Sensitive; warn user OCR text is imported. | Should user be able to opt out of OCR text import? |
| Blank `documents[].ocrText` | `document_ocr.status` | Create `not_requested` row or no row. Recommended: create row only if needed. | Inferred | None. | Should every document have a row? |
| `documents[].hasFile` | `documents.file_availability` | Do not map as boolean. Determine from file payload/import outcome. | Inferred | Warn for missing/stale/tutorial file metadata. | None. |
| `documents[].fileId` | `document_files.legacy_source.legacy_file_id`, `import_files.source_file_id` | Preserve metadata only. | Lossless for metadata | Warn if no matching file payload. | None. |
| `documents[].fileName` | `documents.legacy_source.raw.fileName`, `document_files.original_file_name` when imported | Preserve as metadata; use on file row if payload imports. | Lossless if imported | Warn if path-like data was scrubbed. | None. |
| `documents[].fileStatusNote` | `documents.file_status_note` | Preserve note. | Lossless | None. | Should status notes be user-editable? |
| `documents[].mimeType` | `document_files.mime_type` when imported; `legacy_source.raw.mimeType` always | Preserve metadata. | Lossless if imported | Warn if blocked/unknown MIME. | None. |
| `documents[].fileSize` | `document_files.size_bytes` when imported; `legacy_source.raw.fileSize` always | Preserve metadata. | Lossless if imported | Warn if over SaaS limit or inconsistent with payload. | None. |
| `documents[].fileLastModified` | `document_files.legacy_source.fileLastModified` | Preserve metadata. | Lossless | None. | None. |
| `documents[].fileStoredAt` | `document_files.uploaded_at` or `legacy_source.fileStoredAt` | Use as source stored timestamp if valid, otherwise import timestamp. | Lossy | Warn if invalid. | Should imported files show original stored date or import date? |

## Backup File Payloads

| Source local entity/field | Target SaaS table/field | Transformation rule | Mapping status | Import warning conditions | Open questions |
| --- | --- | --- | --- | --- | --- |
| `files[].documentId` | `import_files.source_document_id`, `document_files.document_id` | Resolve to SaaS document id. | Lossless if valid | Warn/reject if no document match. | None. |
| `files[].fileId` | `import_files.source_file_id`, `document_files.legacy_source.legacy_file_id` | Preserve metadata only. | Lossless for metadata | Warn if duplicate. | None. |
| `files[].fileName` | `document_files.original_file_name` | Use safe filename. | Lossless after local safe-name cleanup | Warn if blank and fallback used. | None. |
| `files[].mimeType` | `document_files.mime_type` | Preserve or default to `application/octet-stream`. | Lossless if present | Warn if blocked/unknown. | None. |
| `files[].fileSize` | `document_files.size_bytes` | Preserve decoded blob size, verify against metadata. | Lossy if mismatch | Warn if mismatch or over limit. | Should metadata or decoded size win? |
| `files[].sha256` | `document_files.sha256`, `import_files.source_sha256` | Preserve hash when valid. | Lossless | Warn if blank or mismatch. | Should blank checksum require confirmation? |
| `files[].dataUrl` | Object storage bytes | Decode, validate, upload to object storage; do not retain data URL. | Lossy by storage transformation | Warn if invalid/corrupt/too large. | Temporary retention policy for failed imports? |
| `missingFiles[]` | `import_files` row, `documents.file_availability` | Create missing/skipped outcome; preserve reason. | Lossless for reason | Warn user file content was not imported. | None. |
| Blocked extension/MIME | `import_files.status = 'blocked'`, `documents.file_availability = 'blocked'` | Do not upload bytes. | Lossy by intentional block | Warn with filename/status. | Should SaaS blocked list match local exactly? |
| Checksum mismatch | `import_files.status = 'checksum_failed'`, `documents.file_availability = 'checksum_failed'` | Do not upload bytes unless future policy allows. | Lossy by intentional block | Warn user. | Should user be able to override? |

## Follow-up Overrides

| Source local entity/field | Target SaaS table/field | Transformation rule | Mapping status | Import warning conditions | Open questions |
| --- | --- | --- | --- | --- | --- |
| `followUpOverrides[].id` | `follow_up_overrides.source_follow_up_id`, `legacy_source.legacy_id` | Preserve deterministic source id. | Lossless | Warn if source id cannot be matched to a current/generated rule. | None. |
| `followUpOverrides[].label` | `follow_up_overrides.label_snapshot` | Preserve snapshot. | Lossless | None. | None. |
| `followUpOverrides[].typeLabel` | `legacy_source.typeLabel` | Preserve metadata. | Lossless | None. | Should target have a separate type label snapshot? |
| `followUpOverrides[].detail` | `follow_up_overrides.detail_snapshot` | Preserve snapshot. | Lossless | Sensitive. | None. |
| `followUpOverrides[].propertyId` | `follow_up_overrides.property_id` | Resolve through import map. | Lossless if valid | Warn if unresolved. | None. |
| `followUpOverrides[].projectId` | `follow_up_overrides.project_id` | Resolve through import map. | Lossless if valid | Warn if unresolved. | None. |
| `followUpOverrides[].expenseId` | `follow_up_overrides.expense_id` | Resolve through import map. | Lossless if valid | Warn if unresolved. | None. |
| `followUpOverrides[].documentId` | `follow_up_overrides.document_id` | Resolve through import map. | Lossless if valid | Warn if unresolved. | None. |
| `followUpOverrides[].note` | `follow_up_overrides.note` | Preserve cleaned string. | Lossless | Sensitive. | None. |
| `followUpOverrides[].completedAt` | `follow_up_overrides.completed_at` | Parse timestamp if valid; use import timestamp only with warning if missing and product requires value. | Lossy if invalid/missing | Warn if invalid. | Should missing completedAt be allowed? |
| Derived local follow-up type | `follow_up_overrides.follow_up_type` | Parse from source id/rule match where possible; otherwise mark `unknown_legacy_follow_up`. | Inferred | Warn if not matched. | How strict should override matching be? |

## Project Completeness Override

| Source local entity/field | Target SaaS table/field | Transformation rule | Mapping status | Import warning conditions | Open questions |
| --- | --- | --- | --- | --- | --- |
| `projects[].completenessOverrideNote` | `projects.completeness_override_note` | Preserve note. | Lossless | Warn that project was marked complete by note. | Should this suppress child follow-ups in SaaS? |
| No local completed timestamp | `projects.completeness_overridden_at` | Leave null or import timestamp. Recommended: null plus legacy metadata. | Lossy | None. | Should users see imported override date as unknown? |

## Activity Events

| Source local entity/field | Target SaaS table/field | Transformation rule | Mapping status | Import warning conditions | Open questions |
| --- | --- | --- | --- | --- | --- |
| No persisted local activity | `activity_events` | Optionally synthesize import activity per batch and maybe per record. | Inferred | None. | How much synthetic history should be shown? |
| Backup `createdAt` | `activity_events.occurred_at` for import event | Use backup created time or import time depending on event type. | Inferred | Warn if missing/invalid. | Should recent activity show imported record dates or import date? |

## Exports

| Source local entity/field | Target SaaS table/field | Transformation rule | Mapping status | Import warning conditions | Open questions |
| --- | --- | --- | --- | --- | --- |
| Local CSV/PDF export behavior | `exports` | Do not import previous local exports unless user uploads them as documents. | Not imported | None. | Should cloud import accept old exported CSV/PDF as files? |
| Current export framing | Export generation code/copy | Preserve review packet framing and spreadsheet formula neutralization. | Design preservation | None. | None. |

## Notifications And Reminders

| Source local entity/field | Target SaaS table/field | Transformation rule | Mapping status | Import warning conditions | Open questions |
| --- | --- | --- | --- | --- | --- |
| Generated follow-ups | `reminders` | Do not import as reminders by default. Recompute as follow-ups. | Not imported | None. | Should users be able to turn a follow-up into a reminder? |
| No local notifications | `notifications` | No import. | Not imported | None. | Which events should create default notifications? |

## Subscriptions And Entitlements

| Source local entity/field | Target SaaS table/field | Transformation rule | Mapping status | Import warning conditions | Open questions |
| --- | --- | --- | --- | --- | --- |
| No local subscription | `subscriptions` | No import. Subscription starts through SaaS billing. | Not imported | None. | Billing provider and ownership model. |
| Local limits | `workspace_entitlements` | Use as product input only. Do not automatically import as entitlements. | Not imported | None. | SaaS plan limits. |

## Relationship Mapping

| Local relationship | SaaS relationship | Transformation rule | Mapping status | Warning conditions |
| --- | --- | --- | --- | --- |
| Project -> property | `projects.property_id` | Resolve local `propertyId` through import map. | Lossless if valid | Missing target property. |
| Project -> vendor | `projects.vendor_id` | Resolve local `vendorId`; preserve `contractor_name_raw`. | Lossless plus raw preservation | Missing vendor id or conflicting contractor text. |
| Expense -> property | `expenses.property_id` | Resolve local `propertyId`. | Lossless if valid | Missing target property. |
| Expense -> project | `expenses.project_id` | Resolve local `projectId`; allow null. | Lossless if valid | Project belongs to different property or missing. |
| Expense -> vendor | `expenses.vendor_id` | Resolve local `vendorId`; preserve `vendor_name_raw`. | Lossless plus raw preservation | Missing vendor id or conflicting vendor text. |
| Document -> expense | `documents.expense_id` | Resolve local `expenseId`; if present, derive property/project from expense. | Lossless if valid | Source document context conflicts with expense. |
| Document -> project | `documents.project_id` | Resolve local `projectId` when no expense-derived conflict. | Lossless if valid | Missing project or wrong property. |
| Document -> property | `documents.property_id` | Resolve local `propertyId`; if expense linked, prefer expense property. | Lossless if valid | Missing property or conflict. |
| Document -> file | `document_files.document_id` | Create only when payload imports successfully. | Inferred | Missing, blocked, corrupt, too large, checksum failed. |
| Override -> source records | `follow_up_overrides.*_id` | Resolve through import map. | Lossless if valid | Missing source record. |

## Import Warning Conditions

Importer should collect structured warnings for:

- Backup version unsupported or newer than importer.
- Duplicate legacy ids.
- Missing/broken relationships.
- Address preserved as display text only.
- Currency defaulted to `USD`.
- Amount rounded to cents.
- Zero amount or zero purchase price.
- Unknown enum/category/status/document type.
- Vendor inferred from raw name.
- Vendor raw name conflicts with linked vendor.
- Project completeness override imported.
- Follow-up override cannot be matched to a SaaS rule/context.
- Document says it had a file but file payload is missing.
- File payload blocked by extension/MIME.
- File payload exceeds SaaS limit.
- File checksum missing or mismatched.
- File data URL invalid/corrupt.
- OCR text imported as legacy text.
- Tutorial/sample file metadata detected.
- Repeated import of same backup or same source ids.

## Resolved Ambiguities From Migration Risks

| Risk | Mapping decision |
| --- | --- |
| Money stored as floats | Convert to integer cents; preserve source amount metadata where useful. |
| Currency missing | Default to `USD` with import warning. |
| Dates lack timezone | Store date-only fields as `date`; activity/import timestamps as `timestamptz`. |
| Free-form address | Preserve as `display_address`; do not parse. |
| Vendor normalization uncertain | Preserve raw vendor/contractor names; do not auto-merge by normalized name. |
| Legacy ids embedded in relationships | Use import maps and `legacy_source`; generate UUIDs. |
| File ids local-only | Preserve in metadata only; generate object storage keys server-side. |
| `hasFile` ambiguous | Map to `file_availability` and `import_files.status`. |
| OCR state missing | Import text as legacy OCR result; otherwise leave status not requested/skipped. |
| Follow-ups generated | Recompute after import. |
| Follow-up overrides id-bound | Preserve source id and match by source record/type context. |
| Restore is replace-only | SaaS import is batch-based and should not replace workspace unless explicitly built. |

## Deferred Or Open Questions

- Should imports always create a new workspace by default?
- Should imported backups with blank file checksums require explicit confirmation?
- Should cloud file size limit match the local 25 MB limit?
- Should unknown local categories become `other` or remain custom strings?
- Should `documentation_status` eventually become derived from linked documents/files?
- Should `completeness_override_note` continue suppressing child expense/document follow-ups?
- Should follow-up overrides be invalidated when source records change?
- Should imported OCR text be optional?
- Should the importer keep raw source record snapshots, and for how long?
- Should repeated imports be idempotent by backup identity, by legacy ids, or by user choice?

