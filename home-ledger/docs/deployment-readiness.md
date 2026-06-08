# Home Ledger SaaS Deployment Readiness

This document describes the current deployment configuration contract for the Home Ledger SaaS API and web app. It is a readiness checklist only. It does not add a hosted deployment, production auth provider, Stripe, production OCR, import automation, or cloud-specific infrastructure.

Home Ledger organizes home records for professional review. Deployment copy and configuration should preserve that boundary and avoid tax, legal, accounting, or compliance conclusions.

## Runtime Services

Required for a production-like SaaS deployment:

- Node.js runtime for `apps/api`.
- PostgreSQL database with the current SaaS migrations applied.
- Static hosting for the `apps/web` Vite build.
- Private S3-compatible object storage for document file upload and download intents.

Optional or not connected in the current implementation:

- Production auth provider: not implemented yet. The API has a provider boundary and local/dev auth, but no real hosted sign-in flow.
- Billing provider: not implemented yet. Billing screens are frontend placeholders only.
- Production OCR provider: not implemented yet. `OCR_MODE=disabled` and deterministic fake/test modes exist.
- Import/migration automation: frontend skeleton only. No backend import parser or merge flow exists yet.

## API Environment Variables

Required:

```sh
APP_ENV=production
NODE_ENV=production
PORT=4000
DATABASE_URL=postgres://...
DEV_AUTH_ENABLED=false
```

Auth:

```sh
AUTH_PROVIDER=none
SESSION_COOKIE_NAME=home_ledger_session
```

`AUTH_PROVIDER=none` is the current explicit production-ready placeholder. Do not set `AUTH_PROVIDER=dev` or `DEV_AUTH_ENABLED=true` in production. The API refuses production dev auth.

File storage:

```sh
FILE_STORAGE_DRIVER=s3
FILE_STORAGE_BUCKET=...
FILE_STORAGE_REGION=...
FILE_STORAGE_ENDPOINT=
FILE_STORAGE_ACCESS_KEY_ID=...
FILE_STORAGE_SECRET_ACCESS_KEY=...
FILE_STORAGE_FORCE_PATH_STYLE=false
FILE_STORAGE_UPLOAD_URL_TTL_SECONDS=600
FILE_STORAGE_DOWNLOAD_URL_TTL_SECONDS=300
```

The bucket should be private. The API creates short-lived signed URLs for authorized file operations. Normal metadata responses must not expose raw object keys, bucket names, signed URLs, local paths, or provider internals.

OCR:

```sh
OCR_MODE=disabled
```

`OCR_MODE=fake` is deterministic and intended for local/test checks only. There is no production OCR provider integration yet.

Billing and analytics:

```sh
BILLING_PROVIDER=none
ANALYTICS_ENABLED=false
```

Billing is not connected. Do not claim checkout, subscription enforcement, invoices, or customer portal behavior exists until backend/provider work is implemented.

Database tuning:

```sh
DB_POOL_MAX=10
MIGRATIONS_TABLE=pgmigrations
```

## Web Environment Variables

The web app uses Vite. The only current API-facing web setting is:

```sh
VITE_API_BASE_URL=/api/v1
```

For local review against a separate API process:

```sh
VITE_API_BASE_URL=http://127.0.0.1:4000/api/v1
```

The web app does not implement production sign-in UI, native iOS wiring, import execution, billing checkout, or production OCR controls yet.

## Health And Readiness

Public liveness:

```text
GET /health
```

Returns `200` when the API process can respond. It does not check database or provider readiness.

Public readiness:

```text
GET /ready
```

Checks:

- required runtime configuration is present
- database connection can run a minimal query
- file storage mode is production-ready or degraded
- OCR mode is configured or disabled
- auth provider is configured or degraded
- billing provider is configured or disabled

Readiness responses are intentionally safe. They must not expose database URLs, passwords, tokens, raw auth headers, secret keys, storage keys, signed URLs, bucket names, provider internal errors, local absolute paths, raw OCR text, or billing provider internals.

`GET /ready` returns `503` if required checks fail or critical production dependencies are degraded. In the current skeleton, local/test file storage and missing production auth are reported as degraded.

## Deployment-Oriented Commands

Run from the repo root.

Build and test the web app:

```sh
npm run check:web
npm run test:web
npm run build:web
```

Check the API:

```sh
npm run check:api
npm run test:api
```

Run migrations against the target database:

```sh
DATABASE_URL=postgres://... npm run saas:db:migrate
```

Run the deployment readiness check:

```sh
DATABASE_URL=postgres://... npm run saas:deploy:check
```

For local production-like verification using the test database:

```sh
TEST_DATABASE_URL=postgres://home_ledger:home_ledger@localhost:5432/home_ledger_test npm run saas:db:reset:test
DATABASE_URL=postgres://home_ledger:home_ledger@localhost:5432/home_ledger_test FILE_STORAGE_DRIVER=s3 FILE_STORAGE_BUCKET=local-readiness FILE_STORAGE_REGION=us-east-1 FILE_STORAGE_ACCESS_KEY_ID=local-readiness FILE_STORAGE_SECRET_ACCESS_KEY=local-readiness AUTH_PROVIDER=oidc BILLING_PROVIDER=stripe npm run saas:deploy:check
```

The local production-like command only confirms configuration shape and database connectivity. It does not contact an auth provider, Stripe, object storage, or an OCR provider.

## Minimum Pre-Deployment Checklist

- Confirm `APP_ENV=production` and `NODE_ENV=production`.
- Confirm `DEV_AUTH_ENABLED=false`.
- Confirm migrations have been applied to the target database.
- Confirm `DATABASE_URL` is stored in a secret manager and is not printed in logs.
- Confirm `FILE_STORAGE_DRIVER=s3` and the bucket is private.
- Confirm signed URL TTLs are no longer than needed.
- Confirm `OCR_MODE=disabled` unless a production OCR provider has been explicitly implemented.
- Confirm `BILLING_PROVIDER=none` unless backend billing/provider work has been explicitly implemented.
- Confirm web hosting routes `/api/v1` to the API or set `VITE_API_BASE_URL` appropriately at build time.
- Run the verification commands listed above.

## Current Deferred Production Work

- Production auth provider and sign-in/session UI.
- Billing provider, entitlement enforcement, checkout, and portal links.
- Production OCR provider and async worker queue.
- Import parser, preview, confirm, and migration audit trail.
- Cloud object cleanup jobs for replaced/deleted files.
- Support/admin tooling and audited support access.
- Deployment target selection, infrastructure code, CI workflow, and domain/TLS setup.
