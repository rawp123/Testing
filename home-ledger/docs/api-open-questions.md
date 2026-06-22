# API Open Questions

This document lists decisions needed before implementing the Home Ledger SaaS API contract in `docs/api-contract.md`.

## Decisions Required Before Implementation

### Auth And Session

- Which auth provider will issue user identity to the API?
- Will the API use cookies, bearer tokens, or both?
- What is the session lifetime and refresh model for web?
- What is the token/session model for iOS?
- How will account email changes be handled?
- Does the API need device/session management endpoints for MVP?

### Workspace And Membership

- Will MVP support multiple users per workspace, or should sharing be deferred?
- Should MVP include `admin`, or should the contract reserve `admin` while the first build ships owner/editor/viewer only?
- Can viewers export data and download files by default, or must owners enable that?
- Can editors delete/archive records, or should destructive actions be owner-only?
- What happens if the workspace owner leaves or deletes their account?
- Should workspace archive block all writes or only hide the workspace from normal lists?

### Import

- Should imported backups create a new workspace by default?
- What duplicate strategy is safest for repeated imports: block, skip existing legacy ids, new copy, or guided merge?
- Should blank file checksums be accepted by default?
- Should users be able to override checksum failures?
- How long should raw uploaded backup files be retained after import?
- Should imported OCR text be optional?
- Should import preserve raw source record snapshots, and if yes, for how long?
- Should tutorial/sample backups be blocked, allowed with warnings, or imported normally?

### Files And Storage

- What is the SaaS max file size? Match the local 25 MB limit or choose a new plan-based limit?
- Which object storage provider will be used?
- Which malware/file scanning provider will be used, if any?
- Are downloads blocked until scan passes?
- What file types are blocked in SaaS, and should the list exactly match local backup restore rules?
- Can a document have multiple active files later, or exactly one for MVP?
- How long do signed upload/download/preview URLs last?

### OCR

- Is OCR included in MVP or gated behind entitlement?
- Which OCR engine/provider will be used?
- Is OCR run automatically after upload or only on user request?
- Is OCR search part of MVP or later?
- Should users be able to opt out of OCR text import and processing?
- What retention/deletion rule applies to OCR text?

### Follow-ups

- Should project `completeness_override_note` continue suppressing child expense/document follow-ups?
- Should item-level overrides be invalidated when linked records materially change?
- Can users override a follow-up that is no longer currently generated?
- Should follow-up rules be versioned so imported overrides can be matched across future rule changes?
- Should generated follow-up responses be cached or always recomputed?

### Exports

- What is the default expiration period for generated exports?
- Can viewers request exports?
- Can exports include OCR text?
- Should full data export include attached file bytes or only metadata plus document archive later?
- What export formats are MVP: expenses CSV, review packet PDF, full JSON, document archive?

### Billing And Entitlements

- Which billing provider will be used?
- Are subscriptions attached to users or workspaces?
- How do iOS purchases interact with web subscriptions?
- What are MVP plan limits for storage, files, properties, OCR, imports, and exports?
- What happens to uploads and OCR when a workspace is over limit?

### Account And Deletion

- What is the retention window after account deletion request?
- What audit data remains after account/workspace deletion?
- Can users cancel deletion during a grace period?
- How are active subscriptions canceled during deletion?
- Does workspace deletion require prior full data export prompt?

## Decisions That Can Safely Be Deferred

- Reviewer portal or external professional access.
- AI extraction, automatic categorization, or document field parsing.
- Advanced household/member permission groups beyond owner/editor/viewer.
- Vendor merge suggestions and contact normalization.
- Structured address parsing and validation.
- OCR full-text search, if OCR status/read is available first.
- Multiple active files per document.
- Saved filter views.
- Webhooks and advanced billing event history.
- Push notifications beyond basic iOS upload/status needs.
- Document archive export if review packet and full data export are available first.

## Risks That Affect Database Schema

- If subscriptions are user-owned instead of workspace-owned, `subscriptions.workspace_id` may need to become nullable or move to an account billing table.
- If reviewer portals arrive soon, access grants may require `reviewer_access_grants`, scoped document/project permissions, and separate audit rules.
- If documents can have multiple active files, the unique active file constraint on `document_files` should not be created.
- If OCR search is MVP, `document_ocr.text` needs full-text indexing and privacy review before migration.
- If follow-up rules need versioning, `follow_up_overrides` should include `rule_version` from the start.
- If import raw snapshots are retained long term, `import_records.raw_snapshot` becomes a sensitive storage burden and needs retention controls.
- If `documentation_status` becomes fully derived, the `expenses.documentation_status` column may become a cached field or should be removed before implementation.
- If workspace deletion hard-deletes quickly, audit/activity retention tables need redaction fields and deletion state.

## Risks That Affect Frontend MVP Scope

- Dynamic dependent filters require `filter-options` endpoints per grid; omitting them would regress the compact grid UX.
- Project-centered follow-up modals need follow-up action payloads that identify the target modal/workflow without tab jumps.
- Import preview must show warnings clearly before confirm; a minimal upload-only flow is not enough.
- File upload needs clear status states: pending upload, available, blocked, missing, removed, scan pending, scan failed.
- OCR text read/search must be visibly distinct from document metadata to avoid exposing sensitive content accidentally.
- Export generation is asynchronous, so the UI needs queued/processing/ready/failed states.
- Conflict handling needs UI copy for stale records if `If-Match`/`updated_at` is used.
- Viewer/export permissions affect which actions appear in grids and modals.

## Risks That Affect iOS Companion Scope

- iOS needs an auth/session model that can survive app restarts and handle workspace switching.
- Capture flow needs lightweight property/project/expense/vendor lookup endpoints.
- Direct upload intents must support mobile network retry and confirm behavior.
- iOS should not receive raw object storage keys.
- If scan status blocks previews/downloads, iOS needs clear pending/failed states.
- Offline capture is not covered by the contract yet; supporting it would require draft/sync conflict design.
- OCR queueing on upload may affect battery/data expectations and notification behavior.
- Account deletion, billing, and full import may be web-only for MVP with iOS status/read support.

## Security And Privacy Questions

- What exact actions require audit events?
- Can support staff access document files or OCR text, and what approval/audit flow is required?
- Should signed download URLs be single-use?
- Should file download and OCR read be rate-limited more strictly than normal metadata reads?
- Should exports require recent reauthentication?
- Should account deletion require recent reauthentication?
- What sensitive values are allowed in activity summaries and notifications?
- What fields are redacted from logs and error reports?

## API Compatibility Questions

- Should the API use JSON:API-style envelopes, simpler `data/meta` envelopes, or OpenAPI-generated shapes?
- Should all updates be `PATCH`, or should some actions use command endpoints such as `/archive` and `/restore`?
- Should enum values use snake case everywhere, even when local values used spaces?
- Should filter options return counts, labels, and disabled states, or only available options?
- Should list endpoints return `total_count` by default, or only when requested for performance?
- Should clients use `If-Match` headers, `expected_updated_at` body fields, or both?

## MVP Recommendation

Before implementation, decide these first:

1. Auth/session provider and token style.
2. Workspace sharing scope.
3. File size limit and scan policy.
4. Import duplicate strategy.
5. Whether blank checksums are accepted.
6. Whether OCR is automatic, manual, or entitlement-gated.
7. Export retention period.
8. Whether project completeness overrides suppress child issues.
9. Account/workspace deletion retention.
10. Billing ownership model.
