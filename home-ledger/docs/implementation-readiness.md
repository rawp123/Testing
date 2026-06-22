# Implementation Readiness

This document summarizes what Ticket 1 resolves, what remains blocked, and what Ticket 2 should do next. It is a readiness document only and does not create migrations, routes, screens, dependencies, or runtime behavior.

## Sources Inspected

- `AGENTS.md`
- `README.md`
- `package.json`
- `.env.example`
- `backend/README.md`
- `desktop/package.json`
- `docs/ARCHITECTURE.md`
- `docs/DATA_SAFETY.md`
- `docs/web-mvp-cutline.md`
- `docs/implementation-sequence.md`
- `docs/deferred-scope.md`
- `docs/saas-schema.md`
- `docs/api-contract.md`
- `docs/api-open-questions.md`
- `docs/current-app-model.md`
- `docs/backup-format.md`
- `docs/follow-up-rules.md`
- `docs/migration-risks.md`
- `docs/legacy-to-saas-mapping.md`

## Decisions Resolved By Ticket 1

Repository structure:

- Use a transitional `apps/` and `packages/` structure inside the current repo in future implementation tickets.
- Preserve current `frontend/`, `backend/`, `desktop/`, `website/`, scripts, and local app behavior.
- Do not move current local app files before SaaS scaffold and tests exist.

Backend:

- Use a separate Node.js TypeScript API service.
- Prefer a lightweight HTTP framework such as Fastify when implementation begins.
- Keep API independent of web frontend so future iOS can use it.

Frontend:

- Use a new React + Vite + TypeScript web app package.
- Preserve current UX patterns and product copy standards.
- Do not copy local storage assumptions into the SaaS app.

Database:

- Use PostgreSQL.
- Use explicit SQL migrations.
- Recommended migration tool: `node-pg-migrate`.
- Runtime database access should start with `pg` plus repository modules.

Auth/session:

- No final auth provider chosen.
- Use provider-neutral authenticated request context.
- Use dev-only auth for local development and tests.
- Never trust client-provided user ids, roles, workspace membership, entitlement, or object keys.

Workspace authorization:

- MVP roles: owner, editor, viewer.
- Admin role is reserved/deferred.
- Every workspace-scoped route must verify membership and role.
- Cross-workspace record access should return `404`; insufficient role should return `403`; unauthenticated should return `401`.

File storage:

- Use a storage abstraction.
- Use local app-managed storage for development.
- Use S3-compatible abstraction as production candidate without provider lock-in.
- Use signed upload/download intent model.
- Never expose raw object storage keys.
- Start from local app 25 MB file limit unless product chooses otherwise.

Testing:

- Keep current root checks.
- Add package-specific API/web/db checks when SaaS packages exist.
- Prioritize authorization, workspace isolation, migration, file intent, dynamic filters, and follow-up tests.

## Unresolved Blockers

These block production implementation decisions, but not necessarily Ticket 2 schema/migration foundation:

- Final auth provider and token/cookie strategy.
- Billing provider and subscription ownership model.
- Production object storage provider.
- Malware/file scanning policy.
- Exact SaaS file size limit if different from 25 MB.
- Whether blank backup file checksums can import by default.
- Whether beta requires import confirm in MVP.
- Export expiration period.
- Account/workspace deletion retention period.
- Whether project completeness override continues suppressing child follow-ups.

## Decisions Required Before Ticket 2

Ticket 2 is Database Migration Foundation. Before starting it, decide:

1. Add npm workspaces now or create `apps/api` package with a minimal package setup first.
2. Use `node-pg-migrate` as the migration tool.
3. Confirm migration language: explicit SQL migrations.
4. Confirm PostgreSQL version target for local/test/staging.
5. Confirm migration directory location, recommended: `apps/api/migrations`.
6. Confirm MVP schema subset for Ticket 2:
   - users
   - workspaces
   - workspace_memberships
   - properties
   - vendors
   - projects
   - expenses
   - documents
   - document_files
   - document_ocr
   - follow_up_overrides
   - activity_events
   - exports
   - workspace_entitlements
7. Confirm import tables are deferred unless beta migration requires them immediately.
8. Confirm admin role is not implemented in MVP schema beyond future-safe enum planning.
9. Confirm local/test database URLs and reset strategy.
10. Confirm whether migration tests run against a real local Postgres database or a containerized one.

## Decisions Safely Deferrable Until Later Tickets

Can defer until Auth Session Integration:

- Final auth provider.
- Cookie versus bearer token implementation.
- Session lifetime.
- Device management.

Can defer until File Intent API:

- Production storage provider.
- Malware scanning provider.
- Signed URL TTLs beyond initial defaults.
- Multiple active file support.

Can defer until Export Service:

- Exact review packet rendering engine.
- Export expiration period, if a safe default is used first.
- Whether OCR text can be exported.

Can defer until Billing Skeleton:

- Billing provider.
- Trial length.
- Plan matrix.
- App Store purchase handling.

Can defer until Import/Migration Preview:

- Duplicate import strategy.
- Blank checksum policy.
- Raw import snapshot retention.
- Tutorial/sample backup import policy.

Can defer until Web App Shell:

- Final component library decision, if any.
- Exact visual implementation of app navigation.
- Member management UI.

Can defer until OCR ticket:

- OCR provider.
- Automatic versus manual OCR.
- OCR search.

## Recommended Ticket 2 Cutline

Ticket 2 should only do database migration foundation. It should not implement:

- API routes.
- Auth provider.
- Web screens.
- File upload logic.
- Import preview/confirm logic.
- Billing provider.
- OCR processing.
- iOS.
- Household sharing.
- Reviewer portal.
- Admin/support console.

Ticket 2 should create only the minimum package/tooling needed for migrations and schema tests.

## Recommended Next Codex Prompt For Ticket 2

```text
Complete Ticket 2: Database Migration Foundation.

Follow AGENTS.md.

Use these docs as primary source context:
- docs/stack-decision.md
- docs/local-dev-workflow.md
- docs/environment-and-secrets-plan.md
- docs/implementation-readiness.md
- docs/saas-schema.md
- docs/web-mvp-cutline.md
- docs/api-contract.md

Task:
Implement the initial SaaS database migration foundation only.

Scope:
- Preserve the existing local app.
- Add the minimum npm workspace/package structure needed for the SaaS API migration tooling.
- Add PostgreSQL migration tooling using the decision in docs/stack-decision.md.
- Create initial migrations for the MVP tables listed in docs/implementation-readiness.md.
- Add local/test database environment examples without committing secrets.
- Add migration/schema check commands.
- Add narrow schema tests or migration smoke checks.

Do not:
- Create API routes.
- Create frontend screens.
- Implement auth provider behavior.
- Implement file storage.
- Implement imports.
- Add billing provider integration.
- Move or rewrite the existing local app.

Requirements:
- Use PostgreSQL-ready schema.
- Use UUID primary keys for SaaS records.
- Use integer cents for money.
- Preserve legacy ids only in metadata fields.
- Include workspace scoping.
- Include owner/editor/viewer membership role support.
- Keep admin role deferred unless schema enum planning requires a reserved value.
- Include indexes needed for compact grids and dynamic filters.
- Keep raw object storage keys server-side only.
- Add tests/checks for migration up and core constraints.

Before editing, inspect package.json, docs/stack-decision.md, docs/saas-schema.md, and current test scripts.
After editing, run relevant checks and summarize files changed, checks run, and remaining risks.
```

## Implementation Risks To Watch

- Accidentally breaking current local app scripts while adding workspaces.
- Moving `backend/domain` too early.
- Duplicating model rules without tests.
- Allowing local file ids or object storage keys into client API shapes.
- Creating migrations that assume final auth/billing/storage providers.
- Overbuilding import or billing before the core paid workflow exists.
- Introducing product copy that implies professional conclusions.

## Readiness Status

Ticket 1 readiness:

- Complete once `docs/stack-decision.md`, `docs/local-dev-workflow.md`, `docs/environment-and-secrets-plan.md`, and this document are created and checked.

Ticket 2 readiness:

- Ready to start after confirming the migration tool choice and local PostgreSQL setup.

