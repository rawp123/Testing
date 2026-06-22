# Local Development Workflow

This document describes the recommended local development workflow for the future Home Ledger SaaS MVP while preserving the current local Home Basis Tracker app. It is a workflow document only and does not add scripts, dependencies, scaffolds, or runtime code.

## Confirmed Current Workflow

Current package manager:

- npm, with root `package.json` and `package-lock.json`.
- Desktop app has its own `desktop/package.json` and `desktop/package-lock.json`.

Current root scripts:

```bash
npm run dev
npm run start
npm run dev:website
npm run start:website
npm run check:syntax
npm run check:model
npm test
npm run qa:render
npm run qa:beta
npm run qa:private-documents
npm run smoke:desktop
npm run smoke:packaged
npm run smoke:dmg
npm run pack:mac
npm run check:mac-package
```

Current local app dev:

```bash
npm run dev
```

Current website dev:

```bash
npm run dev:website
```

Current desktop dev:

```bash
npm install --prefix desktop
npm --prefix desktop start
```

Confirmed current tests/checks:

```bash
npm test
npm run check:syntax
npm run check:model
```

## Recommended Future Workspace Workflow

When SaaS implementation begins, add npm workspaces rather than replacing current scripts.

Recommended future packages:

```text
apps/api
apps/web
packages/domain
packages/config
packages/test-utils
```

Recommended future root scripts:

```json
{
  "dev:api": "npm --workspace apps/api run dev",
  "dev:web": "npm --workspace apps/web run dev",
  "dev:saas": "run api and web dev processes",
  "test:api": "npm --workspace apps/api test",
  "test:web": "npm --workspace apps/web test",
  "check:saas": "run API and web checks"
}
```

The exact parallel runner should be chosen during implementation. Do not add a dependency solely for this document.

## Recommended Local Services

Required for SaaS development:

- PostgreSQL for app data.
- Local file storage directory for development file intents.

Optional later:

- S3-compatible local object storage such as MinIO, only if direct-to-object-store behavior must be tested locally.
- Mail catcher, only when invites/notifications are in scope.
- Billing webhook listener, only when billing provider is selected.

Recommended local database names:

```text
home_ledger_dev
home_ledger_test
```

Recommended local URLs:

```text
DATABASE_URL=postgres://home_ledger:home_ledger@localhost:5432/home_ledger_dev
TEST_DATABASE_URL=postgres://home_ledger:home_ledger@localhost:5432/home_ledger_test
```

Recommended macOS setup order:

1. Homebrew PostgreSQL.
2. Postgres.app.
3. Docker, only as an optional fallback if already used locally.

The canonical step-by-step setup lives in `apps/api/README.md`. It covers installing or starting PostgreSQL, creating the `home_ledger` role, creating `home_ledger_dev` and `home_ledger_test`, resetting the test schema, and running DB-backed checks.

After PostgreSQL is available locally, the expected verification sequence is:

```bash
TEST_DATABASE_URL=postgres://home_ledger:home_ledger@localhost:5432/home_ledger_test npm run saas:db:reset:test
TEST_DATABASE_URL=postgres://home_ledger:home_ledger@localhost:5432/home_ledger_test npm run test:api
TEST_DATABASE_URL=postgres://home_ledger:home_ledger@localhost:5432/home_ledger_test npm run saas:db:check
```

If these commands fail with `ECONNREFUSED`, the PostgreSQL server is not running or is not listening on `localhost:5432`.

Recommended local file storage:

```text
LOCAL_FILE_STORAGE_DIR=.data/home-ledger/files
LOCAL_EXPORT_STORAGE_DIR=.data/home-ledger/exports
LOCAL_IMPORT_STORAGE_DIR=.data/home-ledger/imports
```

These directories must remain ignored by Git.

## Recommended Daily Development Flow

For current local app work:

```bash
npm run dev
npm test
npm run check:syntax
npm run check:model
```

For future SaaS API work:

```bash
# start local PostgreSQL
# run migrations
# start API
# run API tests
```

Future command shape:

```bash
npm run db:migrate
npm run dev:api
npm run test:api
```

For future SaaS web work:

```bash
# start API
# start web app
# run component/render tests
```

Future command shape:

```bash
npm run dev:web
npm run test:web
```

For cross-layer SaaS work:

```bash
npm run check:saas
npm test
git diff --check
```

## Database Workflow Recommendation

Migration commands should be added in Ticket 2.

Recommended behavior:

- Migrations run against `DATABASE_URL`.
- Test migrations run against `TEST_DATABASE_URL`.
- Migration files are committed.
- Generated local database data is not committed.
- Destructive migrations require explicit notes and backup/export plan before production.

Recommended future commands:

```bash
npm run db:migrate
npm run db:rollback
npm run db:reset:test
npm run db:check
```

Rollback policy:

- During MVP, each migration should include a down migration unless irreversible by design.
- Irreversible migrations must say so in the migration file and release notes.

## Test Workflow Recommendation

Before each Codex final response for docs-only changes:

```bash
git diff --check
npm run check:syntax
npm run check:model
npm test
```

Before each Codex final response for API changes after SaaS scaffold exists:

```bash
git diff --check
npm run check:syntax
npm run check:model
npm test
npm run test:api
npm run check:api
npm run saas:db:check
```

`npm run test:api` includes fast API unit/route tests. DB-backed authorization tests require `TEST_DATABASE_URL`; without it, they skip with a message. To run the DB-backed authorization tests locally:

```bash
TEST_DATABASE_URL=postgres://home_ledger:home_ledger@localhost:5432/home_ledger_test npm run test:api
```

`npm run saas:db:check` also requires `TEST_DATABASE_URL` and refuses to run against `DATABASE_URL`.

Before each Codex final response for web UI changes after SaaS scaffold exists:

```bash
git diff --check
npm run check:syntax
npm run test:web
npm run build:web
```

Before each Codex final response for local app UI changes:

```bash
npm run qa:render
npm run qa:beta
```

Before desktop packaging-sensitive changes:

```bash
npm run smoke:desktop
npm run smoke:packaged
npm run check:mac-package
```

## Fixtures And Seed Data

Current local tutorial data:

- Useful for local app QA.
- Should not become default SaaS seed data.

Recommended SaaS fixtures:

- Small deterministic user/workspace/property/project/expense/document fixture builders.
- Separate import fixtures based on sanitized local backup JSON.
- No real private documents in committed fixtures.
- No OCR text that resembles private user data in committed fixtures.

Recommended seed behavior:

- Development seed creates one user, one workspace, one property, one project, one expense, and one document metadata row.
- Test seed should be per-test or reset between tests.

## Local Auth Workflow

Recommended dev behavior:

- `DEV_AUTH_ENABLED=true` enables a deterministic local dev user.
- API creates or loads the dev user and workspace.
- The web app can call `/api/v1/session` without a real provider in local dev.
- Test helpers create explicit users/workspaces/memberships.

Do not:

- Trust client-supplied `user_id`.
- Trust client-supplied role or entitlement.
- Enable dev auth in staging or production.

## Local File Workflow

Recommended dev behavior:

- API creates upload intent.
- Local dev upload writes to an app-managed `.data` directory through an API-mediated or signed-dev flow.
- API confirms upload and stores file metadata.
- Download/preview uses short-lived local URLs or API-mediated download.

Do not:

- Return local filesystem paths to the browser.
- Commit uploaded files.
- Reuse local app IndexedDB or Electron storage as SaaS file storage.

## Local Import Workflow

MVP import is conditional.

If beta migration is required:

- Use existing backup validation behavior as source.
- Store uploaded backup temporarily.
- Validate and preview before confirm.
- Keep file and record import outcomes visible.

If beta migration is not required:

- Keep import docs and placeholder.
- Do not block core SaaS workflow.

## Current Local App Preservation

Until explicitly retired or migrated:

- Keep `npm run dev` working for the current browser app.
- Keep `desktop/` packaging paths working.
- Keep current `backend/domain` behavior covered by existing tests.
- Avoid moving current files as part of early SaaS tickets.
- Extract shared code only behind tests and small reviewable diffs.

## Developer Checklist

Before starting a SaaS implementation ticket:

- Confirm the ticket is in `docs/implementation-sequence.md`.
- Confirm the feature is MVP-in in `docs/web-mvp-cutline.md`.
- Confirm it is not listed as deferred in `docs/deferred-scope.md`.
- Confirm relevant API/schema docs are aligned.
- Confirm local app behavior is not being changed accidentally.

Before finishing a SaaS implementation ticket:

- Run relevant package tests.
- Run root checks that still apply.
- Check `git diff --check`.
- Update docs if behavior changes.
- List files changed and checks run.
