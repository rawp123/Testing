# Environment And Secrets Plan

This document defines expected environment variables and secret-handling rules for the future Home Ledger SaaS MVP. It is a plan only. It does not add `.env` files, dependencies, routes, migrations, or runtime behavior.

## Confirmed Current Environment

Current `.env.example` is release/signing oriented for the local Mac app. It includes Apple Developer signing and notarization variables. It does not define SaaS database, auth, storage, billing, or OCR settings.

Current signing secrets must stay outside Git:

- `CSC_NAME`
- `APPLE_NOTARIZE_KEYCHAIN_PROFILE`
- `APPLE_NOTARIZE_KEYCHAIN`
- `APPLE_API_KEY`
- `APPLE_API_KEY_ID`
- `APPLE_API_ISSUER`
- `APPLE_ID`
- `APPLE_APP_SPECIFIC_PASSWORD`
- `APPLE_TEAM_ID`
- legacy Apple keychain aliases

## Environment Separation

Recommended environments:

- `local`
- `test`
- `staging`
- `production`

Each environment must have separate:

- Database.
- File/object storage location.
- Auth provider configuration.
- Session secrets.
- Billing credentials, when billing is added.
- OCR/extraction credentials, if a provider is added later.

Production secrets must never be usable by local development tests.

## Required Core Variables

Recommended core app variables:

| Variable | Required where | Purpose | Local default |
| --- | --- | --- | --- |
| `APP_ENV` | all | `local`, `test`, `staging`, `production` | `local` |
| `NODE_ENV` | all | Node runtime mode | `development` |
| `PORT` | API local/staging/prod | API port | `4000` |
| `APP_BASE_URL` | web/API | Public web app URL | `http://localhost:5173` |
| `API_BASE_URL` | web/API | Public API URL | `http://localhost:4000` |
| `LOG_LEVEL` | all | Log verbosity | `info` |
| `REQUEST_ID_HEADER` | API | Optional upstream request id header | `x-request-id` |

Rules:

- `APP_ENV=production` must disable dev auth and test bypasses.
- Logs must not include sensitive field values.

## Database Variables

Recommended database variables:

| Variable | Required where | Purpose | Local default |
| --- | --- | --- | --- |
| `DATABASE_URL` | API/dev/staging/prod | Primary PostgreSQL connection | `postgres://home_ledger:home_ledger@localhost:5432/home_ledger_dev` |
| `TEST_DATABASE_URL` | tests | Test PostgreSQL connection | `postgres://home_ledger:home_ledger@localhost:5432/home_ledger_test` |
| `DB_SSL_MODE` | staging/prod | SSL mode if not encoded in URL | provider-specific |
| `DB_POOL_MAX` | API | Max database connections | `10` |
| `MIGRATIONS_TABLE` | API/migration | Migration state table | `pgmigrations` |

Rules:

- Never run tests against `DATABASE_URL`.
- Never commit real database URLs.
- Staging and production databases must be separate.
- Migration commands must print target environment clearly without printing credentials.

## Auth Variables

No final auth provider is chosen in Ticket 1.

Recommended provider-neutral variables:

| Variable | Required where | Purpose | Local default |
| --- | --- | --- | --- |
| `AUTH_PROVIDER` | API | `dev`, future provider name | `dev` |
| `DEV_AUTH_ENABLED` | local/test only | Enables dev auth | `true` locally, `false` elsewhere |
| `DEV_AUTH_EMAIL` | local only | Dev user email | `dev@example.test` |
| `DEV_AUTH_DISPLAY_NAME` | local only | Dev display name | `Local Developer` |
| `SESSION_COOKIE_NAME` | API/web | Cookie name if cookies are used | `home_ledger_session` |
| `SESSION_SECRET` | API | Local session signing if applicable | generated local secret |
| `AUTH_ISSUER` | staging/prod later | Managed auth issuer | unset |
| `AUTH_AUDIENCE` | staging/prod later | Managed auth audience | unset |
| `AUTH_JWKS_URL` | staging/prod later | Managed auth keys | unset |

Rules:

- `DEV_AUTH_ENABLED=true` must be rejected in production.
- API handlers must use server-verified auth context, not client-provided user ids.
- Managed provider tokens must not be logged.

## Workspace Authorization Variables

No separate variables should grant authorization.

Authorization must come from:

- Authenticated user id.
- Database workspace membership.
- Role checks.

Do not add environment variables such as `ADMIN_USER_IDS` for MVP unless a later support/admin policy explicitly approves it.

## File Storage Variables

Recommended storage abstraction variables:

| Variable | Required where | Purpose | Local default |
| --- | --- | --- | --- |
| `FILE_STORAGE_DRIVER` | API | `local`, `s3-compatible` | `local` |
| `LOCAL_FILE_STORAGE_DIR` | local/test | Local document files | `.data/home-ledger/files` |
| `LOCAL_EXPORT_STORAGE_DIR` | local/test | Local export files | `.data/home-ledger/exports` |
| `LOCAL_IMPORT_STORAGE_DIR` | local/test | Temporary import uploads | `.data/home-ledger/imports` |
| `MAX_DOCUMENT_FILE_SIZE_BYTES` | API | Max uploaded document size | `26214400` |
| `MAX_BACKUP_FILE_SIZE_BYTES` | API | Max backup import file size | `524288000` |
| `SIGNED_UPLOAD_TTL_SECONDS` | API | Upload URL lifetime | `600` |
| `SIGNED_DOWNLOAD_TTL_SECONDS` | API | Download URL lifetime | `300` |

Recommended future S3-compatible variables:

| Variable | Required where | Purpose |
| --- | --- | --- |
| `S3_ENDPOINT` | staging/prod if S3-compatible | Object storage endpoint |
| `S3_REGION` | staging/prod if S3-compatible | Object storage region |
| `S3_BUCKET_DOCUMENTS` | staging/prod if S3-compatible | Document file bucket |
| `S3_BUCKET_EXPORTS` | staging/prod if S3-compatible | Export file bucket |
| `S3_BUCKET_IMPORTS` | staging/prod if S3-compatible | Temporary import bucket |
| `S3_ACCESS_KEY_ID` | staging/prod if static keys used | Storage access key |
| `S3_SECRET_ACCESS_KEY` | staging/prod if static keys used | Storage secret |
| `S3_FORCE_PATH_STYLE` | local/MinIO if used | Path-style addressing |

Rules:

- Never expose `storage_key` to clients.
- Never log signed URL query strings.
- Never commit local `.data` files.
- Store provider credentials in deployment secret manager.

## File Policy Variables

Recommended:

| Variable | Required where | Purpose | Local default |
| --- | --- | --- | --- |
| `BLOCKED_FILE_EXTENSIONS` | API | Comma-separated blocked extensions | local backup blocked list |
| `BLOCKED_MIME_PREFIXES` | API | Comma-separated blocked MIME prefixes | local backup blocked list |
| `FILE_SCAN_MODE` | API | `disabled`, `metadata_only`, `provider` | `disabled` local |
| `DOWNLOAD_REQUIRES_SCAN_PASS` | API | Gate downloads on scan status | `false` local |

Decision points:

- Whether production requires malware scanning before download.
- Whether SaaS blocked file rules exactly match local backup restore rules.

## Export Variables

Recommended:

| Variable | Required where | Purpose | Local default |
| --- | --- | --- | --- |
| `EXPORT_STORAGE_DRIVER` | API | Usually same as file storage | `local` |
| `EXPORT_TTL_SECONDS` | API | Export expiration | `604800` |
| `EXPORT_MAX_ROWS` | API | Safety cap for CSV rows | product decision |
| `EXPORT_INCLUDE_OCR_TEXT` | API | Whether OCR can be exported | `false` |

Rules:

- Export downloads are sensitive and should be audited.
- Exports should expire by default.
- Export content must preserve product boundary language.

## Import Variables

Recommended:

| Variable | Required where | Purpose | Local default |
| --- | --- | --- | --- |
| `IMPORT_STORAGE_DRIVER` | API | Temporary backup upload storage | `local` |
| `IMPORT_RAW_RETENTION_SECONDS` | API | Raw backup retention after import | product decision |
| `IMPORT_ACCEPT_BLANK_CHECKSUMS` | API | Default blank checksum policy | `false` until decided |
| `IMPORT_DEFAULT_DUPLICATE_STRATEGY` | API | Repeated import default | `detect_only` |
| `IMPORT_MAX_BACKUP_SIZE_BYTES` | API | Backup size cap | `524288000` |

Rules:

- Import backups can contain all user records and file contents.
- Raw backup uploads should be temporary.
- Import warnings must not be sent to analytics with sensitive values.

## Billing Variables

Billing is design-level only until a provider is chosen.

Reserved variables:

| Variable | Required where | Purpose |
| --- | --- | --- |
| `BILLING_PROVIDER` | later | `none`, `stripe`, `app_store`, etc. |
| `STRIPE_SECRET_KEY` | later if Stripe | Stripe secret key |
| `STRIPE_WEBHOOK_SECRET` | later if Stripe | Stripe webhook verification |
| `BILLING_PORTAL_RETURN_URL` | later | Return URL |
| `DEFAULT_PLAN_CODE` | later | Starter plan |

Rules:

- Billing secrets must never be committed.
- Provider ids should not appear in normal client responses unless needed.

## OCR Variables

OCR is MVP-minimum status/placeholder unless manual OCR is intentionally included.

Reserved variables:

| Variable | Required where | Purpose |
| --- | --- | --- |
| `OCR_MODE` | later | `disabled`, `local`, `provider` |
| `OCR_PROVIDER` | later | Provider name if used |
| `OCR_API_KEY` | later | Provider credential |
| `OCR_MAX_FILE_SIZE_BYTES` | later | OCR-specific file limit |
| `OCR_SEARCH_ENABLED` | later | Full-text OCR search gate |

Rules:

- OCR text is sensitive.
- OCR provider credentials must never be committed.
- Do not send OCR text to analytics.

## Analytics Variables

Analytics is not required for MVP core functionality.

Reserved variables:

| Variable | Required where | Purpose |
| --- | --- | --- |
| `ANALYTICS_ENABLED` | optional | Enable privacy-safe analytics |
| `ANALYTICS_PROVIDER` | optional | Provider name |
| `ANALYTICS_WRITE_KEY` | optional | Provider key |

Rules:

- Do not send property addresses, vendor names, amounts, document names, notes, OCR text, exports, imports, or object storage keys.
- Analytics should use event names and aggregate counts only.

## Secrets That Must Never Be Committed

- Database URLs with real credentials.
- Session secrets.
- Auth provider client secrets.
- Storage access keys.
- Signed URL secrets.
- Billing provider secrets.
- OCR provider secrets.
- Apple signing/notarization credentials.
- Raw backups, exports, document files, OCR text, or private fixtures.
- `.data/` local storage contents.

## Recommended Future `.env.example` Shape

When SaaS scaffolding begins, create a SaaS-specific example such as `apps/api/.env.example` or `.env.saas.example`:

```bash
APP_ENV=local
NODE_ENV=development
PORT=4000
APP_BASE_URL=http://localhost:5173
API_BASE_URL=http://localhost:4000

DATABASE_URL=postgres://home_ledger:home_ledger@localhost:5432/home_ledger_dev
TEST_DATABASE_URL=postgres://home_ledger:home_ledger@localhost:5432/home_ledger_test

AUTH_PROVIDER=dev
DEV_AUTH_ENABLED=true
DEV_AUTH_EMAIL=dev@example.test
DEV_AUTH_DISPLAY_NAME=Local Developer
SESSION_COOKIE_NAME=home_ledger_session
SESSION_SECRET=replace-with-local-dev-secret

FILE_STORAGE_DRIVER=local
LOCAL_FILE_STORAGE_DIR=.data/home-ledger/files
LOCAL_EXPORT_STORAGE_DIR=.data/home-ledger/exports
LOCAL_IMPORT_STORAGE_DIR=.data/home-ledger/imports
MAX_DOCUMENT_FILE_SIZE_BYTES=26214400
MAX_BACKUP_FILE_SIZE_BYTES=524288000
SIGNED_UPLOAD_TTL_SECONDS=600
SIGNED_DOWNLOAD_TTL_SECONDS=300

BILLING_PROVIDER=none
OCR_MODE=disabled
ANALYTICS_ENABLED=false
```

This example must not replace the existing Mac signing `.env.example` unless the file is intentionally reorganized later.

## Production Readiness Rules

Before production:

- `DEV_AUTH_ENABLED` must be false.
- `SESSION_SECRET` must come from secret manager.
- `DATABASE_URL` must use production database credentials.
- Storage credentials must use least privilege.
- File download/upload signed URL TTLs must be short.
- Raw object keys must not appear in API responses.
- Sensitive logs must be redacted.
- Billing/OCR/analytics must be disabled unless configured deliberately.

