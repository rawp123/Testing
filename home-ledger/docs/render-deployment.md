# Render Deployment Skeleton

This guide describes the Render service layout for a first hosted Home Ledger SaaS beta. It does not deploy anything, add provider SDKs, add secrets, change runtime behavior, or make production auth, billing, OCR, import, or storage integrations live.

Home Ledger organizes home records for professional review. Deployment docs and service names should preserve that boundary and avoid tax, legal, accounting, or compliance conclusions.

## Current Recommendation

Use Render for the first hosted beta skeleton:

- API: one Render web service running the Fastify API.
- Web: one Render static site serving the Vite build.
- Database: one Render Postgres database for the beta environment.
- Storage: AWS S3 or another verified S3-compatible provider, configured through environment variables.
- Auth: `AUTH_PROVIDER=none` until the Clerk proof of concept and production adapter are implemented.
- Billing: `BILLING_PROVIDER=none` for private beta.
- OCR: `OCR_MODE=disabled` for private beta.

This deployment skeleton can prove build/start commands, database migrations, static hosting, service routing, and health checks. It is not production-ready until production auth, storage credentials, backup/restore, and deployed QA are complete.

Official Render references used for this skeleton:

- [Blueprint YAML reference](https://render.com/docs/blueprint-spec)
- [Static sites](https://render.com/docs/static-sites/)
- [Static site redirects and rewrites](https://render.com/docs/redirects-rewrites/)
- [Monorepo support](https://render.com/docs/monorepo-support)
- [Environment variables](https://render.com/docs/environment-variables)
- [Render Postgres](https://render.com/docs/postgresql)

## Service Layout

| Render resource | Suggested name | Type | Repo root directory | Build command | Start / publish |
| --- | --- | --- | --- | --- | --- |
| API | `home-ledger-api` | Web service, Node runtime | `home-ledger` | `npm install` | `npm run start:api` |
| Web | `home-ledger-web` | Static site | `home-ledger` | `npm install && npm run build:web` | Publish `apps/web/dist` |
| Database | `home-ledger-beta-db` | Render Postgres | n/a | n/a | Internal connection string to API |

Use the Render dashboard or a reviewed Blueprint. Because the Git root also contains sibling repos, set each Render service root directory to `home-ledger`.

## Blueprint Example

An example Blueprint is provided at `docs/render-blueprint.example.yaml`.

It is intentionally not a root `render.yaml`. A root Blueprint could be interpreted by Render as active infrastructure before the app is ready. Treat the example as a review artifact, then copy and adjust it only when the team is ready to create real Render resources.

Before using the example:

- Replace placeholder service names if needed.
- Replace the static-site API rewrite destination with the actual API service URL.
- Enter storage credentials in Render, not in Git.
- Confirm the database plan, region, backup posture, and restore path.
- Confirm whether automatic deploys should be enabled for the selected branch.

## API Service

Recommended setup:

- Service type: Web Service.
- Runtime: Node.
- Root directory: `home-ledger`.
- Build command: `npm install`.
- Pre-deploy command: `npm run saas:db:migrate`.
- Start command: `npm run start:api`.
- Health check path: `/health`.
- Readiness check path for manual verification: `/ready`.

`/health` is the Render health path because it only confirms the process can serve traffic. `/ready` is stricter and will return `not_ready` until production auth is implemented and required services are configured.

Do not run `npm run seed:api:dev` against production. The seed command is local-only and exists to create a dev user/workspace for local review. If a private beta demo workspace is needed, create it through an explicit, reviewed process after production auth exists.

## Web Static Site

Recommended setup:

- Service type: Static Site.
- Root directory: `home-ledger`.
- Build command: `npm install && npm run build:web`.
- Publish directory: `apps/web/dist`.
- Build-time API base URL: `VITE_API_BASE_URL=/api/v1`.

The current web client defaults to `/api/v1`. The current API does not expose a production CORS allowlist. For this skeleton, keep browser requests same-origin by adding a Render static-site rewrite:

| Source | Destination |
| --- | --- |
| `/api/v1/*` | `https://REPLACE_WITH_API_SERVICE.onrender.com/api/v1/*` |
| `/*` | `/index.html` |

The first rewrite forwards API calls from the web domain to the API service without changing the browser-facing path. The second rewrite preserves client-side routing for the Vite app.

If a later ticket uses an absolute `VITE_API_BASE_URL` that points directly at the API service, add and test a production CORS allowlist first.

## Render Postgres

Recommended setup:

- Create one Render Postgres database for the beta environment.
- Use the internal connection string for the API `DATABASE_URL` when the API is in the same Render region.
- Run migrations through the API service pre-deploy command or a manual one-off command before opening traffic.
- Verify backups, restore process, connection limits, maintenance behavior, and retention before adding real beta users.

Do not run `saas:db:reset:test` against Render Postgres. That command is for isolated local/test databases only.

## Environment Variable Matrix

| Variable | Owner | Local required | Render beta required | Secret | Safe example format | Readiness impact |
| --- | --- | --- | --- | --- | --- | --- |
| `APP_ENV` | API | Optional | Yes | No | `production` | Production mode enforces stricter service readiness. |
| `NODE_ENV` | API | Optional | Yes | No | `production` | Used as runtime mode and `APP_ENV` fallback. |
| `PORT` | API/Render | No | No | No | Render sets this for web services | API reads it if present; Render default is acceptable. |
| `DATABASE_URL` | Database/API | Yes | Yes | Yes | Render database connection string reference | Required for config and database readiness. |
| `DB_POOL_MAX` | API/database | Optional | Optional | No | `10` | Config validation only. |
| `MIGRATIONS_TABLE` | API migrations | Optional | Optional | No | `pgmigrations` | Migration tooling only. |
| `REQUEST_ID_HEADER` | API | Optional | Optional | No | `x-request-id` | Error/readiness metadata only. |
| `AUTH_PROVIDER` | Auth/API | Optional | Yes | No | `none` until adapter exists | `none` is `not_ready` in production. |
| `DEV_AUTH_ENABLED` | Auth/API | Optional | Yes | No | `false` | Must be false in production. |
| `DEV_AUTH_EMAIL` | Auth/API | Optional | No | No | `dev@example.test` | Local/dev only; do not use for beta auth. |
| `DEV_AUTH_DISPLAY_NAME` | Auth/API | Optional | No | No | `Local Developer` | Local/dev only. |
| `SESSION_COOKIE_NAME` | Auth/API | Optional | Optional | No | `home_ledger_session` | Future auth adapter may use it. |
| `FILE_STORAGE_DRIVER` | Storage/API | Optional | Yes | No | `s3` | Must be `s3` for production storage readiness. |
| `FILE_STORAGE_BUCKET` | Storage/API | No | Yes | Sensitive | bucket name managed outside Git | Required for `s3` readiness; never print value in output. |
| `FILE_STORAGE_REGION` | Storage/API | No | Yes | No | provider region/signing region | Required for `s3` readiness. |
| `FILE_STORAGE_ENDPOINT` | Storage/API | No | Provider-specific | Sensitive | S3-compatible endpoint URL | Optional for AWS S3; needed for some compatible providers. |
| `FILE_STORAGE_ACCESS_KEY_ID` | Storage/API | No | Yes | Yes | set in Render secret env var | Required for `s3` readiness. |
| `FILE_STORAGE_SECRET_ACCESS_KEY` | Storage/API | No | Yes | Yes | set in Render secret env var | Required for `s3` readiness. |
| `FILE_STORAGE_FORCE_PATH_STYLE` | Storage/API | Optional | Provider-specific | No | `false` | S3 URL behavior. |
| `FILE_STORAGE_UPLOAD_URL_TTL_SECONDS` | Storage/API | Optional | Optional | No | `600` | Config validation only. |
| `FILE_STORAGE_DOWNLOAD_URL_TTL_SECONDS` | Storage/API | Optional | Optional | No | `300` | Config validation only. |
| `OCR_MODE` | OCR/API | Optional | Yes | No | `disabled` | `disabled` is safe; fake/test are not production-ready. |
| `BILLING_PROVIDER` | Billing/API | Optional | Yes | No | `none` | Disabled billing is acceptable for readiness. |
| `ANALYTICS_ENABLED` | API/ops | Optional | Optional | No | `false` | No current readiness impact. |
| `VITE_API_BASE_URL` | Web | Optional | Yes | No | `/api/v1` | Build-time API target for the static app. |

No CORS/origin environment variable exists today. If separate-origin API calls become necessary, add a dedicated allowlist config in a later ticket and test it with the deployed web origin.

## Deployment Order

1. Create the Render Postgres database.
2. Create the API web service with root directory `home-ledger`.
3. Add API environment variables, including `DATABASE_URL` from the Render database and storage placeholders/secrets.
4. Deploy the API and confirm `GET /health` returns `200`.
5. Run or confirm migrations using `npm run saas:db:migrate`.
6. Check `GET /ready` and record expected failures. Before auth integration, auth should still report `not_ready`.
7. Create the static web service with root directory `home-ledger`.
8. Set `VITE_API_BASE_URL=/api/v1`.
9. Add the static site rewrite from `/api/v1/*` to the API service URL.
10. Add the SPA rewrite from `/*` to `/index.html`.
11. Deploy the web service and confirm it loads.
12. Run visual QA against the deployed web URL after the API returns a usable authenticated session in a later auth ticket.

## Local Preflight

Run from `home-ledger` before attempting a Render deploy:

```sh
npm run check:web
npm run test:web
npm run build:web
npm run check:api
npm test
TEST_DATABASE_URL=<local-test-database-url> npm run test:api
DATABASE_URL=<local-test-database-url> npm run saas:deploy:check
```

The local deployment check uses local readiness rules unless `APP_ENV=production` is provided. Do not treat local/dev auth as production-ready.

## Hosted Verification

After the Render services exist:

```sh
curl -fsS https://REPLACE_WITH_API_SERVICE.onrender.com/health
curl -fsS https://REPLACE_WITH_API_SERVICE.onrender.com/ready
```

Expected skeleton result:

- `/health` should return `200`.
- `/ready` may return `503` until production auth exists.
- File storage should become `ok` only after S3-compatible storage is configured.
- OCR should be `disabled`.
- Billing should be `disabled`.
- Auth should remain `not_ready` until the Clerk proof of concept and adapter are implemented.

Do not paste real environment values, signed URLs, storage credentials, database URLs, provider errors, or OCR text into issue reports.

## Visual QA Against Render

After production auth can create a real beta session and the web app can load a workspace:

```sh
QA_SAAS_WEB_URL=https://REPLACE_WITH_WEB_SERVICE.onrender.com npm run qa:saas:web
```

Use a non-production QA account/workspace. Review generated screenshots manually before promoting the deployed environment.

## Rollback And Manual Checklist

Before beta access:

- Confirm the previous Render deploy is available for rollback.
- Confirm migrations are compatible with rollback expectations.
- Confirm database backup and restore steps have been reviewed.
- Confirm object storage bucket is private.
- Confirm signed URL TTLs are short.
- Confirm `/health` returns `200`.
- Confirm `/ready` output is safe and understood.
- Confirm the web static rewrite reaches the API.
- Confirm no dev seed data was added unintentionally.
- Confirm production auth is still clearly not live unless the auth provider ticket has been completed.
- Confirm billing, OCR provider, and import automation remain disabled/not connected unless later tickets explicitly implement them.

## Follow-Up Work

- Add production auth provider integration and session validation.
- Add explicit CORS allowlist only if same-origin static rewrites are not used.
- Add deployed environment visual QA once auth exists.
- Add backup/restore runbook with a tested restore.
- Add object storage lifecycle and cleanup policy.
- Add billing webhooks and entitlements only after auth is stable.
- Add OCR worker/queue only after storage and cost guardrails are stable.
