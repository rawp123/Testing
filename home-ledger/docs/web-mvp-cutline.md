# Web MVP Cutline

This document defines the smallest credible web-first SaaS MVP for Home Ledger. It is a scope document only. It does not create migrations, routes, screens, dependencies, or runtime behavior.

## Source Context

Primary source docs:

- `docs/current-app-model.md`
- `docs/backup-format.md`
- `docs/follow-up-rules.md`
- `docs/migration-risks.md`
- `docs/saas-schema.md`
- `docs/legacy-to-saas-mapping.md`
- `docs/api-contract.md`
- `docs/api-open-questions.md`

## MVP Product Thesis

Home Ledger helps a homeowner organize property, project, expense, and document records into a clean review-ready workspace. The paid product is valuable when a user can capture costs and supporting documents, see what is missing, resolve or override follow-up items, and export a useful review packet or CSV.

The MVP must prove that workflow end to end. It should not try to become a household collaboration platform, document AI product, reviewer portal, accounting tool, or native mobile suite.

## First Target User Assumption

The first target user is a homeowner who has one primary home or a small number of properties, is actively tracking projects/expenses, and wants a private place to organize supporting records for professional review.

Assumptions:

- They are using the web app first.
- They are comfortable entering project and expense data manually.
- They can upload receipts, invoices, contracts, photos, and related documents.
- They value clarity, exportability, and missing-item visibility more than automation.
- They do not need household sharing, professional portals, bank feeds, or iOS parity at launch.

## First Paid-value Workflow

Primary launch workflow:

1. Create an account and workspace.
2. Create a property.
3. Create a project for that property.
4. Add an expense to the project.
5. Upload or link a supporting document.
6. See a Needs attention item if something is missing or unclear.
7. Resolve or override the follow-up item.
8. Export an expenses CSV or basic review packet.

This workflow is the MVP acceptance spine. Features that do not support it directly are deferred unless needed for trust, privacy, or payment.

## Launch-critical Features

- Account/session foundation.
- Single active workspace foundation, with future workspace expansion not blocked.
- Owner role and workspace authorization.
- Property CRUD.
- Project CRUD.
- Expense CRUD.
- Document metadata CRUD.
- Secure file upload/download intent flow.
- Basic file availability/status display.
- Compact grids for properties/projects/expenses/documents.
- Dynamic dependent filters required for the grids.
- Dashboard with Recent activity and Needs attention.
- Project-centered follow-up generation.
- Follow-up override/mark-complete behavior.
- CSV expense export.
- Basic review packet export.
- Basic full data export placeholder/design path.
- Settings/account area for profile, workspace, export/deletion placeholders, and entitlement display.
- Billing/entitlement skeleton if subscription launch is intended.
- Import preview/design only if beta users need migration from local backup.
- Security/privacy basics: workspace scoping, no raw object storage keys, audit expectations for file/export/import/deletion actions.
- Direct, mature copy that frames the product as organizing records for professional review.

## Non-launch-critical Features

- iOS app.
- Household sharing.
- Professional reviewer portal.
- Public share links.
- Advanced AI extraction.
- Automatic vendor/date/amount extraction.
- Bank/card integrations.
- Email forwarding/import.
- Warranty reminder system.
- Landlord/pro tier.
- Multi-workspace management UI.
- Advanced billing matrix.
- Advanced OCR/search if it delays the paid workflow.
- Native mobile parity.
- Admin/support console beyond minimal internal operational access.
- Tax/legal/accounting conclusions.

## Explicit In/Out Table

| Area | MVP in | MVP out |
| --- | --- | --- |
| Auth/account | Account/session integration point, profile basics, logout | Device management, SSO, multi-provider account linking |
| Workspace | One active workspace per user, owner membership, workspace foundation | Multi-workspace management UI, household sharing, admin role UI unless needed |
| Properties | CRUD, primary/default property, compact grid | Address parsing, market data, property valuation integrations |
| Projects | CRUD, status/category/date filters, open-item counts, detail modal/drawer | Complex project budgets, project templates, collaboration threads |
| Expenses | CRUD, integer cents, record treatment, support status, compact grid | Bank/card import, recurring expenses, automated classification |
| Documents | Metadata CRUD, one active file per document, upload/download, file status | Multiple files per document, public links, email import |
| OCR | Status placeholder and optional manual read if simple | OCR search, automatic extraction, AI parsing, complex OCR workflows |
| Follow-ups | Generated open items, project-centered UI, override with note | Reminders, rule versioning UI, professional review workflow |
| Activity | Recent activity list for projects/expenses/documents/files/follow-ups | Full audit viewer, timeline analytics |
| Exports | Expenses CSV, basic review packet, full data export placeholder | Document archive bundle, scheduled exports, reviewer delivery |
| Import | Design/preview path if beta migration required | Full guided merge, repeated import resolution UI, iOS import |
| Billing | Entitlement skeleton and plan status if paid launch | Advanced plan matrix, coupons, app store purchases |
| Analytics | Minimal privacy-safe event counts | Sensitive data analytics, vendor/amount/document text tracking |
| Support/admin | Minimal internal access policy and audit events | Support console, impersonation, reviewer access grants |

## MVP Navigation Structure

Recommended first navigation:

- Dashboard
- Properties
- Projects
- Expenses
- Documents
- Exports
- Settings

Navigation rules:

- The Dashboard defaults to Recent activity and has a Needs attention subtab.
- Record clicks should open anchored modals/drawers where practical, not unexpectedly jump tabs.
- The Projects tab owns project-centered follow-up review.
- Filters sit above compact grids and remain visually separate from results.
- Settings contains account, workspace, entitlement, data export, and deletion placeholders.

## MVP Screen List

Launch screens:

- Sign in/session loading screen.
- Workspace bootstrap screen, only if no workspace exists.
- Dashboard with Recent activity and Needs attention subtabs.
- Properties grid and property add/edit modal.
- Projects grid and project add/edit/detail modal.
- Expenses grid and expense add/edit/detail modal.
- Documents grid and document add/edit/detail modal.
- File upload/download/remove flow inside document modal.
- Follow-up resolution/override modal.
- Export screen for CSV/review packet requests and statuses.
- Settings screen for account, workspace, entitlement, data controls.
- Basic import preview screen only if beta migration is included.

Not launch screens:

- iOS capture screens.
- Member management if sharing is deferred.
- Reviewer portal.
- Admin/support console.
- Advanced billing plan comparison.
- OCR search screen.
- Reminder calendar.

## MVP Empty States

Empty states should be concise and task-oriented, not tutorial-like.

- No workspace: "Create a workspace to start organizing home records."
- No properties: "Add a property."
- No projects: "Add a project for this property."
- No expenses: "Add an expense."
- No documents: "Add a document."
- No recent activity: "New projects, expenses, and documents will appear here."
- No follow-ups: "No open items."
- No export history: "Create a CSV or review packet when you are ready."
- No import batch: "Import from a local backup if you are moving existing records."

Avoid empty states that imply tax, legal, accounting, or compliance conclusions.

## MVP Settings And Account Requirements

MVP settings must include:

- Account profile display and basic edit fields, depending on auth provider.
- Current workspace name.
- Theme preference if already part of product direction.
- Entitlement/plan status display if subscription launch is intended.
- Storage usage display.
- Data export request placeholder or working endpoint.
- Account deletion request placeholder or working endpoint.
- Workspace archive/deletion placeholder or working endpoint.

MVP settings can defer:

- Member management.
- Billing portal until provider is chosen.
- Notification preferences.
- Device/session management.
- Support access controls UI.

## MVP Export Requirements

Launch exports:

- Expenses CSV export.
- Basic review packet export.

MVP export behavior:

- Asynchronous export status is acceptable.
- Export files should expire.
- Export creation and download should be auditable.
- CSV must preserve spreadsheet formula neutralization behavior.
- Review packet copy must frame output as organized records for professional review.
- Attached file contents do not need to be embedded in the review packet.

Design/placeholder:

- Full data export should exist at least as a documented endpoint/UI placeholder before paid launch, because data portability is trust-critical.

Deferred:

- Document archive bundle.
- Scheduled exports.
- Reviewer delivery/share links.
- OCR text export unless explicitly approved.

## MVP Import And Migration Requirements

MVP import depends on beta strategy.

If beta users are expected to bring local app data:

- Include backup upload, validation, preview, confirm, status, warning report.
- Preserve legacy ids in metadata.
- Show warnings for missing files, blocked files, currency default, zero amounts, OCR import, vendor ambiguity, and repeated import risk.
- Recompute follow-ups after import.
- Import file contents only when valid, size-compliant, and allowed.

If beta starts with new SaaS users only:

- Defer full import implementation.
- Keep import schema/API docs and a Settings placeholder.
- Do not block the primary create-property/project/expense/document workflow on import.

Recommended MVP cutline:

- Build import after the core paid workflow unless beta migration is mandatory.

## MVP Document And OCR Requirements

Documents:

- Create/edit/delete document metadata.
- Link document to property/project/expense.
- Upload one active file per document.
- Download/remove file.
- Show file availability/status: available, not uploaded, removed, blocked, missing, failed.
- No raw object storage keys in responses.

OCR:

- MVP minimum: OCR status model exists and can show imported/manual status.
- If simple enough, support manual queue/read text for PDFs/images/plain text.
- OCR search is deferred unless it is cheap and privacy-reviewed.
- Automatic vendor/date/amount extraction is out.
- OCR text must be treated as sensitive.

## MVP Billing And Entitlement Requirements

If subscription launch is intended:

- Show current plan/entitlement state.
- Enforce storage/file-size limits.
- Include billing portal placeholder or provider link once chosen.
- Keep plan model simple: free/trial plus one paid plan is enough for MVP.

If subscription launch is not ready:

- Keep entitlement skeleton in code path.
- Do not build an advanced plan matrix.
- Do not block core record creation on complex billing decisions.

## MVP Security And Privacy Requirements

MVP must include:

- Workspace authorization on every workspace-scoped route.
- Server-generated UUID ids in URLs.
- No raw object storage key exposure.
- Signed upload/download URLs.
- Role checks for write/export/delete actions.
- Audit events or audit-ready hooks for file download, export download, import, deletion, and support-sensitive access.
- Sensitive values excluded from logs and analytics.
- Account/workspace deletion design path.
- Full data export design path.

MVP may defer:

- Full support/admin console.
- Advanced anomaly detection.
- Field-level encryption decisions unless required before file/OCR storage.

## MVP Analytics Limitations

Allowed analytics:

- Page/screen visited.
- Feature action type, such as created project or requested export.
- Error code counts.
- Aggregate funnel counts.

Do not send:

- Property addresses.
- Vendor names.
- Expense amounts.
- Document names.
- OCR text.
- Notes.
- Raw export/import content.
- Object storage keys.

Analytics should not be required for core MVP functionality.

## MVP Accessibility Baseline

MVP must include:

- Keyboard-accessible navigation and modals.
- Visible focus states.
- Labels for form fields.
- Accessible error messages.
- Dialog titles and descriptions.
- Table/grid semantics or clear row structure.
- Sufficient light/dark contrast.
- No text overflow in compact grids.
- Buttons and links with clear accessible names.

Deferred:

- Full external accessibility audit before private beta, unless public launch requires it.

## MVP Success Criteria

Product success:

- A new user can complete the primary paid-value workflow without support.
- A user can understand which project records need attention.
- A user can attach or download a document file securely.
- A user can override a follow-up intentionally with a note.
- A user can export an expenses CSV or review packet.
- The product feels like a practical record system, not a demo.

Engineering success:

- Workspace authorization is enforced consistently.
- Core records use UUIDs and integer cents.
- File upload/download avoids raw object key exposure.
- Follow-ups are generated from records and overrides.
- Dynamic filters work on record grids.
- The implementation has narrow tests around model, auth scoping, filters, follow-ups, files, and exports.

Launch readiness:

- No tax/legal/accounting conclusions in product copy.
- No sensitive values sent to analytics.
- Import is either implemented enough for beta migration or clearly deferred.
- Billing is either functional enough for paid launch or explicitly not part of the launch.

