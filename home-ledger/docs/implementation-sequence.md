# Implementation Sequence

This document breaks the Home Ledger web MVP into small, reviewable implementation tickets. It is a planning document only. It does not create migrations, routes, screens, tests, or runtime behavior.

Recommended reasoning levels:

- `Low`: narrow mechanical edits or small docs/copy changes.
- `Medium`: localized implementation with known patterns.
- `High`: cross-layer feature work or security-sensitive behavior.
- `Extra High`: foundational architecture, authorization, import, file security, or complex migration behavior.

## Sequence Principles

- Start with stack/repo decisions before writing app code.
- Build the data and authorization foundation before UI.
- Keep each ticket shippable and testable.
- Use compact grids, dynamic filters, anchored modals/drawers, project-centered follow-ups, and direct mature copy.
- Avoid implementing deferred scope accidentally.
- Preserve product framing as organizing records for professional review.

## Ticket 1: Repo And Stack Decision Checkpoint

Objective: Decide whether the SaaS app lives in this repo or a new repo/package, and choose the web/backend stack, database access layer, auth integration style, file storage provider interface, and test strategy.

Docs it depends on:

- `docs/web-mvp-cutline.md`
- `docs/saas-schema.md`
- `docs/api-contract.md`
- `docs/api-open-questions.md`

Files/areas likely touched:

- Planning docs only at first.
- Later: repo package files, app scaffold, environment examples.

Out-of-scope:

- Migrations.
- Runtime implementation.
- Provider-specific billing.

Acceptance criteria:

- Written decision on repo/package structure.
- Written decision on backend/web framework.
- Written decision on database migration tool.
- Written decision on auth integration point, even if provider is still a placeholder.
- Written decision on testing commands and local dev workflow.

Tests/checks expected:

- Documentation lint/spell check if available.
- No runtime tests required unless scaffold is created.

Risk level: High.

Recommended Codex reasoning level: Extra High.

## Ticket 2: Database Migration Foundation

Objective: Introduce migration tooling and create initial tables needed for MVP: users, workspaces, memberships, properties, vendors, projects, expenses, documents, document_files, document_ocr, follow_up_overrides, activity_events, exports, entitlement skeleton.

Docs it depends on:

- `docs/saas-schema.md`
- `docs/web-mvp-cutline.md`

Files/areas likely touched:

- Migration directory.
- Database schema definitions.
- Test database setup.
- Schema docs if implementation deviates.

Out-of-scope:

- API routes.
- UI screens.
- Import tables unless beta migration is immediate.
- Notifications/reminders.

Acceptance criteria:

- Migrations create MVP tables with workspace scoping.
- Money fields use integer cents.
- Legacy ids are metadata fields only.
- No raw object storage key can be required in client-facing tables.
- Basic indexes match compact grid/filter needs.

Tests/checks expected:

- Migration up/down test or schema smoke test.
- Static/type checks.

Risk level: High.

Recommended Codex reasoning level: Extra High.

## Ticket 3: Auth Session Integration Point

Objective: Add the server-side concept of authenticated request context without committing to business logic beyond session resolution.

Docs it depends on:

- `docs/api-contract.md`
- `docs/api-open-questions.md`

Files/areas likely touched:

- Server middleware.
- Session endpoint.
- User model/repository.
- Test helpers for authenticated requests.

Out-of-scope:

- Full provider setup if undecided.
- Social login.
- Device/session management.

Acceptance criteria:

- `GET /api/v1/session` returns authenticated user and memberships.
- Unauthenticated requests get consistent `401` envelope.
- Tests can create authenticated request context.
- No workspace access is granted from client claims alone.

Tests/checks expected:

- Unit/integration tests for authenticated and unauthenticated session.
- Syntax/type checks.

Risk level: High.

Recommended Codex reasoning level: High.

## Ticket 4: Workspace Authorization Foundation

Objective: Implement workspace membership checks and shared authorization helpers for all future workspace-scoped APIs.

Docs it depends on:

- `docs/api-contract.md`
- `docs/saas-schema.md`
- `docs/web-mvp-cutline.md`

Files/areas likely touched:

- Authorization middleware/helpers.
- Workspace repositories.
- Workspace endpoints.
- Test fixtures.

Out-of-scope:

- Member invitation emails.
- Multi-workspace management UI.
- Admin/support console.

Acceptance criteria:

- Workspace routes require active membership.
- Owner/editor/viewer role checks are reusable.
- Cross-workspace access returns `404` or `403` consistently.
- Last-owner protections are represented if membership writes exist.

Tests/checks expected:

- Integration tests for owner/editor/viewer/no-membership.
- Cross-workspace data isolation tests.
- Syntax/type checks.

Risk level: High.

Recommended Codex reasoning level: Extra High.

## Ticket 5: Property API

Objective: Implement property CRUD and list behavior as the first real workspace-scoped record API.

Docs it depends on:

- `docs/api-contract.md`
- `docs/saas-schema.md`
- `docs/current-app-model.md`

Files/areas likely touched:

- Property routes/controllers.
- Property repository/model.
- Validation helpers.
- API tests.

Out-of-scope:

- Address parsing.
- Property valuation integrations.
- Cascading hard delete.

Acceptance criteria:

- Create/list/detail/update/archive/delete property endpoints.
- `purchase_price_cents` is nonnegative integer.
- Only one active primary property per workspace.
- Viewer can read; editor/owner can write.
- Cross-workspace reads/writes are blocked.

Tests/checks expected:

- CRUD tests.
- Primary uniqueness tests.
- Authorization tests.
- Validation tests.

Risk level: Medium.

Recommended Codex reasoning level: High.

## Ticket 6: Vendor API

Objective: Implement vendor CRUD and lookup behavior for project/expense forms.

Docs it depends on:

- `docs/api-contract.md`
- `docs/saas-schema.md`
- `docs/legacy-to-saas-mapping.md`

Files/areas likely touched:

- Vendor routes/controllers.
- Vendor repository/model.
- Filter option helpers.
- API tests.

Out-of-scope:

- Automatic vendor merge.
- Contact normalization.
- Vendor analytics.

Acceptance criteria:

- Vendor list/create/detail/update/archive/delete endpoints.
- Name required.
- Normalized name is search/de-dupe support only, not unique.
- Raw vendor names in expenses/projects are preserved separately later.

Tests/checks expected:

- CRUD tests.
- Authorization tests.
- Filter/search tests.

Risk level: Medium.

Recommended Codex reasoning level: Medium.

## Ticket 7: Project API

Objective: Implement project CRUD, compact grid list, and project filter options.

Docs it depends on:

- `docs/api-contract.md`
- `docs/saas-schema.md`
- `docs/follow-up-rules.md`

Files/areas likely touched:

- Project routes/controllers.
- Project repository/model.
- Shared filter helper.
- API tests.

Out-of-scope:

- Follow-up generation.
- Project budgets/templates.
- Collaboration.

Acceptance criteria:

- Project CRUD endpoints work under workspace authorization.
- Project belongs to property in same workspace.
- Vendor link optional.
- Status/category/date filters work.
- Filter options are dynamic based on active filters.

Tests/checks expected:

- CRUD tests.
- Relationship validation tests.
- Dynamic filter option tests.
- Authorization tests.

Risk level: Medium.

Recommended Codex reasoning level: High.

## Ticket 8: Expense API

Objective: Implement expense CRUD, compact grid list, amount handling, and expense filter options.

Docs it depends on:

- `docs/api-contract.md`
- `docs/saas-schema.md`
- `docs/current-app-model.md`

Files/areas likely touched:

- Expense routes/controllers.
- Expense repository/model.
- Shared money validation.
- Shared filter helper.
- API tests.

Out-of-scope:

- Bank/card import.
- Automatic classification.
- Derived documentation status redesign.

Acceptance criteria:

- Expense CRUD endpoints.
- `amount_cents` required and nonnegative.
- Property required.
- Project must belong to same property when present.
- Record treatment uses neutral SaaS enum.
- Dynamic filters support property/project/vendor/treatment/category/documentation status/date.

Tests/checks expected:

- CRUD tests.
- Money validation tests.
- Relationship validation tests.
- Dynamic filter tests.
- Authorization tests.

Risk level: Medium.

Recommended Codex reasoning level: High.

## Ticket 9: Document Metadata API

Objective: Implement document metadata CRUD and document grid/filter behavior before file upload.

Docs it depends on:

- `docs/api-contract.md`
- `docs/saas-schema.md`
- `docs/current-app-model.md`

Files/areas likely touched:

- Document routes/controllers.
- Document repository/model.
- Relationship validation.
- API tests.

Out-of-scope:

- File upload bytes.
- OCR processing.
- Multiple active files.

Acceptance criteria:

- Document metadata CRUD endpoints.
- Document can link to property/project/expense.
- Expense-linked document context is validated against the expense.
- File availability starts as `not_uploaded`.
- Dynamic filters support property/project/expense/type/file availability/date.

Tests/checks expected:

- CRUD tests.
- Relationship validation tests.
- Dynamic filter tests.
- Authorization tests.

Risk level: Medium.

Recommended Codex reasoning level: High.

## Ticket 10: File Intent API

Objective: Implement secure file upload/download/remove contract for one active file per document.

Docs it depends on:

- `docs/api-contract.md`
- `docs/saas-schema.md`
- `docs/backup-format.md`

Files/areas likely touched:

- File routes/controllers.
- Storage provider abstraction.
- Document file repository/model.
- Audit event hooks.
- API tests.

Out-of-scope:

- Multiple files per document.
- Public share links.
- Advanced virus scanning UI unless provider chosen.

Acceptance criteria:

- Upload intent endpoint creates pending file metadata without exposing object key.
- Confirm endpoint marks file available and updates document file availability.
- Download URL endpoint returns short-lived signed URL.
- Remove endpoint keeps document metadata and marks file removed.
- Blocked extensions/MIME rules are enforced.

Tests/checks expected:

- Upload intent tests.
- Confirm validation tests.
- Download authorization tests.
- Blocked file tests.
- No raw object key response tests.

Risk level: High.

Recommended Codex reasoning level: Extra High.

## Ticket 11: Follow-up Service

Objective: Port/generate follow-up logic from source records and persist only overrides.

Docs it depends on:

- `docs/follow-up-rules.md`
- `docs/api-contract.md`
- `docs/current-app-model.md`

Files/areas likely touched:

- Follow-up service.
- Follow-up routes.
- Override repository/model.
- API tests.

Out-of-scope:

- Reminder scheduling.
- Rule versioning UI.
- Professional reviewer workflow.

Acceptance criteria:

- Generated follow-ups match current project-centered behavior.
- Project open-item counts are derived.
- Override with optional note suppresses one item.
- Removing override reopens item if still generated.
- Document-related follow-ups appear through project/dashboard surfaces, not document-centered workflow.

Tests/checks expected:

- Unit tests ported from current follow-up tests.
- Override tests.
- Project open-item count tests.
- API authorization tests.

Risk level: High.

Recommended Codex reasoning level: Extra High.

## Ticket 12: Activity Service

Objective: Record and expose recent activity for the dashboard.

Docs it depends on:

- `docs/api-contract.md`
- `docs/saas-schema.md`
- `docs/web-mvp-cutline.md`

Files/areas likely touched:

- Activity event model/repository.
- Hooks in create/update/upload/export/follow-up override actions.
- Activity endpoint.
- API tests.

Out-of-scope:

- Full audit viewer.
- Analytics pipeline.
- Synthetic historical import activity unless import is active.

Acceptance criteria:

- Recent activity lists projects, expenses, documents, files, exports, and follow-up overrides.
- Activity summaries avoid sensitive overexposure.
- Dashboard can filter by activity type.

Tests/checks expected:

- Activity creation tests.
- Activity list/filter tests.
- Sensitive metadata tests.

Risk level: Medium.

Recommended Codex reasoning level: High.

## Ticket 13: Export Service

Objective: Implement expenses CSV and basic review packet export with async status and expiring download URL.

Docs it depends on:

- `docs/api-contract.md`
- `docs/current-app-model.md`
- `docs/web-mvp-cutline.md`

Files/areas likely touched:

- Export routes/controllers.
- Export service.
- CSV/PDF generation helpers.
- Storage provider abstraction.
- Audit event hooks.
- Tests.

Out-of-scope:

- Document archive bundle.
- Scheduled exports.
- OCR text export.
- Public share links.

Acceptance criteria:

- CSV export includes expense fields needed for review.
- CSV neutralizes spreadsheet formulas.
- Review packet includes property/project/expense/document index basics.
- Export status and download URL endpoints work.
- Exports expire.
- Export creation/download writes audit event.

Tests/checks expected:

- CSV output tests.
- Export status tests.
- Download authorization tests.
- Copy boundary tests.

Risk level: High.

Recommended Codex reasoning level: Extra High.

## Ticket 14: Web App Shell

Objective: Create the authenticated web app layout and navigation for Dashboard, Properties, Projects, Expenses, Documents, Exports, and Settings.

Docs it depends on:

- `docs/web-mvp-cutline.md`
- `docs/api-contract.md`

Files/areas likely touched:

- Frontend app shell.
- Routing/navigation.
- Session/workspace client.
- Shared UI components.

Out-of-scope:

- Full grid implementation.
- Landing/marketing pages.
- iOS app.

Acceptance criteria:

- Authenticated app shell loads session/workspace.
- Navigation is clear and compact.
- Empty states are direct and mature.
- Light/dark readability is preserved.

Tests/checks expected:

- Render tests if available.
- Accessibility smoke checks.
- Syntax/type checks.

Risk level: Medium.

Recommended Codex reasoning level: High.

## Ticket 15: Compact Grids And Dynamic Filters

Objective: Build reusable grid/filter patterns for Properties, Projects, Expenses, and Documents.

Docs it depends on:

- `docs/web-mvp-cutline.md`
- `docs/api-contract.md`
- `docs/api-open-questions.md`

Files/areas likely touched:

- Frontend grid components.
- Filter components.
- API client hooks.
- CSS/design system.
- UI tests.

Out-of-scope:

- Inline expanded detail cards.
- Saved filter views.
- Advanced analytics.

Acceptance criteria:

- Filters are visually separate from results.
- Records render in compact scannable rows.
- Dynamic dependent filter options work.
- Row actions open anchored modals/drawers.
- Text does not overflow on mobile/desktop.

Tests/checks expected:

- Component/render tests.
- Browser/visual QA.
- Accessibility checks.

Risk level: High.

Recommended Codex reasoning level: Extra High.

## Ticket 16: Dashboard

Objective: Implement Dashboard Recent activity and Needs attention subtabs.

Docs it depends on:

- `docs/web-mvp-cutline.md`
- `docs/follow-up-rules.md`
- `docs/api-contract.md`

Files/areas likely touched:

- Dashboard components.
- Activity client.
- Follow-up client.
- Modal/drawer flows.
- UI tests.

Out-of-scope:

- Big static metric cards unless useful.
- Cross-page jumps from Open actions.
- Analytics dashboards.

Acceptance criteria:

- Recent activity is one compact grid/table with type filter.
- Needs attention is one compact grid/table.
- Open actions keep the user anchored on Dashboard.
- Follow-up resolution opens focused modal.

Tests/checks expected:

- UI/render tests.
- Browser QA light/dark.
- Follow-up action tests.

Risk level: High.

Recommended Codex reasoning level: Extra High.

## Ticket 17: Record Detail Modals And Forms

Objective: Implement anchored add/edit/detail flows for properties, projects, expenses, documents, and follow-up resolution.

Docs it depends on:

- `docs/web-mvp-cutline.md`
- `docs/api-contract.md`
- `docs/follow-up-rules.md`

Files/areas likely touched:

- Modal/drawer components.
- Forms.
- Validation/error display.
- API client mutations.
- UI tests.

Out-of-scope:

- Wizard-style onboarding.
- AI-generated helper copy.
- Disruptive tab jumps.

Acceptance criteria:

- Forms use direct labels and mature helper copy.
- Save actions clearly indicate the record being changed.
- Validation errors are accessible.
- Follow-up modals show project context and exact missing item.

Tests/checks expected:

- Form validation tests.
- Accessibility checks.
- Browser QA.

Risk level: High.

Recommended Codex reasoning level: Extra High.

## Ticket 18: Settings And Data Controls

Objective: Implement account/workspace/settings surface with entitlement, storage usage, export/deletion placeholders or endpoints.

Docs it depends on:

- `docs/web-mvp-cutline.md`
- `docs/api-contract.md`

Files/areas likely touched:

- Settings UI.
- Account/workspace API clients.
- Entitlement/usage components.
- Data controls components.

Out-of-scope:

- Complex member management.
- Advanced billing portal if provider undecided.
- Full support access UI.

Acceptance criteria:

- User can view account/workspace basics.
- Storage/entitlement status visible.
- Full data export and deletion paths are represented.
- Copy is concise and does not overpromise.

Tests/checks expected:

- Render tests.
- Authorization/visibility tests.
- Copy boundary checks.

Risk level: Medium.

Recommended Codex reasoning level: High.

## Ticket 19: Billing Skeleton

Objective: Add minimal entitlement and billing status behavior if subscription launch is intended.

Docs it depends on:

- `docs/api-contract.md`
- `docs/web-mvp-cutline.md`
- `docs/api-open-questions.md`

Files/areas likely touched:

- Entitlement API.
- Usage API.
- Settings UI.
- Limit enforcement in file upload.

Out-of-scope:

- Full Stripe/App Store implementation unless provider chosen.
- Multi-plan matrix.
- Coupons/promotions.

Acceptance criteria:

- API exposes plan/status/limits.
- Upload and storage limit messaging works.
- Billing portal link is placeholder or provider-backed.
- Core app does not depend on advanced billing features.

Tests/checks expected:

- Entitlement API tests.
- Limit enforcement tests.
- Settings render tests.

Risk level: Medium.

Recommended Codex reasoning level: High.

## Ticket 20: Import/Migration Preview

Objective: Implement local backup import validation/preview only if beta migration depends on it.

Docs it depends on:

- `docs/backup-format.md`
- `docs/legacy-to-saas-mapping.md`
- `docs/api-contract.md`
- `docs/web-mvp-cutline.md`

Files/areas likely touched:

- Import routes/controllers.
- Backup validation service.
- Import batch/record/file tables.
- Import preview UI.
- Tests.

Out-of-scope:

- Guided merge UI.
- Repeated import advanced resolution.
- iOS import.

Acceptance criteria:

- Backup upload/validate/preview works.
- Warnings identify missing files, blocked files, currency default, duplicate risk, OCR import, and vendor ambiguity.
- Confirm import can be deferred unless beta requires complete migration.

Tests/checks expected:

- Backup validation tests.
- Warning generation tests.
- File outcome tests.
- Authorization tests.

Risk level: High.

Recommended Codex reasoning level: Extra High.

## Ticket 21: Import Confirm

Objective: If migration is in MVP, implement confirmed import of records/files using legacy mapping rules.

Docs it depends on:

- `docs/legacy-to-saas-mapping.md`
- `docs/backup-format.md`
- `docs/api-contract.md`

Files/areas likely touched:

- Import services.
- Import batch/record/file repositories.
- Core record repositories.
- File storage integration.
- Follow-up recomputation hooks.
- Tests.

Out-of-scope:

- Replace-workspace import.
- Advanced duplicate merge.
- Checksum override unless product decides.

Acceptance criteria:

- Records import with new UUIDs.
- Legacy ids preserved in import metadata.
- Relationships remapped correctly.
- File outcomes are tracked.
- Follow-ups recompute after import.

Tests/checks expected:

- End-to-end import tests with sample backup.
- Relationship remap tests.
- Duplicate detection tests.
- File import outcome tests.

Risk level: High.

Recommended Codex reasoning level: Extra High.

## Suggested First Five Tickets

1. Repo And Stack Decision Checkpoint: Extra High.
2. Database Migration Foundation: Extra High.
3. Auth Session Integration Point: High.
4. Workspace Authorization Foundation: Extra High.
5. Property API: High.

