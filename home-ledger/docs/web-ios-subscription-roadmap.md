# Home Ledger Web + iOS Subscription Roadmap

## Executive Summary

Home Basis Tracker, also referred to here as Home Ledger, is a strong candidate for a web + iOS subscription product. The current local-first app has already solved a large part of the product problem: it knows the record types homeowners care about, has a coherent workflow model, uses compact grids, supports documents and OCR, generates follow-up items, and avoids many confusing navigation patterns. The strategic opportunity is to move the durable value from "a local app I bought once" to "a living home record system I keep current over years."

The recommended direction is:

1. Build the web app as the primary product and billing surface.
2. Build the iOS app as a capture, upload, review, and companion experience.
3. Keep the current desktop app as an offline prototype, migration source, and possibly a future local-first premium edition.
4. Preserve the current product model: properties, projects, expenses, documents, vendors, follow-ups, overrides, recent activity, exports, and review readiness.
5. Replace local-only storage with account-based cloud records, secure file storage, background OCR, audit history, reminders, and subscription entitlements.

The best MVP path is **web first, then iOS companion**. The web app should prove that users will pay for organized home records, document storage, follow-ups, and review exports. The iOS app should follow quickly because mobile capture is central to the product, but it should not delay the backend and web foundation.

## Current Product Position

### Current App

The current app is a local-first homeowner records binder. It stores structured records and document files locally, supports full backup and restore, and provides local OCR/text extraction for PDFs, images, and text files. It includes a Mac desktop shell and a browser version, but no accounts, cloud sync, billing, analytics, or hosted backend.

Major current areas:

- Dashboard
- Property tab
- Projects tab
- Expenses tab
- Documents tab
- Add/edit document and expense attachment flow
- Follow-up / Needs attention flows
- Project detail and issue-resolution modals
- Expense add/edit flow
- Export & backup
- Calculators
- Settings
- Tutorial workspace
- Dark/light mode
- Dynamic dependent filters
- Compact grid/table-style record views
- Local document upload, OCR, and preview behavior
- Project-centered follow-up resolution
- Recent activity dashboard subtab
- Needs attention dashboard subtab

### Current Data Model

The current canonical local model is in `backend/domain/model.js` and includes:

- `vendors`
- `properties`
- `projects`
- `expenses`
- `documents`
- `followUpOverrides`

Important constants and policies:

- App id: `home-basis-tracker`
- Product: `Home Basis Tracker`
- Backup version: `1`
- Maximum document file size: `25 MB`
- Maximum backup file size: `500 MB`
- Record count cap per type: `5000`
- Text field cap: `5000` characters
- Document file metadata is stored on document records, while file blobs are stored separately.
- Backup files can include attached files as data URLs.
- Restore validates relationships, duplicate ids, file payloads, blocked attachment types, and checksums.

### Current Architecture

Current layers:

- `frontend/`: single-page browser UI, app state, forms, grids, document preview, OCR, export, backup, restore.
- `backend/domain/`: local model rules, sanitization, validation, CSV export, backup envelope validation.
- `backend/storage/`: browser storage adapters and desktop bridge adapters.
- `desktop/`: Electron shell, desktop storage, package/sign/notarize path.
- `tests/`: Node tests for model, backup, tutorial, storage, and copy expectations.
- `docs/`: architecture, data safety, release, real-document QA, and usability prompts.

Current storage:

- Browser records: `localStorage`
- Browser files: IndexedDB
- Desktop records: app-managed `records.json`
- Desktop files: app-managed `documents/` folder
- Desktop attachment metadata: `attachments.json`

## Product Thesis

### Recommendation

Move Home Ledger toward a subscription web + iOS product.

This product is better suited to subscription than one-time purchase because the value is ongoing:

- Homeowners continuously add projects and expenses over years.
- Receipts, invoices, warranties, permits, and photos keep accumulating.
- Mobile upload is useful every time the user receives a receipt or walks a property.
- Follow-ups and reminders keep the record set complete.
- Search, filters, exports, and professional-review packets become more useful as the archive grows.
- Cloud backup and cross-device access are recurring services.
- Document storage and OCR carry ongoing infrastructure cost.

### Why Subscription Can Work

Subscription is justified if the product is framed as an active home records service, not a static calculator. The recurring value should be:

- Secure document storage.
- Searchable home improvement history.
- Mobile receipt/photo capture.
- Automatic follow-up reminders.
- Project and expense organization.
- Export packets for sale, refinance, insurance, estate planning, or tax-professional review.
- Cross-device access for household members.
- Backup and continuity over many years.

### What Should Remain Local Or Offline

Some local/offline elements are still valuable:

- Exportable backups for user trust and portability.
- Offline capture on iOS, queued for later sync.
- A desktop migration/import tool for users of the current app.
- Optional local-first edition later, if privacy becomes the core differentiator.

Do not make the entire future product local-only if the business goal is subscription. Local-only storage weakens recurring value unless the subscription is for sync, OCR, support, and multi-device access.

### What To Preserve

Preserve:

- Compact record grids.
- Dynamic dependent filters.
- Dashboard with Recent activity and Needs attention.
- Project-centered follow-ups.
- Specific missing-document wording.
- Focused modals/drawers instead of confusing page jumps.
- Mature utilitarian copy.
- Dark/light theme standards.
- Document upload and OCR expectations.
- Backup/export discipline.
- No tax/legal claims.

Redesign:

- Settings around account, billing, household, storage limits, and data controls.
- Export & backup around cloud account, migration, and downloadable archive.
- Onboarding around account setup and first property.
- Document flows around cloud file storage and mobile upload.

Remove or defer:

- Tutorial workspace as a main-tab production feature. Replace with sample/demo mode or onboarding checklist.
- Desktop-specific storage labels.
- Browser local-storage warnings in the primary product.
- Any copy that implies local-only storage once the cloud product exists.

## Target Users And Use Cases

### 1. Homeowners Preparing For Resale

Pain points:

- They cannot remember what was done over years.
- Receipts are scattered across email, paper, photo roll, contractor portals, and folders.
- They need a clean packet for an agent, buyer, accountant, or attorney.

Willingness to pay:

- Medium to high near sale.
- Lower years before sale unless the app creates ongoing utility.

Must-have workflows:

- Add property.
- Add projects and expenses.
- Upload receipts, invoices, permits, warranties, and before/after photos.
- Export a clean review packet.
- Search by vendor, date, room, category, or project.

Objections:

- "I only need this once when I sell."
- "I do not know what documents matter."
- "I do not want tax advice from an app."

Best subscription value proposition:

- "Keep your home improvement history ready before you need it."
- Annual plan with a strong export/report feature.
- Optional sale-prep month plan can capture urgent users without forcing a long commitment.

### 2. Homeowners Tracking Improvement Basis

Pain points:

- They know improvements may matter later but do not want to interpret tax rules.
- They need receipts and explanations in one place.
- They want to separate possible improvements from repair/upkeep and review-later items.

Willingness to pay:

- Medium if framed as organization for professional review.
- High if the app reduces last-minute documentation work.

Must-have workflows:

- Classification as Possible improvement, Repair/upkeep, or Not sure, review later.
- Export for professional review.
- Notes and follow-up items.
- Clear no-tax-advice disclaimers.

Objections:

- Concern about tax/legal accuracy.
- Fear that the app will overpromise.

Best subscription value proposition:

- "Organize records for review. Keep decisions with your professional."

### 3. Landlords And Small Property Owners

Pain points:

- Multiple properties.
- Many vendors.
- Many documents.
- Need reports by property, project, year, and vendor.

Willingness to pay:

- High if multi-property features are strong.

Must-have workflows:

- Multi-property dashboard.
- Vendor directory.
- Bulk export.
- Filters by property, project, category, date, and document status.
- Shared access with bookkeeper or spouse.

Objections:

- May already use accounting software.
- Needs stronger reporting and reliability.

Best subscription value proposition:

- Pro/landlord tier with multiple properties, larger storage, and export controls.

### 4. People Managing Remodels

Pain points:

- Projects have many invoices, deposits, change orders, photos, permits, and warranties.
- They need to know what is missing before a project closes.

Willingness to pay:

- Medium to high during remodel.

Must-have workflows:

- Project hub.
- Mobile upload.
- Needs attention.
- Contractor/vendor tracking.
- Before/after photos.
- Project timeline and cost rollup.

Objections:

- "I already have everything in email/photos."
- "Entering everything is too much work."

Best subscription value proposition:

- "Keep the project record together as the work happens."

### 5. Receipt And Warranty Organizers

Pain points:

- Need warranties, appliance receipts, installation docs, serial numbers, and manuals later.

Willingness to pay:

- Medium if document search is good.

Must-have workflows:

- Phone capture.
- Document type.
- Search.
- Warranty/expiration reminders later.

Objections:

- May expect free photo storage or notes app to be enough.

Best subscription value proposition:

- "One searchable place for home documents, not a generic camera roll."

### 6. Insurance, Refinance, Estate, Or Professional-Review Users

Pain points:

- Need a polished, credible packet quickly.
- Need property-specific evidence.

Willingness to pay:

- High around a life event.

Must-have workflows:

- Export packet.
- Download all documents.
- Summary totals.
- Clear chronology.
- Shareable temporary access later.

Objections:

- Trust, privacy, and accuracy.

Best subscription value proposition:

- "Turn scattered records into a review-ready packet."

## Recommended Architecture

### Overall Direction

Use a standard multi-tenant SaaS architecture:

- Web frontend
- Backend API
- Relational database
- Object file storage
- Background jobs
- OCR/document processing workers
- Email/push notification service
- Web subscription billing
- iOS in-app purchase support
- Admin/support console
- Export pipeline

### Web Frontend

Recommended options:

- Next.js/React if the current app's React-like state/UI patterns should be carried forward.
- Plain React/Vite with API backend if speed and continuity matter more than server rendering.

Recommendation:

- Use Next.js or React Router-based SPA only after choosing the backend. The existing app is a large single-page UI, so a React web app can reuse concepts, copy, and component patterns, but do not copy the local storage architecture.

Key needs:

- Authenticated app shell.
- Account/workspace context.
- Responsive tables/grids.
- Document upload.
- Dashboard.
- Follow-up modals.
- Export flows.
- Billing/settings.

### iOS App

Recommended options:

- Native SwiftUI for best camera, file picker, background upload, push notifications, and App Store subscription integration.
- React Native only if sharing web UI code is more important than native polish.

Recommendation:

- Use SwiftUI. The app's highest-value mobile workflows are capture, upload, review, and notifications. Those are better as native iOS experiences.

### Backend API

Good options:

- Node/TypeScript with Fastify, NestJS, Hono, or similar.
- Rails if the priority is rapid CRUD, auth, billing, background jobs, and admin tooling.
- Django/FastAPI if Python OCR/data workflows are central.

Recommendation:

- Use TypeScript or Rails for the main SaaS backend. Use separate OCR workers where needed. The current app is JavaScript-heavy, so TypeScript may be the smoothest transition.

Core API areas:

- Auth/session.
- Workspaces.
- Properties.
- Projects.
- Expenses.
- Documents.
- File uploads.
- OCR status.
- Vendors.
- Follow-ups.
- Activity events.
- Exports.
- Billing entitlements.
- Notifications.
- Account deletion/export.

### Database

Recommendation:

- PostgreSQL.

Why:

- Strong relational integrity for property/project/expense/document relationships.
- Good indexing for filters.
- JSONB where useful for import metadata, OCR metadata, and audit payloads.
- Mature hosted options.

### File Storage

Recommendation:

- S3-compatible object storage: AWS S3, Cloudflare R2, Google Cloud Storage, or Supabase Storage.

Design:

- Store original file objects outside the relational database.
- Store metadata in `files` table.
- Use signed URLs for upload/download.
- Keep files scoped by workspace and object id, not original filename.
- Preserve original filename only as metadata.
- Generate thumbnails/previews for images and PDFs later.

### OCR And Document Processing

MVP:

- Upload files.
- Store metadata.
- Allow manual document naming and notes.
- Queue OCR after upload for PDFs/images.
- Show status: Not processed, Processing, Text extracted, Needs review, Failed.

Later:

- Extract vendor/date/amount suggestions.
- Auto-link receipts to expenses.
- Duplicate detection.
- Search inside OCR text.

Recommended worker:

- Background job queue with separate worker process.
- Use managed OCR only after cost/privacy analysis.
- Consider hybrid: local/mobile OCR later, cloud OCR for paid tiers.

### Authentication

Options:

- Clerk/Auth0 for speed.
- Supabase Auth if using Supabase.
- Cognito if deep AWS stack.
- Custom auth only if there is a strong reason.

Recommendation:

- Start with managed auth to reduce launch risk.
- Require email verification.
- Support passkeys later.
- Add Apple sign-in for iOS if using third-party/social sign-in.

### Billing

Web:

- Stripe Billing for subscriptions.
- Stripe Checkout for initial MVP.
- Stripe Customer Portal for plan changes, payment methods, invoices, and cancellations.
- Webhooks provision entitlements.

iOS:

- StoreKit 2 for in-app purchases if selling subscription access in the iOS app.
- App Store Server API/notifications for subscription status.

Important platform note:

- Apple's current guidelines allow auto-renewable subscriptions for apps if they provide ongoing value and are available across supported devices. Multiplatform services can let users access subscriptions purchased on other platforms, but if features are sold in the iOS app, they generally must also be available through in-app purchase unless a specific exception applies. Verify the latest App Store Review Guidelines before launch.

### Notifications

Web:

- Email reminders first.
- Optional web push later.

iOS:

- Push notifications for follow-ups, document reminders, and weekly review.

Notification categories:

- Missing document.
- Project needs attention.
- Warranty reminder.
- Annual home record review.
- Export/report ready.
- Subscription/billing account events.

### Admin And Support Tooling

MVP:

- Basic admin user lookup.
- Account status.
- Subscription status.
- Storage usage.
- Export job status.
- Error logs.

Privacy rule:

- Support staff should not see user documents or OCR text by default.
- Any support access should be audited and ideally user-approved.

### Analytics

Use privacy-minimal product analytics:

- Activation: first property created.
- First project created.
- First document uploaded.
- First expense added.
- First follow-up resolved.
- Export generated.
- Subscription conversion.

Avoid collecting:

- Property addresses in analytics.
- Vendor names.
- Document names.
- OCR text.
- Expense descriptions.
- File contents.

## Data Model Roadmap

### User

Key fields:

- `id`
- `email`
- `email_verified_at`
- `name`
- `created_at`
- `last_login_at`
- `deleted_at`
- `auth_provider`

Relationships:

- Has workspace memberships.
- Has subscription customer identity through workspace or account.

Web/iOS usage:

- Login, settings, account deletion, support.

Migration:

- Local app records do not currently have a user. Import creates records under the importing user's workspace.

Privacy/security:

- PII. Encrypt sensitive metadata where appropriate. Keep auth provider and app DB access controls strict.

### Account / Workspace

Key fields:

- `id`
- `name`
- `owner_user_id`
- `plan`
- `subscription_status`
- `storage_limit_bytes`
- `created_at`
- `deleted_at`

Relationships:

- Has users through memberships.
- Has properties, vendors, documents, exports, activity.

Web/iOS usage:

- Household account, family sharing, landlord/pro workspace.

Migration:

- One local backup imports into one workspace.

Privacy/security:

- All authorization should be scoped by workspace id.

### Workspace Membership

Key fields:

- `id`
- `workspace_id`
- `user_id`
- `role`
- `invited_by_user_id`
- `created_at`

Roles:

- Owner
- Admin
- Editor
- Viewer
- Professional reviewer later

### Property

Key fields:

- `id`
- `workspace_id`
- `name`
- `address_line`
- `city`
- `state`
- `postal_code`
- `purchase_date`
- `purchase_price_cents`
- `notes`
- `created_at`
- `updated_at`
- `archived_at`

Relationships:

- Has projects, expenses, documents, activity, reminders.

Migration:

- Current `purchasePrice` becomes cents.
- Current `address` should be parsed only if reliable; otherwise store as display address and let user clean later.
- Current `isPrimary` can become selected default property preference, not a property fact.

Privacy/security:

- Property address is sensitive. Do not send to analytics.

### Project

Key fields:

- `id`
- `workspace_id`
- `property_id`
- `vendor_id`
- `name`
- `category`
- `status`
- `start_date`
- `completion_date`
- `permit_number`
- `scope_summary`
- `notes`
- `completion_override_note`
- `created_at`
- `updated_at`
- `archived_at`

Relationships:

- Belongs to property.
- Optional vendor.
- Has expenses, documents, follow-up items, activity.

Migration:

- Preserve current project ids as `legacy_id` or external import id.
- Preserve `completenessOverrideNote`.

Privacy/security:

- Project descriptions can include private details. Treat as confidential workspace data.

### Expense

Key fields:

- `id`
- `workspace_id`
- `property_id`
- `project_id`
- `vendor_id`
- `date`
- `description`
- `amount_cents`
- `classification`
- `category`
- `documentation_status`
- `notes`
- `created_at`
- `updated_at`

Relationships:

- Belongs to property.
- Optional project.
- Optional vendor.
- Has linked documents.

Migration:

- Current `amount` converts to integer cents.
- Current vendor text should map to `vendor_id` when possible.
- Preserve original import value in `import_metadata`.

Privacy/security:

- Financial information. Do not expose in support tools without explicit permission.

### Document

Key fields:

- `id`
- `workspace_id`
- `property_id`
- `project_id`
- `expense_id`
- `display_name`
- `document_type`
- `document_date`
- `notes`
- `ocr_status`
- `ocr_text_search_vector`
- `ocr_text_encrypted_or_separate`
- `created_at`
- `updated_at`

Relationships:

- Belongs to property.
- Optional project.
- Optional expense.
- Has one or more files.

Migration:

- Current `addedDate` should be reviewed. In future, distinguish `document_date` from `created_at`.
- Current `ocrText` imports as OCR text with source `legacy-import`.

Privacy/security:

- Document names and OCR text are sensitive.
- Consider storing OCR text in a separate table with stricter access paths.

### File / Attachment

Key fields:

- `id`
- `workspace_id`
- `document_id`
- `object_key`
- `original_filename`
- `mime_type`
- `size_bytes`
- `sha256`
- `uploaded_by_user_id`
- `uploaded_at`
- `storage_provider`
- `scan_status`
- `preview_status`

Relationships:

- Belongs to document.

Migration:

- Current backup file entries include `documentId`, `fileId`, `fileName`, `mimeType`, `fileSize`, `sha256`, and `dataUrl`.
- Import should decode files, hash them, upload to object storage, and create file records.

Privacy/security:

- Never expose raw object keys publicly.
- Downloads through short-lived signed URLs.
- Virus/malware scanning should be added before public launch or shortly after MVP if file sharing exists.

### Vendor / Contractor

Key fields:

- `id`
- `workspace_id`
- `name`
- `category`
- `contact_name`
- `phone`
- `email`
- `website`
- `notes`
- `status`
- `created_at`
- `updated_at`

Relationships:

- Has projects and expenses.

Migration:

- Current local app can create vendors from legacy project contractor and expense vendor names.

Privacy/security:

- Contact data may be personal data. Include in privacy disclosure.

### Follow-Up Item

Two implementation options:

1. Derived on read from records.
2. Materialized in database for reminders, assignment, and history.

Recommendation:

- Start derived for correctness and simpler migration.
- Materialize later for reminders, assignments, snooze, and notification scheduling.

Key fields if materialized:

- `id`
- `workspace_id`
- `source_type`
- `source_id`
- `type`
- `label`
- `detail`
- `severity`
- `status`
- `due_at`
- `created_at`
- `resolved_at`

Relationships:

- May link property, project, expense, document.

Migration:

- Do not import generated open items as permanent records unless they have override/completion state.
- Recompute open items after import.

Privacy/security:

- Follow-up details can contain project/vendor names.

### Override / Completion Note

Key fields:

- `id`
- `workspace_id`
- `follow_up_id`
- `label`
- `type_label`
- `detail`
- `property_id`
- `project_id`
- `expense_id`
- `document_id`
- `note`
- `completed_by_user_id`
- `completed_at`

Relationships:

- Links to record context.

Migration:

- Preserve current `followUpOverrides`.
- Preserve `project.completenessOverrideNote` either on project or as system override.

Privacy/security:

- Notes are user-authored and may include sensitive explanations.

### Activity Event

Key fields:

- `id`
- `workspace_id`
- `actor_user_id`
- `event_type`
- `record_type`
- `record_id`
- `property_id`
- `project_id`
- `summary`
- `metadata`
- `created_at`

Relationships:

- Belongs to workspace and may link to record.

Web/iOS usage:

- Dashboard Recent activity.
- Audit history.

Migration:

- Generate import events for imported records, but do not pretend legacy creation dates are known unless they exist.

Privacy/security:

- Keep metadata minimal.

### Export

Key fields:

- `id`
- `workspace_id`
- `requested_by_user_id`
- `export_type`
- `status`
- `filters`
- `file_object_key`
- `created_at`
- `expires_at`

Relationships:

- Belongs to workspace.

Web/iOS usage:

- Review packet generation.
- Full data export.

Privacy/security:

- Export files are highly sensitive.
- Set expiration.
- Audit downloads.

### Subscription / Customer

Key fields:

- `id`
- `workspace_id`
- `provider`
- `provider_customer_id`
- `provider_subscription_id`
- `status`
- `plan`
- `current_period_end`
- `trial_end`
- `cancel_at_period_end`
- `created_at`
- `updated_at`

Relationships:

- Belongs to workspace.

Web/iOS usage:

- Entitlement checks, settings, upgrade flows.

Migration:

- Local users start free/trial unless they buy a plan.

Privacy/security:

- Store provider ids, not full payment details.

### Notification / Reminder

Key fields:

- `id`
- `workspace_id`
- `user_id`
- `type`
- `channel`
- `record_type`
- `record_id`
- `scheduled_at`
- `sent_at`
- `status`

Relationships:

- Links to follow-up or record.

Web/iOS usage:

- Email and push.

Privacy/security:

- Email/push copy should avoid sensitive document or dollar details unless user opts in.

## Migration Strategy

### Recommendation For Existing Desktop App

Keep the desktop app as:

- A migration source for existing users.
- A local backup/export tool.
- A private beta prototype.
- A possible future offline edition, not the main subscription product.

Do not immediately retire it. It contains useful tested logic for:

- Data model rules.
- Backup envelope validation.
- Relationship normalization.
- Document backup/restore.
- Follow-up generation.
- Export copy and guardrails.

### Migration Inputs

The cleanest migration input is the current full backup JSON:

- `app`
- `productName`
- `productVersion`
- `exportType`
- `backupVersion`
- `createdAt`
- `data`
- `files`
- `missingFiles`

Use the existing backup validator as the basis for a server-side importer.

### Migration Assistant

Build a web migration assistant:

1. User creates account.
2. User creates or selects workspace.
3. User uploads Home Basis Tracker backup JSON.
4. Backend validates envelope.
5. Backend shows preview:
   - Properties
   - Projects
   - Expenses
   - Documents
   - Attached files
   - Missing files
   - Overrides
6. User confirms import.
7. Backend imports structured records.
8. Backend decodes and uploads file attachments.
9. Backend queues OCR only if OCR text is missing or user requests refresh.
10. Backend recomputes follow-ups.
11. User lands on imported dashboard.

### Handling IDs

Use new database UUIDs or ULIDs as primary keys. Store old ids as:

- `legacy_source = "home-basis-tracker-backup"`
- `legacy_backup_id`
- `legacy_record_id`

During import:

- Build mapping tables for each record type.
- Validate all relationships before writing.
- Write in a transaction for structured records.
- Upload files after structured validation.
- If file upload fails, preserve document record with file missing status and import warning.

### Handling Documents And Files

For each backup file:

- Validate target document exists.
- Validate blocked type rules.
- Validate size.
- Validate checksum when present.
- Decode data URL.
- Compute SHA-256.
- Upload to object storage.
- Create file record.
- Update document `has_file` or equivalent.

Keep original filename as metadata only.

### Handling OCR Text

Options:

- Import existing `ocrText` directly as legacy extracted text.
- Mark OCR source as `legacy-local`.
- Queue future refresh as optional.

Recommendation:

- Import existing OCR text, but do not overwrite unless user requests reprocessing.

### Handling Follow-Up Overrides

Preserve:

- `followUpOverrides`
- `project.completenessOverrideNote`

After import:

- Recompute follow-up items.
- Apply overrides by stable legacy follow-up id where possible.
- If generated follow-up ids change in the new system, use source record + type matching.

### Avoiding Data Loss

Rules:

- Never mutate the uploaded backup.
- Store import logs.
- Keep failed imports retryable.
- Let user download an import error report.
- Do not delete local desktop data.
- Let user import into a fresh workspace first.
- Provide duplicate detection before reimporting the same backup.

### Migration QA

Test fixtures:

- Empty backup.
- One property, no documents.
- Multi-property backup.
- Documents with attached files.
- Documents missing files.
- OCR text.
- Follow-up overrides.
- Broken relationships.
- Duplicate ids.
- Oversized file.
- Blocked executable file.
- Checksum mismatch.

Exit criteria:

- Imported counts match preview.
- Relationships match source.
- Files open after import.
- OCR text searchable after import.
- Follow-up counts are explainable.
- Overrides suppress expected open items.
- Export from imported account includes expected records.

## Web App Roadmap

### Web MVP User Experience

#### Onboarding

Goal:

- Get user from account creation to first useful record quickly.

Flow:

1. Create account.
2. Confirm email.
3. Create first property.
4. Choose starting path:
   - Add a project.
   - Upload documents.
   - Import from existing backup.
5. Show dashboard with empty states.

Copy principles:

- Direct.
- No motivational filler.
- Avoid tax/legal advice.

#### Dashboard

Preserve:

- Summary metrics.
- Recent activity subtab.
- Needs attention subtab.
- Open actions that use anchored modals/drawers.

Add:

- Storage usage.
- Subscription state if relevant.
- Import status after migration.

#### Property

Preserve:

- Property file concept.
- Compact project and expense summaries.
- Items to finish grid.

Add:

- Household sharing later.
- Property archive.
- Property-specific export.

#### Projects

Preserve:

- Compact table/grid.
- Open items count.
- Clickable Items to finish expansion.
- Specific follow-up modals.
- Project detail drawer/modal.

Add:

- Project timeline.
- Project document checklist.
- Project share/export later.

#### Expenses

Preserve:

- Compact table.
- Dynamic filters.
- Add/edit expense flow.
- Linked documents actions.

Add:

- Bulk import later.
- Duplicate warning later.
- Suggested amount/vendor/date from OCR later.

#### Documents

Preserve:

- List/grid like Excel, not huge cards.
- Sort/filter.
- View file, download, read text/OCR, remove file.

Add:

- Upload queue.
- Processing status.
- File preview thumbnails.
- Search OCR text.
- Drag/drop.

#### Follow-Up / Needs Attention

Preserve:

- Project-centered model.
- Specific item labels.
- Override and mark complete.
- Optional override note.

Add:

- Snooze.
- Assign to household member later.
- Reminder date.

#### Export / Reports

MVP:

- CSV expenses.
- Full account export.
- Review packet PDF/HTML.
- Download documents bundle later.

Later:

- Shareable expiring review link.
- Professional reviewer access role.
- Custom report builder.

#### Settings

MVP:

- Account.
- Workspace.
- Theme.
- Billing.
- Data export.
- Account deletion.
- Storage usage.

Later:

- Household members.
- Notification preferences.
- Security sessions.
- Connected services.

### Mobile Browser

The web app should work on mobile, but do not rely on mobile web as the final capture experience. Mobile web should support:

- View dashboard.
- Upload file.
- Add expense.
- Resolve simple follow-up.

The iOS app should own:

- Camera capture.
- Offline queue.
- Push reminders.
- Fast add.

## iOS App Roadmap

### iOS MVP Role

The first iOS app should be a companion, not a full clone of the web app.

MVP tabs:

- Capture
- Activity
- Needs attention
- Records
- Settings

### Capture Workflows

Must-have:

- Take receipt/photo with camera.
- Pick existing photo/file.
- Choose property.
- Choose project optional.
- Link or create expense optional.
- Choose document type.
- Save/upload.

Fast path:

- Capture file first.
- Let user fill metadata later.

### Quick Expense

Fields:

- Property
- Project optional
- Vendor
- Date
- Amount
- Description
- Category
- Cost type
- Attach receipt/photo

### Needs Attention

Show:

- Open follow-up items.
- Project name.
- Missing requirement.
- Resolve action.
- Override and mark complete.

Avoid:

- Large cards with lots of expanded text.
- Full web dashboard complexity.

### Offline Capture

MVP if feasible:

- Queue photos/documents locally until online.
- Show sync status.
- Do not lose captured files if upload fails.

If this is too much for first release, ship online-only capture but make failures explicit and retryable.

### Push Notifications

MVP:

- Weekly reminder to review open items.
- Upload processing complete.

Later:

- Warranty reminders.
- Project closeout checklist.
- Annual review.

### iOS Subscription

If iOS users can buy premium access in the app:

- Implement StoreKit 2.
- Use one subscription group.
- Mirror web plan entitlements carefully.
- Show current subscription status.
- Prevent double subscription confusion.

If web subscription is the only purchase path:

- Confirm the current App Store rules and exact storefront behavior before launch.
- Avoid in-app purchase CTAs that violate guidelines.

## Subscription And Pricing Strategy

### Recommended Starting Model

Start simple:

- Free trial: 14 days or 30 days.
- Single paid consumer plan.
- Annual plan emphasized.
- Monthly plan available.
- Pro/multi-property tier later.

Example starting structure:

- Free trial:
  - 1 property
  - limited records or limited export
  - small storage cap
- Home plan:
  - 1 to 3 properties
  - document storage
  - OCR
  - exports
  - iOS capture
  - reminders
- Pro / Landlord plan:
  - more properties
  - larger storage
  - household/team access
  - advanced exports

### Pricing Hypothesis

Test, do not assume:

- Home: around $6 to $12/month or $49 to $99/year.
- Pro/Landlord: around $15 to $29/month or $149 to $249/year.
- Short-term sale-prep plan could be $19 to $39/month if positioned around urgent export/readiness.

### Freemium Vs Trial

Freemium pros:

- Lower acquisition friction.
- Users can build trust.
- Good for document-light users.

Freemium cons:

- Storage costs can grow.
- Users may delay conversion.

Trial pros:

- Cleaner revenue intent.
- Easier to support.
- Better for paid storage/OCR product.

Recommendation:

- Start with a generous trial plus a very limited free account. Do not give away unlimited document storage.

### Storage Limits

Use storage as a plan boundary:

- Free: small limit, enough to experience value.
- Home: enough for normal homeowner use.
- Pro: higher limits.

Always provide:

- Storage usage.
- Export before deletion.
- Clear upgrade path.

### Legacy Desktop Option

Options:

1. Keep desktop as unsupported beta/prototype.
2. Sell desktop as one-time offline edition.
3. Bundle desktop migration tool with paid web account.

Recommendation:

- Keep desktop as migration/offline tool initially. Do not split attention by selling it as a separate product until web/iOS demand is clearer.

## Privacy, Security, And Trust Requirements

### Data Sensitivity

The product will handle:

- Property addresses.
- Purchase prices.
- Contractor/vendor contact info.
- Home photos.
- Receipts/invoices.
- Payment proof.
- Permits.
- Warranties.
- OCR text.
- Notes.
- Export packets.

Treat all customer data as sensitive home/financial records.

### Baseline Security Requirements

- TLS everywhere.
- Encryption at rest for database and object storage.
- Strict workspace authorization on every request.
- Signed URLs for direct file upload/download.
- Short URL expiration.
- Server-side file size/type validation.
- Malware scanning for uploaded files.
- Audit logs for exports/downloads/support access.
- Backups with tested restore.
- Account deletion.
- User data export.
- Least-privilege admin tooling.
- Secrets manager for credentials.
- Rate limiting on auth and upload endpoints.

### Support Access

Default:

- Support cannot view documents or OCR text.

If support access is needed:

- User grants temporary access.
- Access is scoped and expires.
- Every support view is logged.

### Privacy Policy Must Cover

- Account data.
- Property and project records.
- Expenses and financial details.
- Uploaded documents.
- OCR processing.
- Storage providers.
- Payment processors.
- Analytics, if any.
- Email/push notification providers.
- Data retention.
- Account deletion.
- Export rights.
- Support access limitations.

### Avoid Tax And Legal Advice

The product should not say:

- "This is deductible."
- "This qualifies for tax basis."
- "This will be accepted by the IRS."
- "Audit-proof."

Preferred framing:

- "Possible improvement."
- "Repair / upkeep."
- "Not sure, review later."
- "Organize records for professional review."
- "Export a review packet."

## Platform And Compliance Considerations

### Apple App Store

Current official Apple guidance to account for:

- Apps with account-based features need review access or demo mode for App Review.
- Apps must implement appropriate security for user information.
- Auto-renewable subscriptions must provide ongoing value, last at least seven days, and be available across all supported user devices.
- Subscription information must clearly describe what the user gets for the price, including access and storage limits.
- Multiplatform services may allow access to content, subscriptions, or features purchased on the web if those items are also available as in-app purchases in the app.
- Apps that support account creation must offer account deletion in the app.
- App Store Connect privacy responses must accurately describe app and third-party data collection, and a privacy policy URL is required.

Source references:

- Apple App Review Guidelines: https://developer.apple.com/app-store/review/guidelines/
- Apple auto-renewable subscriptions: https://developer.apple.com/app-store/subscriptions/
- Apple app privacy management: https://developer.apple.com/help/app-store-connect/manage-app-information/manage-app-privacy/

### Stripe Billing

Web subscriptions can use Stripe Billing:

- Subscriptions require lifecycle handling.
- Webhooks should provision access based on paid/active states.
- Stripe Customer Portal can let customers update payment method, invoices, subscriptions, and cancellations.

Source references:

- Stripe subscription lifecycle: https://docs.stripe.com/billing/subscriptions/overview
- Stripe Customer Portal: https://docs.stripe.com/customer-management

### Web Vs iOS Billing

Recommended billing plan:

1. Use Stripe for web subscriptions.
2. Use StoreKit 2 for iOS in-app subscriptions if users can buy from iOS.
3. Normalize both into internal entitlement records.
4. Avoid double-subscription confusion:
   - One entitlement model.
   - Clear current plan state.
   - If already subscribed on web, iOS shows access and does not prompt to buy.
   - If already subscribed through Apple, web shows Apple-managed subscription status and directs management appropriately.

### Data Deletion

Must support:

- Delete account.
- Delete workspace if owner.
- Delete property/project/expense/document.
- Delete file attachment.
- Export data before deletion.
- Clear retention policy for backups and logs.

### Accessibility

Baseline:

- Keyboard access on web.
- Screen-reader labels.
- Visible focus states.
- Sufficient color contrast in light/dark.
- iOS Dynamic Type support.
- VoiceOver labels for capture/upload actions.

## MVP Definition

### Recommended MVP Path

Choose **web MVP first, iOS companion second**.

Reason:

- The backend/account/file/billing foundation is needed either way.
- Web is easier for complex tables, imports, exports, settings, and billing.
- iOS capture is crucial, but it should attach to a stable backend.

### Web MVP Must-Haves

- Account creation/login.
- Workspace.
- Property create/edit.
- Project create/edit/list.
- Expense create/edit/list.
- Document create/edit/list.
- File upload to cloud storage.
- Dynamic filters.
- Recent activity dashboard.
- Needs attention dashboard.
- Project-centered follow-ups.
- Override and mark complete.
- Basic OCR or queued OCR status.
- CSV export.
- Review packet export.
- Full data export.
- Stripe subscription/trial.
- Settings: account, billing, export, delete account.

### Web MVP Must-Not-Haves

- Complex AI document extraction.
- Multi-role household sharing.
- Professional reviewer portal.
- Public share links.
- Advanced tax calculations.
- Full mobile native feature parity.
- Deep integrations with email/banks/contractor portals.

### iOS MVP Must-Haves

- Login.
- View properties/projects.
- Capture/upload document.
- Quick add expense with attachment.
- Needs attention list.
- Resolve simple follow-up.
- Offline retry if feasible.
- Push notification registration if reminders are included.

### MVP Success Criteria

Activation:

- User creates first property.
- User adds first project or expense.
- User uploads first document.

Engagement:

- User returns within 7 days.
- User resolves at least one follow-up.
- User creates/export a report or views Needs attention.

Revenue:

- Trial-to-paid conversion.
- Annual plan uptake.
- Low refund/cancel rate after first month.

Trust:

- Users understand what is stored.
- Users can export data.
- Users know this is not tax/legal advice.

## Phased Roadmap

### Phase 0: Current App Audit And Extraction

Goals:

- Turn the current local app into a formal product specification and migration source.

Deliverables:

- Data model inventory.
- UI workflow inventory.
- Current backup schema spec.
- Current follow-up rule spec.
- Current export spec.
- Reusable copy/design principles.

Technical tasks:

- Extract model types from `backend/domain/model.js`.
- Document backup envelope from `backend/domain/backup.js`.
- Identify reusable constants.
- Identify UI components worth porting conceptually.

Product tasks:

- Decide target brand name: Home Ledger vs Home Basis Tracker.
- Decide primary ICP for MVP.
- Decide first plan structure.

Risks:

- Trying to port too much local code directly.

QA:

- Current tests green.
- Backup fixtures generated.

Exit criteria:

- Complete schema and workflow handoff docs exist.

### Phase 1: Backend And Account Foundation

Goals:

- Build the SaaS foundation.

Deliverables:

- Auth.
- Workspace model.
- PostgreSQL schema.
- API conventions.
- Object storage integration.
- Authorization middleware.

Technical tasks:

- Choose stack.
- Create database migrations.
- Create API endpoints for core records.
- Add signed upload/download URLs.
- Add structured error model.

Product tasks:

- Account and workspace terminology.
- Basic account settings.

Risks:

- Weak auth/authorization model.

QA:

- Unit tests for authorization.
- API integration tests.
- Storage upload/download tests.

Exit criteria:

- User can create account, workspace, property, and upload a test file.

### Phase 2: Web MVP Records

Goals:

- Recreate the core app experience on the web.

Deliverables:

- Dashboard.
- Property records.
- Projects grid.
- Expenses grid.
- Documents grid.
- Dynamic filters.
- Modals/drawers.

Technical tasks:

- Build web app shell.
- Create table/grid system.
- Implement CRUD.
- Implement dependent filter helper.
- Implement recent activity.

Product tasks:

- Rewrite local-only copy.
- Add empty states.
- Confirm mobile web baseline.

Risks:

- Recreating the local app too literally.

QA:

- Visual QA light/dark.
- CRUD tests.
- Mobile-width smoke.

Exit criteria:

- A user can manage property/project/expense/document records in web.

### Phase 3: Migration / Import

Goals:

- Let current local users bring data into the web product.

Deliverables:

- Backup upload.
- Preview.
- Import.
- File attachment import.
- Import report.

Technical tasks:

- Port backup validation server-side.
- Map legacy ids.
- Import files.
- Queue OCR if needed.

Product tasks:

- Clear migration copy.
- Safety warnings.
- Success screen.

Risks:

- Data loss or duplicate imports.

QA:

- Fixture matrix.
- File integrity checks.
- Import/reimport behavior.

Exit criteria:

- Existing backup can import into a clean workspace with relationships intact.

### Phase 4: Document Storage And OCR

Goals:

- Make document upload/search a subscription-worthy feature.

Deliverables:

- Upload queue.
- OCR worker.
- OCR status.
- Text search.
- File preview.

Technical tasks:

- Background jobs.
- OCR pipeline.
- Search index.
- Retry/failure states.

Product tasks:

- Processing status copy.
- User review of extracted text.

Risks:

- OCR cost and privacy.

QA:

- PDFs/images/text files.
- Large files.
- Failed OCR.
- Search accuracy smoke.

Exit criteria:

- Uploaded documents can be searched and viewed reliably.

### Phase 5: iOS Companion

Goals:

- Add mobile capture and review.

Deliverables:

- SwiftUI app.
- Auth.
- Capture/upload.
- Quick expense.
- Needs attention.
- Push-ready foundation.

Technical tasks:

- iOS API client.
- Camera/photo/file picker.
- Upload queue.
- StoreKit prep if needed.

Product tasks:

- Mobile capture UX.
- App Store metadata.
- Privacy labels.

Risks:

- Scope creep into full web parity.

QA:

- Real-device camera/upload tests.
- Offline/failed upload tests.
- VoiceOver.

Exit criteria:

- User can capture receipt/photo and see it in web account.

### Phase 6: Subscriptions And Billing

Goals:

- Monetize access.

Deliverables:

- Stripe web subscription.
- Entitlements.
- Customer portal.
- Trial.
- App Store subscription if iOS purchase is enabled.

Technical tasks:

- Stripe webhooks.
- Entitlement table.
- Plan limits.
- Billing settings UI.
- StoreKit 2 if needed.

Product tasks:

- Pricing page.
- Plan copy.
- Trial emails.

Risks:

- Double-subscription confusion.
- App Store compliance.

QA:

- Stripe test clocks.
- Webhook replay.
- IAP sandbox tests.
- Plan limit tests.

Exit criteria:

- Paid user gets correct access; canceled user is handled gracefully.

### Phase 7: Reminders And Follow-Ups

Goals:

- Increase ongoing value.

Deliverables:

- Reminder settings.
- Email reminders.
- Push reminders.
- Snooze.
- Follow-up history.

Technical tasks:

- Notification scheduler.
- Email templates.
- Push token management.

Product tasks:

- Reminder copy.
- Default cadence.

Risks:

- Notifications feel annoying or expose sensitive info.

QA:

- Delivery tests.
- Unsubscribe/preferences.
- Sensitive copy review.

Exit criteria:

- Users can receive useful reminders and control them.

### Phase 8: Security, QA, And Beta

Goals:

- Prepare for real user data.

Deliverables:

- Security review.
- Privacy policy.
- Terms.
- Incident plan.
- Backup/restore runbook.
- Beta checklist.

Technical tasks:

- Pen-test style authorization review.
- Dependency scan.
- Logging redaction.
- Backup restore drill.

Product tasks:

- Beta onboarding.
- Support process.
- Trust copy.

Risks:

- Privacy mishandling.

QA:

- Cross-browser.
- Real iOS devices.
- Account deletion.
- Export.
- Migration.

Exit criteria:

- Private beta users can safely use real data.

### Phase 9: Launch

Goals:

- Public paid launch.

Deliverables:

- Marketing site.
- App Store listing.
- Support docs.
- Billing live mode.
- Launch analytics.

Technical tasks:

- Production monitoring.
- Rate limits.
- Error reporting.
- Payment live mode.

Product tasks:

- Pricing.
- FAQ.
- Onboarding emails.

Risks:

- Support load.
- Low conversion.

QA:

- Launch checklist.
- Purchase flow.
- App Store review.

Exit criteria:

- Users can subscribe, upload documents, and export records in production.

### Phase 10: Post-Launch Improvements

Potential improvements:

- Household sharing.
- Professional reviewer access.
- Warranty reminders.
- Email forwarding/import.
- AI-assisted document suggestions.
- Duplicate detection.
- Property sale packet.
- Landlord/pro tier.
- Integrations with cloud drives.

## Engineering Workstreams

### Frontend Web

Sequencing:

1. App shell and auth.
2. Design system/tables.
3. CRUD screens.
4. Filters.
5. Dashboard.
6. Follow-ups.
7. Exports.
8. Billing/settings.

### iOS

Sequencing:

1. App shell/auth.
2. API client.
3. Capture/upload.
4. Quick expense.
5. Needs attention.
6. Push/reminders.
7. StoreKit if needed.

### Backend/API

Sequencing:

1. Auth and workspace authorization.
2. Core record APIs.
3. File APIs.
4. Follow-up service.
5. Activity service.
6. Export service.
7. Billing entitlement service.
8. Notification service.

### Database

Sequencing:

1. Core schema.
2. Indexes for filters.
3. Audit/activity.
4. Import metadata.
5. Subscription state.
6. Search indexes.

### Billing

Sequencing:

1. Stripe products/prices.
2. Checkout.
3. Webhooks.
4. Entitlements.
5. Customer portal.
6. StoreKit/App Store Server API.

### Document Storage

Sequencing:

1. Direct upload.
2. Metadata records.
3. Secure download.
4. Preview.
5. OCR queue.
6. Search.
7. Storage limits.

### Testing

Needed coverage:

- Model validation.
- Authorization.
- Migration.
- Upload/download.
- OCR queue.
- Billing webhooks.
- App Store subscription status.
- Export.
- Account deletion.
- Light/dark visual QA.
- Mobile capture.

## UX Principles To Preserve

1. Use compact grids for record-heavy screens.
2. Keep filters visually separated from results.
3. Make filter options dynamic and dependent on active filters.
4. Keep users anchored when opening record details.
5. Use modals/drawers for task-specific editing and resolution.
6. Make follow-up items specific and actionable.
7. Center follow-ups on projects, not documents.
8. Use direct, utilitarian form copy.
9. Avoid tutorial-like production copy.
10. Keep dark and light mode equally readable.
11. Use consistent text color inside grids.
12. Make upload flows obvious.
13. Explain what Save will do.
14. Avoid tax/legal conclusions.
15. Make exports feel professional and review-oriented.

## Risks And Mitigations

### Scope Creep

Risk:

- Rebuilding the entire desktop app plus iOS plus SaaS at once.

Mitigation:

- Web MVP first.
- iOS companion second.
- Keep advanced AI/sharing/reminders later.

### Subscription Willingness To Pay

Risk:

- Homeowners may not pay monthly for recordkeeping.

Mitigation:

- Test annual plan.
- Test sale-prep positioning.
- Use storage/export/reminders as recurring value.

### Privacy And Security Burden

Risk:

- Sensitive home and financial documents increase responsibility.

Mitigation:

- Design privacy/security upfront.
- Avoid unnecessary analytics.
- Strong export/deletion controls.

### Document Storage Cost

Risk:

- Large images/PDFs can be expensive.

Mitigation:

- Plan storage caps.
- Compress previews, not originals.
- Charge for higher storage.

### OCR Cost

Risk:

- OCR can be expensive or slow.

Mitigation:

- Queue OCR.
- Limit by plan.
- Process on demand first.

### iOS Billing Complexity

Risk:

- Stripe and StoreKit entitlements diverge.

Mitigation:

- Internal entitlement abstraction.
- One subscription group.
- Clear plan mapping.

### Migration Complexity

Risk:

- Backup imports break relationships or files.

Mitigation:

- Use existing backup validation as foundation.
- Preview before import.
- Import logs and error reports.

### Legal/Tax Misunderstanding

Risk:

- Users interpret classifications as tax advice.

Mitigation:

- Keep "possible/review" language.
- Use professional-review framing.
- Include clear disclaimers.

### Support Burden

Risk:

- Users need help importing, uploading, and understanding records.

Mitigation:

- Guided onboarding.
- Clear empty states.
- Support docs.
- Import reports.

## Prioritized Questions To Answer

1. Is the product name Home Ledger, Home Basis Tracker, or something else?
2. Who is the first paying customer: general homeowner, sale-prep homeowner, remodel manager, or small landlord?
3. Is the MVP web-only first or web plus iOS companion beta?
4. What is the first paid plan price?
5. Will the iOS app sell subscriptions through StoreKit at launch?
6. What storage limits should each plan have?
7. Is OCR included in all paid plans or limited by tier?
8. Should free users be able to upload documents?
9. Should users be able to invite household members in MVP?
10. Should professional reviewer access be a launch feature or later?
11. What export is the hero deliverable: CSV, PDF review packet, ZIP archive, or all three?
12. How much tax/basis language should the product use?
13. Does the first version need migration from the desktop app?
14. What support access policy is acceptable?
15. What data retention policy applies after cancellation?
16. Should deleted account data be recoverable for a short grace period?
17. Should the product include a local backup download even after moving cloud?
18. What regions are launch targets?
19. What App Store subscription flow is acceptable for web-subscribed users?
20. How should annual home-review reminders work without becoming noise?

## Prompt Pack For Future Work

### Current App Data Model Extraction

```text
Inspect the current Home Basis Tracker codebase and produce a complete data model specification for migration to a web SaaS backend. Focus on backend/domain/model.js, backend/domain/backup.js, storage adapters, tests, and current UI flows. Document every entity, field, enum, relationship, validation rule, derived rule, backup field, and migration risk. Output a backend-ready schema recommendation and migration mapping from local backup JSON to cloud database tables.
```

### Backend Schema Design

```text
Design the PostgreSQL schema for the web + iOS Home Ledger subscription product. Use the current Home Basis Tracker model as source context: properties, projects, expenses, documents, vendors, follow-up overrides, files, OCR text, exports, activity, workspaces, users, memberships, subscriptions, and notifications. Include table definitions, key fields, indexes, foreign keys, unique constraints, soft deletion policy, audit/history strategy, and migration metadata for imported local backups.
```

### API Design

```text
Design the backend API for Home Ledger as a web + iOS subscription product. Include REST or GraphQL recommendations, endpoint list, request/response shapes, auth/authorization rules, error model, pagination, filters, sorting, file upload/download, OCR status, follow-up resolution, activity events, exports, billing entitlements, account deletion, and migration import endpoints. Preserve current UX patterns such as dynamic filters, anchored modals, project-centered follow-ups, and compact grids.
```

### Web MVP Plan

```text
Create an implementation plan for the Home Ledger web MVP. The current local app has Dashboard, Property, Projects, Expenses, Documents, Follow-ups, Export/backup, Calculators, Settings, dynamic filters, compact grids, document upload/OCR, and dark/light mode. Plan the MVP screens, components, data flows, API dependencies, routing, state management, QA coverage, and rollout sequence for a subscription SaaS web app.
```

### iOS MVP Plan

```text
Create an iOS MVP plan for Home Ledger as a companion to the web SaaS app. Focus on receipt/photo capture, document upload, quick expense entry, needs-attention review, project/property browsing, offline upload retry, push reminders, account settings, and subscription status. Recommend SwiftUI architecture, API client structure, camera/photo/file permissions, upload queue design, StoreKit 2 approach if needed, and App Store review/privacy considerations.
```

### Migration / Import Plan

```text
Create a detailed migration/import plan from the current local Home Basis Tracker backup JSON format into a cloud Home Ledger workspace. Include backup validation, relationship mapping, legacy id mapping, file attachment decoding and upload, OCR text import, follow-up override preservation, import preview, duplicate detection, rollback, partial failure handling, test fixtures, and user-facing migration copy.
```

### Subscription / Billing Plan

```text
Design the subscription and billing system for Home Ledger. Cover Stripe Billing for web, StoreKit 2 and App Store Server API for iOS if in-app purchase is required, entitlement normalization, trial design, plan limits, storage limits, billing settings, customer portal, webhooks/server notifications, cancellation behavior, grace periods, account deletion, and avoiding double subscription confusion between web and iOS.
```

### Security / Privacy Plan

```text
Create a security and privacy plan for Home Ledger as a cloud product handling home, financial, receipt, invoice, permit, warranty, photo, and OCR data. Include threat model, authentication, workspace authorization, encryption, file storage security, signed URLs, malware scanning, audit logs, support access limits, data export, account deletion, analytics minimization, App Store privacy labels, privacy policy topics, incident response, and QA/security testing.
```

### Design System Migration Plan

```text
Review the current Home Basis Tracker UI principles and create a design system migration plan for web and iOS. Preserve compact grids, dynamic filters, clear filters/results separation, anchored modals/drawers, project-centered follow-up resolution, direct form copy, dark/light readability, consistent grid text colors, mature productivity-app tone, and clear document upload flows. Define reusable components, responsive behavior, mobile adaptations, and QA screenshot coverage.
```

### QA And Release Checklist

```text
Create a comprehensive QA and release checklist for the Home Ledger web + iOS subscription product. Include web tests, API tests, database migration tests, import tests, document upload/OCR tests, billing tests, iOS device tests, App Store review checklist, privacy/security checklist, account deletion/export tests, accessibility checks, dark/light visual QA, performance checks, and beta launch criteria.
```

### Reusable Code Review

```text
Inspect the current Home Basis Tracker codebase and identify what can be reused, adapted, or discarded for a web + iOS SaaS transition. Focus on domain model rules, backup validation, follow-up generation, constants/enums, copy patterns, UI components, storage assumptions, OCR code, export logic, tests, and docs. Output practical recommendations, not a generic inventory.
```

### Deployment Infrastructure Plan

```text
Design deployment infrastructure for Home Ledger web + iOS backend. Include hosting options, PostgreSQL, object storage, background workers, OCR jobs, queues, email, push notifications, secrets, CI/CD, preview environments, logging, monitoring, backups, disaster recovery, cost controls, and environment separation for development, staging, and production.
```

## Recommended Immediate Next Step

Use this roadmap to create three concrete planning artifacts before writing new SaaS code:

1. Current-app data model and backup migration spec.
2. SaaS backend schema/API spec.
3. Web MVP product and technical plan.

Those three artifacts will prevent the transition from becoming a vague rewrite. They will also let the existing local app remain useful as a validated product prototype while the new web/iOS foundation is built deliberately.
