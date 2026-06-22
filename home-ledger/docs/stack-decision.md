# Stack Decision

This memo completes Ticket 1: Repo And Stack Decision Checkpoint. It is a decision document only. It does not create migrations, routes, frontend screens, scaffolds, dependencies, or runtime behavior.

## Sources Inspected

Confirmed repo facts:

- `AGENTS.md`
- `README.md`
- `package.json`
- `.env.example`
- `backend/README.md`
- `backend/domain/model.js`
- `backend/domain/backup.js`
- `backend/storage/document-storage.js`
- `backend/storage/records-storage.js`
- `desktop/package.json`
- `frontend/app.js`
- `frontend/index.html`
- `frontend/styles.css`
- `tests/*.test.mjs`
- `scripts/*.mjs`
- `scripts/*.cjs`
- `docs/ARCHITECTURE.md`
- `docs/DATA_SAFETY.md`

Primary planning context:

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

## Confirmed Repo Facts

- The current product is a local-first Home Basis Tracker app, not a SaaS app.
- The root package is private, ESM-based, and currently named `home-basis-tracker-web`.
- The current browser app is plain HTML/CSS/JavaScript in `frontend/`.
- The current local domain layer is in `backend/domain/`.
- The current storage adapters are local/browser/Electron bridge code in `backend/storage/`.
- The current desktop app is Electron under `desktop/`.
- The current test suite uses Node's built-in test runner through `npm test`.
- Current root scripts include `npm run check:syntax`, `npm run check:model`, render QA, beta QA, and desktop smoke/package commands.
- The current app has no account system, no cloud backend, no server-side storage, no payment flow, no cloud OCR, and no analytics.
- Existing domain logic for sanitization, backup validation, follow-up generation, and export behavior is valuable source behavior for the SaaS transition.
- Existing local app behavior must remain working unless a future task explicitly migrates or retires it.

## Recommendation Summary

Recommended structure:

Create a transitional apps/packages structure inside the current repo in a later implementation ticket, while preserving the current local app paths and behavior.

Recommended future shape:

```text
home-ledger/
  frontend/                 # existing local web app, unchanged for now
  backend/                  # existing local domain/storage modules, unchanged for now
  desktop/                  # existing Electron app, unchanged for now
  website/                  # existing product website
  apps/
    api/                    # future SaaS REST API service
    web/                    # future SaaS React/Vite web app
  packages/
    domain/                 # future shared pure model/follow-up/export logic
    config/                 # future shared env/config parsing
    test-utils/             # future API/db test helpers
  docs/
  tests/
```

Recommended backend:

- Node.js TypeScript API service.
- Separate API service, not Next.js route handlers.
- Use a lightweight HTTP framework such as Fastify, selected during implementation.
- Keep REST-style API paths from `docs/api-contract.md`.

Recommended web frontend:

- React + Vite + TypeScript in `apps/web`.
- Keep existing local `frontend/` app untouched.
- Reuse visual/product rules from the current app, but do not copy local storage assumptions.

Recommended database and migrations:

- PostgreSQL.
- Explicit SQL migrations through a migration tool, recommended: `node-pg-migrate`.
- Runtime database access can start with `pg` plus small repository modules.
- Defer ORM adoption unless complexity requires it.

Recommended auth/session integration point:

- No final auth vendor in Ticket 1.
- Implement a provider-neutral authenticated request context in Ticket 3.
- Use a dev-only local auth adapter for local development and tests.

## Repository Structure Options

### Option 1: Keep SaaS Work Inside Current Root Folders

Description:

Add SaaS API and web code directly into current `backend/` and `frontend/` folders.

Advantages:

- Lowest initial folder churn.
- Easy access to existing local domain modules.
- Familiar paths for current app work.

Disadvantages:

- High risk of mixing local-only browser/Electron storage assumptions into cloud code.
- Harder to keep local app stable while SaaS work is under construction.
- `frontend/` would need to support both local app and SaaS app patterns.
- Cloud authorization and file-intent code could be confused with local storage adapters.

Migration risk:

- High. The SaaS app could accidentally alter local app behavior or copy local-only assumptions into cloud code.

Testing impact:

- Existing tests may become noisy because local and SaaS code would share folders.
- Harder to target app-specific checks.

Ability to preserve current local app:

- Weak. Possible, but risky.

Ability to reuse domain/model/backup/follow-up/export logic:

- Strong access, weak boundaries.

Recommendation:

- Do not choose this option.

### Option 2: Create A Full Monorepo Structure Inside Current Repo Immediately

Description:

Move current local app into `apps/local`, move shared code into `packages/domain`, and add `apps/api` and `apps/web`.

Advantages:

- Clean final architecture.
- Clear package boundaries.
- Easy to reason about SaaS versus local app ownership after the move.

Disadvantages:

- Broad file movement before SaaS implementation.
- High chance of breaking current local web/Electron packaging paths.
- Large review diff.
- Violates the current preference for small, reviewable changes.

Migration risk:

- Medium to high because packaging and path assumptions are currently working.

Testing impact:

- Requires updating many scripts and package paths before product work can start.
- Existing QA and desktop packaging could break from path changes.

Ability to preserve current local app:

- Good after successful migration, but risky during transition.

Ability to reuse domain/model/backup/follow-up/export logic:

- Strong after extraction.

Recommendation:

- Do not choose this as the first step.

### Option 3: Create A Separate SaaS Repo

Description:

Leave this repo as the local app and start Home Ledger SaaS in a separate repository.

Advantages:

- Strong isolation.
- No risk of accidentally breaking the local app.
- Clean SaaS history and package setup.

Disadvantages:

- Harder to reuse and test existing domain, backup, follow-up, and export behavior.
- Documentation and source-of-truth drift risk.
- Migration logic would need copied or packaged across repos.
- Small-team overhead: two repos, two issue flows, two CI setups.

Migration risk:

- Medium. Local app is safe, but behavior drift is likely unless shared code is packaged carefully.

Testing impact:

- Requires duplicating or publishing shared fixtures/domain behavior.

Ability to preserve current local app:

- Strong.

Ability to reuse domain/model/backup/follow-up/export logic:

- Weak unless a shared package is created later.

Recommendation:

- Do not choose this unless product/legal release separation becomes a hard requirement.

### Option 4: Transitional `apps/` Structure While Preserving Existing Local App

Description:

Keep the current local app exactly where it is. Add future SaaS code under `apps/api` and `apps/web`. Extract or wrap reusable pure domain logic into `packages/domain` only when needed.

Advantages:

- Preserves current local app paths and scripts.
- Gives SaaS code a clean boundary.
- Supports small, reviewable tickets.
- Lets the API and web app evolve without rewriting the local app.
- Allows careful extraction of shared logic after tests are in place.
- Keeps future iOS API needs separate from the browser app.

Disadvantages:

- Temporary duplication of some local app concepts is likely.
- Root scripts and package management need workspace setup later.
- Shared domain extraction must be disciplined to avoid breaking local app imports.

Migration risk:

- Low to medium. Local app remains stable; SaaS gets clean folders. The main risk is later shared package extraction.

Testing impact:

- Positive. Existing local tests can remain, while future `apps/api` and `apps/web` tests can be scoped.

Ability to preserve current local app:

- Strong.

Ability to reuse domain/model/backup/follow-up/export logic:

- Strong, with controlled extraction or adapters.

Recommended choice:

- Choose this option.

## Backend Stack Decision

### Evaluated Option: Node/TypeScript API

Advantages:

- Fits existing JavaScript domain knowledge while adding type safety for SaaS boundaries.
- Works well with REST API contract.
- Supports future iOS client without coupling API to web routes.
- Good fit for workspace authorization middleware, file intents, exports, import jobs, and tests.
- Lets shared domain logic remain JavaScript initially and migrate to TypeScript gradually.

Disadvantages:

- Requires TypeScript tooling not currently in the repo.
- Requires future build/test setup for `apps/api`.

Recommendation:

- Choose Node/TypeScript API.

### Evaluated Option: Plain Node/JavaScript API

Advantages:

- Closest to current repo style.
- Fewer new tools.
- Could reuse existing modules directly.

Disadvantages:

- SaaS schema/API surface is larger and security-sensitive enough that types are useful.
- Harder to enforce request/response contracts, auth context, and repository shapes.

Recommendation:

- Do not choose for SaaS API. Keep existing local app JavaScript intact.

### Evaluated Option: Next.js Full-stack App

Advantages:

- One framework for web and API.
- Good deployment ecosystem.
- Easy first screens.

Disadvantages:

- API routes can become web-coupled.
- Future iOS API behavior benefits from a distinct API service.
- Background exports/imports/file-intents can outgrow route-handler patterns.
- It may encourage mixing frontend and backend concerns too early.

Recommendation:

- Do not choose for MVP unless deployment platform strongly requires it.

### Evaluated Option: Separate API Service Plus Web SPA

Advantages:

- Clean API contract for web and future iOS.
- Clear workspace authorization boundary.
- Easier file intent model.
- Easier to test API without rendering web.
- Keeps frontend deployment and API deployment independently understandable.

Disadvantages:

- Two apps to run locally.
- Needs CORS/cookie/token decisions.
- Slightly more setup than a full-stack framework.

Recommendation:

- Choose this architecture.

### Recommended Backend Framework Or Minimal Server Approach

Recommended:

- `apps/api`: Node.js + TypeScript + Fastify-style lightweight HTTP server.
- Request context: provider-neutral authenticated user injected by auth middleware.
- Data access: repository modules backed by PostgreSQL through `pg`.
- Migrations: explicit SQL migrations with `node-pg-migrate`.
- Jobs: start in-process for export/import MVP, but isolate behind job service interfaces so a queue can be added later.

Why it fits MVP:

- Small enough for solo/small-team development.
- Explicit enough for sensitive authorization and file handling.
- Supports the REST API contract.
- Does not force a large framework or cloud provider.

How it supports required SaaS capabilities:

- Workspace authorization: shared middleware/helper around route handlers.
- File intents: API can create signed intent records without exposing storage keys.
- Exports: API can create export jobs and signed download URLs.
- Import: API can validate and transform backup payloads using shared domain logic.
- Future iOS: same API contract can serve mobile without a web framework dependency.

## Web Frontend Decision

### Evaluated Option: Preserve/adapt Current Frontend Patterns

Advantages:

- Existing UI already has compact grids, modals, filters, dark/light work, and product copy improvements.
- No framework migration required.

Disadvantages:

- Current frontend is heavily local-app oriented.
- State and storage flows assume local app data, local document storage, and no auth.
- Scaling complex SaaS forms, API data fetching, optimistic updates, and route state will become harder.

Recommendation:

- Preserve visual/product patterns, not the implementation architecture.

### Evaluated Option: New Web App Package

Advantages:

- Clean SaaS data-fetching boundary.
- Can use typed API clients and component tests.
- Leaves current local app untouched.
- Can implement compact grids and anchored modals from the start without local storage assumptions.

Disadvantages:

- Requires a new build tool and component structure.
- Some existing CSS/interaction details must be recreated or ported carefully.

Recommendation:

- Choose this option.

### Evaluated Option: React/Vite

Advantages:

- Lightweight and conventional.
- Good fit for SPA consuming separate API.
- Works well with compact grids, filters, modals/drawers, and component tests.
- Avoids Next.js API coupling.

Disadvantages:

- Requires separate routing/data-fetching choices.
- Requires separate deployment story for API and web.

Recommendation:

- Choose React + Vite + TypeScript for `apps/web`.

### Evaluated Option: Next.js Frontend

Advantages:

- Strong app framework and routing.
- Could host app shell and SSR if needed.

Disadvantages:

- SSR is not required for the authenticated app MVP.
- Route handlers could blur the chosen separate API boundary.
- More framework surface than needed for compact authenticated grids.

Recommendation:

- Do not choose for MVP.

## Frontend Product Requirements To Preserve

The SaaS web app should preserve:

- Compact grids for record-heavy screens.
- Dynamic dependent filters.
- Filters visually separate from results.
- Anchored modals/drawers instead of disruptive page jumps.
- Project-centered follow-up resolution.
- Direct, mature copy.
- Dark/light readability.
- Dashboard Recent activity and Needs attention subtabs.

The SaaS web app must avoid copying:

- Browser `localStorage` as source of truth.
- IndexedDB document storage as the primary file store.
- Desktop bridge assumptions.
- Tutorial sample metadata as real file behavior.
- Local-only backup/restore replacement behavior as the cloud import model.

## Database And Migration Tooling Decision

Recommended database:

- PostgreSQL.

Why:

- Matches `docs/saas-schema.md`.
- Strong relational constraints for workspace scoping and record relationships.
- Good support for JSONB legacy metadata.
- Good indexing for compact grids and dynamic filters.
- Good operational path for SaaS MVP.

Recommended migration tool:

- `node-pg-migrate` with explicit SQL migrations.

Why:

- Small and direct.
- Keeps database changes reviewable.
- Avoids hiding sensitive relationship constraints behind ORM magic.
- Allows down migrations or documented no-down policies per migration.

Runtime data access recommendation:

- Start with `pg` and small repository modules.
- Avoid broad ORM adoption until the API proves its shape.
- Keep business rules in services/domain modules, not route handlers.

Local development database:

- PostgreSQL 16 or current stable Postgres.
- Prefer Docker Compose for consistent local setup, but allow a local Postgres service if the developer already uses one.
- Recommended local URLs are documented in `docs/local-dev-workflow.md`.

Test database:

- Separate `TEST_DATABASE_URL`.
- Tests should create isolated schemas, transactions, or reset fixtures between test files.
- Do not point tests at development or production databases.

Schema test approach:

- Migration smoke test: migrate a clean test database up.
- Constraint tests: workspace relationships, integer cents, primary property uniqueness, file metadata constraints.
- Authorization integration tests: every route uses workspace scoping.

Rollback/down migration policy:

- During MVP, every migration should either include a down migration or explicitly document why it is irreversible.
- Destructive migrations require a backup/export plan before staging/production use.

Seed/fixture approach:

- Keep small SaaS fixtures separate from local tutorial data.
- Use fixture builders in tests rather than importing tutorial sample data by default.
- Preserve local backup fixtures only for import/migration tests.

## Auth And Session Integration Decision

Final provider:

- Not chosen in Ticket 1.

Recommended temporary local/dev auth:

- Dev-only auth middleware enabled by `DEV_AUTH_ENABLED=true`.
- It creates or loads a deterministic local development user and workspace.
- It must be disabled in staging and production.
- It must not trust arbitrary client-supplied `user_id` in production mode.

Expected authenticated request context:

```json
{
  "auth": {
    "user_id": "uuid",
    "session_id": "dev-or-provider-session-id",
    "auth_provider": "dev",
    "auth_subject": "dev-user",
    "issued_at": "2026-06-06T12:00:00Z"
  }
}
```

How user identity reaches handlers:

- Auth middleware validates provider/dev session.
- Middleware attaches `request.auth`.
- Route handlers receive only `request.auth.user_id`, not raw provider tokens.
- Workspace helpers resolve memberships from the database.

How tests create auth context:

- API integration test helpers should create users/workspaces/memberships in the test database.
- Test requests should use a test auth helper/header accepted only in test mode.
- Unit tests should pass an explicit auth context object.

Future managed auth provider attachment:

- Provider callback/session verification attaches to the same auth middleware seam.
- Provider subject maps to internal `users` record.
- API handlers should not know which provider was used.

Must not be trusted:

- Client-provided user ids.
- Client-provided workspace roles.
- Client-provided entitlement status.
- Client-provided object storage keys.

## Workspace Authorization Decision

Recommended helper pattern:

- `requireAuth(request)`: returns authenticated user id or throws `401`.
- `loadWorkspaceMembership(userId, workspaceId)`: loads active membership.
- `requireWorkspaceRole(request, workspaceId, allowedRoles)`: enforces role.
- `assertWorkspaceRecord(workspaceId, record)`: ensures records belong to the active workspace.

MVP roles:

- `owner`: all workspace actions, billing/settings/deletion.
- `editor`: create/edit/delete records, upload files, run OCR if enabled, request exports.
- `viewer`: read records and limited downloads/exports if workspace settings allow.

Admin role:

- Out of MVP UI.
- Reserved in API docs for later.
- Do not implement admin-specific flows in first build unless a later task changes scope.

Consistent response behavior:

- `401`: no valid authenticated user.
- `403`: authenticated user has workspace membership but lacks required role.
- `404`: record not found in the authorized workspace, including cross-workspace record ids.
- Workspace membership absence can return `404` for workspace-specific resource routes to reduce enumeration.

Cross-workspace test strategy:

- Every workspace-scoped API should have tests with at least two workspaces.
- Tests should prove a user cannot list, read, update, delete, upload, download, export, or import against another workspace.
- File download URL endpoints need explicit cross-workspace tests.

## File Storage Decision

Recommended abstraction:

```text
FileStorage
  createUploadIntent(input)
  confirmUpload(input)
  createDownloadUrl(input)
  createPreviewUrl(input)
  deleteObject(input)
  headObject(input)
```

Local development storage:

- Use an app-controlled local storage directory such as `.data/home-ledger/files`.
- The API still returns upload/download intents, even if dev URLs are API-mediated.
- Do not expose filesystem paths to the browser client.

Production candidate abstraction:

- S3-compatible object storage behind the `FileStorage` interface.
- Provider choice can be AWS S3, Cloudflare R2, or another S3-compatible service later.
- API stores object keys server-side only.

Signed intent model:

- API creates upload intent after validating workspace/document/file metadata.
- Client uploads to signed URL or API-mediated dev URL.
- Client confirms upload.
- API creates/activates `document_files` row and updates `documents.file_availability`.
- Downloads/previews use short-lived signed URLs generated after authorization.

Raw object key exposure prevention:

- Never return `storage_key`.
- Never log signed URLs with sensitive query strings.
- Return `document_file_id`, file display metadata, status, and short-lived URL only.

File-size/type policy decision points:

- Start with 25 MB to match the local app unless product chooses otherwise.
- Use current blocked backup restore list as the minimum blocked type list.
- Keep file type and size limits in env/config, but enforce server-side.

Scanning policy decision points:

- MVP can store scan status fields and use `not_required` or `pending` locally.
- Production must decide whether malware scanning is required before downloads.
- If scanning is not ready, be explicit that private beta file handling uses type/size controls and authorized access, not full scanning.

## Testing Strategy Decision

Unit tests:

- Keep pure domain logic tests close to existing `tests/model.test.mjs` style.
- Port follow-up, backup, export, and mapping rules into shared package tests when extracted.

API integration tests:

- Use a test database.
- Test routes through HTTP-level request helpers.
- Assert error envelopes, status codes, validation, and response shapes.

Database/migration tests:

- Migrate a clean database up.
- Test constraints and indexes that affect core behavior.
- Use small seed fixtures.

Authorization tests:

- Each workspace-scoped resource should have owner/editor/viewer/no-membership tests.
- Include cross-workspace record id tests.
- Include file intent and export authorization tests.

File intent tests:

- Upload intent validates document ownership and file policy.
- Confirm upload handles stale/mismatched metadata.
- Download URL requires authorization.
- Responses never include raw storage keys.

Frontend/component tests:

- Test compact grids, dynamic filters, modal open/save/cancel, empty states, and accessible labels.
- Keep UI tests focused on behavior and readability, not brittle snapshots.

Visual/accessibility smoke strategy:

- Use browser/render QA for core screens once web app exists.
- Check light and dark mode.
- Check desktop and mobile widths.
- Check no text overflow in grids/forms/buttons.

Commands to run before Codex final responses:

Current docs-only or local-app changes:

```bash
git diff --check
npm run check:syntax
npm run check:model
npm test
```

Current UI changes:

```bash
npm run qa:render
npm run qa:beta
```

Current desktop packaging-sensitive changes:

```bash
npm run smoke:desktop
npm run smoke:packaged
npm run check:mac-package
```

Future SaaS changes should add package-specific commands after scaffold exists, for example:

```bash
npm --workspace apps/api test
npm --workspace apps/api run check
npm --workspace apps/web test
npm --workspace apps/web run build
```

## Alternatives Rejected

Rejected for Ticket 2 readiness:

- Rewriting the existing local app into the SaaS app.
- Moving local app directories before SaaS scaffold exists.
- Next.js full-stack as the default.
- Plain JavaScript API for the SaaS backend.
- A separate SaaS repo at this stage.
- Implementing iOS, sharing, reviewer portal, bank integrations, email import, advanced AI/OCR extraction, advanced billing matrix, or support console in MVP.

## Decision For Ticket 2

Ticket 2 should proceed assuming:

- Transitional apps/packages structure will be introduced when implementation starts.
- Existing local app paths stay intact.
- `apps/api` is the first SaaS implementation package.
- PostgreSQL is the database.
- `node-pg-migrate` is the migration tool.
- Migrations are explicit SQL and reviewable.
- Auth provider is still undecided, but a provider-neutral user/workspace schema is valid.
- Workspace roles for MVP are owner/editor/viewer.
- Admin role is deferred/reserved.

