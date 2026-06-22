# Deferred Scope

This document records meaningful features intentionally deferred from the Home Ledger web MVP. Deferred means not launch-critical, not forgotten.

## Deferral Rules

- MVP proves the paid workflow first.
- Do not turn architecture possibilities into MVP requirements.
- Bring a deferred item into scope only when it directly improves activation, retention, conversion, trust, or migration for the first target user.
- Avoid adding features that create tax/legal/accounting conclusions.

## Deferred Features

### iOS App

What is deferred: Native iOS capture/review companion.

Why deferred: The web MVP must prove the core paid workflow first.

Dependency first: Stable web API, auth/session model, file upload intent API, workspace selection.

Trigger to bring in: Users are successfully using web workflow and request mobile capture.

Risk if too early: Duplicates product surface area, complicates auth/offline/upload behavior, slows web launch.

### Household Sharing

What is deferred: Multi-member household collaboration, invites, shared editing.

Why deferred: First user can operate a single-owner workspace.

Dependency first: Workspace authorization, membership model, audit events, role decisions.

Trigger to bring in: Paid users need spouse/partner/assistant access.

Risk if too early: Permission complexity, support burden, deletion/ownership edge cases.

### Professional Reviewer Portal

What is deferred: External reviewer accounts, portal access, scoped record sharing.

Why deferred: Exported review packets/CSVs prove handoff value first.

Dependency first: Exports, audit events, access grants design, support/privacy policy.

Trigger to bring in: Users repeatedly ask to invite a reviewer instead of exporting.

Risk if too early: Creates compliance, access, audit, and product-boundary complexity.

### Public Share Links

What is deferred: Public or semi-public links to documents, exports, projects.

Why deferred: Sensitive records should stay private in MVP.

Dependency first: Strong file authorization, expiring links, audit events, revocation.

Trigger to bring in: Review workflow needs controlled sharing beyond downloads.

Risk if too early: Accidental disclosure of documents, addresses, expense amounts, OCR text.

### Advanced AI Extraction

What is deferred: Automatic extraction of vendor, date, amount, category, project, or record treatment.

Why deferred: Manual entry plus upload/follow-up proves the product without AI risk.

Dependency first: Reliable document storage, OCR pipeline, review UI, privacy posture.

Trigger to bring in: Users hit clear data-entry friction after core workflow works.

Risk if too early: Incorrect fields, trust loss, accidental professional-sounding conclusions, scope creep.

### Automatic Vendor/Date/Amount Extraction

What is deferred: Receipt/invoice field extraction.

Why deferred: This is a subset of advanced AI/OCR behavior and not needed for the first paid workflow.

Dependency first: OCR status/text, user review/confirmation UI.

Trigger to bring in: Upload volume makes manual entry the top activation blocker.

Risk if too early: Incorrect expense data and harder validation/debugging.

### Advanced OCR Search

What is deferred: Full-text OCR search across documents.

Why deferred: OCR text is sensitive and search indexing needs privacy/performance review.

Dependency first: OCR text storage, retention rules, search index design, access auditing.

Trigger to bring in: Users have enough documents that finding text inside files becomes frequent.

Risk if too early: Sensitive text exposure, indexing complexity, slower MVP.

### Warranty Reminder System

What is deferred: Reminder calendar, warranty alerts, maintenance reminders.

Why deferred: The MVP is record organization and export, not home maintenance scheduling.

Dependency first: Stable document/project model, notifications, reminder table, user preferences.

Trigger to bring in: Users store warranties and ask for reminder workflows.

Risk if too early: Product becomes a task/reminder app and distracts from review workflow.

### Landlord/Pro Tier

What is deferred: Multi-property landlord or professional plan features.

Why deferred: First user is a homeowner, not a property manager.

Dependency first: Proven single/small-property workflow, billing model, scalable workspace limits.

Trigger to bring in: Demand from users managing many properties.

Risk if too early: Overbuilds filters, permissions, billing, reporting, and support.

### Multi-workspace Management UI

What is deferred: Rich workspace switching, multiple workspace admin, cross-workspace search.

Why deferred: MVP can use one workspace per user while preserving workspace foundation.

Dependency first: Workspace authorization and membership model.

Trigger to bring in: Users need separate households/properties or business/personal separation.

Risk if too early: Navigation complexity before core workflow is proven.

### Admin/Support Console

What is deferred: Internal support/admin console.

Why deferred: MVP needs audit-ready support-sensitive access policy, not a full console.

Dependency first: Audit events, support access policy, operational runbooks.

Trigger to bring in: Support volume requires tooling.

Risk if too early: Sensitive access risk and internal tooling distraction.

### Advanced Billing Plan Matrix

What is deferred: Multiple tiers, coupons, promotional plans, granular feature matrices.

Why deferred: One paid plan plus trial/free state is enough to test pricing.

Dependency first: Billing provider decision, entitlement skeleton, usage metering.

Trigger to bring in: Pricing experiments or user segmentation require it.

Risk if too early: Billing complexity before value is proven.

### Native Mobile Parity

What is deferred: Replicating all web features in mobile.

Why deferred: iOS should begin as capture/review companion later, not full parity.

Dependency first: Stable web API and workflows.

Trigger to bring in: Mobile users need repeated full workflow access.

Risk if too early: Doubles frontend scope and slows web product.

### Email Forwarding/Import

What is deferred: Forward receipts/invoices by email.

Why deferred: Upload from web is enough for MVP.

Dependency first: Document ingestion pipeline, spam/security controls, parsing/review UI.

Trigger to bring in: Users regularly receive records by email and ask for forwarding.

Risk if too early: Security, deliverability, parsing, and support complexity.

### Bank/Card Integrations

What is deferred: Financial account connections and transaction import.

Why deferred: Manual expense entry is sufficient to prove the record workflow.

Dependency first: Vendor/category review UI, duplicate handling, integration provider, security review.

Trigger to bring in: Users need high-volume transaction import.

Risk if too early: Compliance/security burden, incorrect imports, product shifts toward finance app.

### Tax/Legal/Accounting Conclusions

What is deferred: Any feature that makes professional, compliance, or accounting determinations for the user.

Why deferred: Product boundary is organizing records for professional review.

Dependency first: None; this should remain out unless product/legal direction changes.

Trigger to bring in: Explicit legal/product decision and reviewed professional guidance.

Risk if too early: User harm, legal/compliance exposure, breaks product boundary.

### Reviewer Delivery Workflow

What is deferred: Sending exports directly to a professional from the app.

Why deferred: Downloaded CSV/review packet is enough for MVP.

Dependency first: Reviewer identity/access model, export audit events, revocation policy.

Trigger to bring in: Users ask to send records repeatedly and exports prove value.

Risk if too early: Access control and support complexity.

### Document Archive Bundle

What is deferred: Exporting all document files as a zip/archive.

Why deferred: Review packet and CSV can launch first.

Dependency first: File storage, export storage, background jobs, size limits, download expiration.

Trigger to bring in: Users need full portability beyond metadata export.

Risk if too early: Large file handling, timeouts, storage cost, privacy exposure.

### Notifications And Reminders

What is deferred: Email/push notifications for follow-ups, exports, import completion, reminders.

Why deferred: MVP can rely on in-app status.

Dependency first: Notification preferences, delivery provider, privacy-safe copy.

Trigger to bring in: Async jobs and retention workflows need user notification.

Risk if too early: Sensitive data leaks through email/push and extra infrastructure.

### Offline Capture

What is deferred: Offline web/iOS capture and later sync.

Why deferred: Requires conflict resolution and durable local queues.

Dependency first: Stable API, idempotency keys, upload retry design.

Trigger to bring in: Mobile capture becomes priority and users need offline support.

Risk if too early: Sync bugs, duplicate records, file upload complexity.

### Saved Filter Views

What is deferred: User-saved grids/filter presets.

Why deferred: Dynamic filters and compact grids are enough for MVP.

Dependency first: Stable filter model and high repeated usage.

Trigger to bring in: Users repeatedly use the same complex filters.

Risk if too early: Extra UI and persistence before filter needs are clear.

### Webhooks

What is deferred: External integrations/webhooks.

Why deferred: No integration surface is needed for first paid workflow.

Dependency first: Stable event model, auth, secrets, retry policy.

Trigger to bring in: Partner/integration demand.

Risk if too early: Security and support burden.

### Advanced Activity/Audit Viewer

What is deferred: User-facing full audit log viewer.

Why deferred: Recent activity is enough for the dashboard; audit can be internal/logged first.

Dependency first: Audit event table, retention policy, privacy review.

Trigger to bring in: Users need to inspect access/download history.

Risk if too early: Exposes internal details and adds UI complexity.

## Architecture/API/Schema Items Not MVP

The following appear in architecture/API/schema docs but should not be treated as MVP requirements:

- `workspace_invitations`, unless sharing is included.
- `reviewer_access_grants`.
- `saved_filter_views`.
- `webhook_events`.
- `billing_events` beyond minimal provider status.
- Full `notifications` and `reminders` workflows.
- OCR full-text search index.
- Multiple active document files.
- Document archive export.
- Replace-workspace import mode.
- Advanced duplicate import merge.
- Support/admin console UI.

## Later V1 Candidates

- iOS capture companion.
- Import confirm if beta did not require it at MVP.
- OCR manual read and limited search if not included at MVP.
- Document archive export.
- Basic member sharing.
- Billing portal integration if placeholder launched first.
- Notifications for export/import completion.

## Later V2 Candidates

- Reviewer portal.
- AI extraction with user confirmation.
- Bank/card integrations.
- Email forwarding/import.
- Landlord/pro tier.
- Offline mobile capture.
- Public share links with strong access controls.
