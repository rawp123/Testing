# SaaS Deployment Target And Provider Decision Memo

This memo recommends a practical first hosted beta path for Home Ledger SaaS. It does not deploy the app, add provider SDKs, add infrastructure, change schema, or change runtime behavior.

Home Ledger organizes home records for professional review. The deployment stack should preserve that boundary and avoid claims about tax, legal, accounting, or compliance outcomes.

## Source Check

Current pricing, free-tier limits, regional availability, and vendor-specific limits can change. Verify those details directly before purchasing services or implementing providers. This memo uses current official documentation only for broad capability shape:

- Render docs: [web services](https://render.com/docs/web-services), [static sites](https://render.com/docs/static-sites), [environment variables](https://render.com/docs/environment-variables), [cron jobs](https://render.com/docs/cronjobs), and [PostgreSQL](https://render.com/docs/postgresql-creating-connecting).
- Fly.io docs: [secrets](https://fly.io/docs/secrets/), [volumes](https://fly.io/docs/volumes/overview/), and [database/storage guides](https://fly.io/docs/database-storage-guides/).
- Railway docs: [services](https://docs.railway.com/guides/services) and [PostgreSQL](https://docs.railway.com/databases/postgresql/).
- AWS docs: [RDS backup/restore](https://docs.aws.amazon.com/AmazonRDS/latest/gettingstartedguide/managing-backup-restore.html), [S3 presigned URLs](https://docs.aws.amazon.com/AmazonS3/latest/userguide/using-presigned-url.html), Secrets Manager/ECS-style secrets docs, and [Textract asynchronous processing](https://docs.aws.amazon.com/textract/latest/dg/api-async.html).
- Vercel and Netlify docs: [Vercel environment variables](https://vercel.com/docs/projects/environment-variables), [Netlify environment variables](https://docs.netlify.com/build/environment-variables/overview), and Netlify functions docs.
- Neon docs: [connection strings](https://neon.com/docs/get-started-with-neon/connect-neon) and [connection pooling](https://neon.com/docs/connect/connection-pooling).
- Supabase docs: [database](https://supabase.com/docs/guides/database/overview), [Auth](https://supabase.com/docs/guides/auth), and [Storage](https://supabase.com/docs/guides/storage).
- Cloudflare R2 and Backblaze B2 docs: [R2 S3 API](https://developers.cloudflare.com/r2/api/s3/), [R2 presigned URLs](https://developers.cloudflare.com/r2/api/s3/presigned-urls/), and [Backblaze B2 S3-compatible API](https://www.backblaze.com/b2/docs/s3_compatible_api.html).
- Clerk, Auth0, and Supabase Auth docs: [Clerk Backend API](https://clerk.com/docs/reference/api/overview), [Auth0 docs](https://auth0.com/docs/), and Supabase Auth docs.
- Stripe, Paddle, and Lemon Squeezy docs: [Stripe Billing](https://stripe.com/billing), [Stripe subscription webhooks](https://docs.stripe.com/billing/subscriptions/webhooks), [Paddle customer portal](https://developer.paddle.com/concepts/sell/customer-portal), [Paddle webhooks](https://developer.paddle.com/webhooks), and [Lemon Squeezy customer portal](https://docs.lemonsqueezy.com/help/online-store/customer-portal).

## Executive Recommendation

Recommended near-term stack for the first hosted beta:

- Deployment target: Render for the Fastify API and Vite static web app.
- Database: Render Postgres for the first beta, with a documented backup/export review before opening access beyond a small private group.
- Object storage: AWS S3 first, because the current API already implements S3-compatible presigned upload/download intents and S3 is the compatibility baseline for future iOS clients.
- Auth: Clerk as the preferred beta candidate after a focused proof of concept; Auth0 remains the heavier alternative if enterprise identity requirements appear.
- Billing: no live billing for private beta; use manual access control until production auth and entitlements are stable. Stripe Billing is the recommended first provider when billing is implemented.
- OCR: keep production OCR disabled for first beta. Pilot managed OCR later behind explicit limits, async jobs, and user-facing status.
- Email/notifications: defer unless auth or billing provider flows require sender configuration.
- Monitoring/logging: start with host logs plus a lightweight error reporting option after the deployed beta is stable.

Recommended later-production stack if needs grow:

- Keep Render if uptime, backup, and worker needs remain simple.
- Move Postgres to Neon or AWS RDS if stronger branching, pooling, restore, isolation, or operational controls become important.
- Keep S3 unless cost-control analysis justifies R2 or B2 and presigned browser/mobile flows pass QA.
- Keep the API provider-neutral so iOS can call the same Fastify API rather than a web-host-specific backend.
- Move to an AWS baseline only when the product needs tighter infrastructure control, deeper backup posture, private networking, queue-heavy OCR/import work, or a clearer operations budget.

Rationale:

- The existing app is a Node/Fastify API plus a Vite static web app. Render fits that shape without forcing serverless rewrites.
- The API already expects Postgres and has migration tooling.
- The file adapter already speaks S3-compatible signed URLs.
- Auth, billing, OCR, and import are not live yet; choosing providers before deploying infrastructure keeps the next tickets smaller.
- A low-ops beta host is better than premature cloud complexity for a solo/small-team product.

Explicit non-goals:

- No real provider integration in this ticket.
- No cloud config, Dockerfile, GitHub Actions, Terraform, or schema changes.
- No fake sign-in, billing, OCR, import, or production storage claims.
- No pricing commitment.

## Current App Constraints

- API: Fastify runtime in `apps/api`, served by Node.
- Web: Vite/React static app in `apps/web`.
- Database: PostgreSQL is required; migrations use `node-pg-migrate`.
- Storage: document files require private object storage and signed upload/download intents for production.
- OCR: lifecycle/status/text APIs and UI exist, but production OCR provider integration does not.
- Auth: dev/test auth and provider-neutral readiness exist, but production provider integration does not.
- Billing: UI skeleton exists, but checkout, portal, webhooks, entitlements, and invoices are not implemented.
- Import/migration: frontend skeleton exists, but backend parsing, preview, merge, and audit trail are not implemented.
- iOS: planned later; the API should remain platform-neutral and avoid web-only assumptions.
- Readiness: `/ready` currently checks config, database, storage, OCR, auth, and billing without printing secrets or provider internals.

## Deployment Target Options

| Option | Fit | Strengths | Risks / tradeoffs | Beta recommendation |
| --- | --- | --- | --- | --- |
| Render | Strong fit for a Node/Fastify web service plus Vite static site. Render also has environment variables, static sites, cron jobs, workers, and Postgres offerings. | Low operational burden, clear service model, easy static web plus API split, enough worker/cron shape for future import/OCR jobs. | Platform database backup/restore details and cost should be verified before broad production use. Long-running worker and private networking needs may eventually outgrow a simple setup. | Recommended first hosted beta target. |
| Fly.io | Strong fit for containerized Node services and global API placement. | Good API/iOS compatibility, app secrets, Machines model, deployable workers, good control over runtime region. | More operational responsibility than Render. Volume-backed databases require care; managed Postgres should be evaluated separately. | Good later option if regional API performance or runtime control matters. |
| Railway | Good fit for fast service/database prototypes. | Simple project model, easy Postgres attachment, environment variables, fast iteration. | Cost controls, backup posture, and production operations need careful review before relying on it for sensitive home records. | Useful prototype option, but not the first recommendation for hosted beta unless Render is blocked. |
| AWS baseline | Strong fit for mature production: App Runner/ECS/Elastic Beanstalk style API, S3, RDS, Secrets Manager, CloudWatch, queues, and Textract. | Maximum control, mature storage/database/OCR primitives, clear path for queues and backups. | Highest setup and operations burden; easy to overbuild before product/provider decisions are stable. | Later-production baseline, not first beta. |
| Vercel or Netlify for web only plus separate API host | Strong fit for static Vite web hosting, not a complete fit for this Fastify API unless the API remains elsewhere. | Excellent static hosting and preview workflows. | Splits operational surface. Serverless functions are not a drop-in replacement for the current Fastify API without a rewrite. | Reasonable for web-only hosting if API is on Render/Fly/AWS; not recommended as the only deployment target. |

Background/worker compatibility:

- OCR and import will need background processing after provider integration.
- Render workers/cron jobs, Fly Machines/process groups, Railway services, and AWS queues/workers can all support that shape, but AWS has the deepest queue/service catalog.
- For beta, keep OCR disabled and avoid background jobs until the core API/auth/storage deployment is stable.

Cost-control risk:

- Avoid exact price assumptions. Confirm current plan limits, outbound transfer, build minutes, database storage, backup, log retention, and object-storage operation costs before each rollout.
- Add budget alerts or manual review thresholds before enabling OCR or broad document uploads.

Vendor lock-in:

- Keep `DATABASE_URL`, S3-compatible storage, provider-neutral auth mapping, and the Fastify API as the stable application boundaries.
- Avoid host-specific request contracts in the API so future iOS clients keep the same backend path.

## Database Hosting Options

| Option | Fit | Notes |
| --- | --- | --- |
| Platform-provided Postgres from selected host | Best near-term simplicity if Render is selected. | Migrations can run with `DATABASE_URL`. Confirm backup retention, restore process, maintenance windows, connection limits, and export workflow. Good for small private beta if backup/restore posture is accepted. |
| Neon | Strong standalone Postgres option. | Works with normal Postgres connection strings and pooling. Branching can help staging/test workflows. Verify backup/restore, pooling settings, region fit, and cost before adopting. |
| Supabase Postgres | Strong if the team wants database, auth, and storage in one platform. | Could simplify provider count, but coupling database/auth/storage can make later provider swaps harder. If using only Postgres, document which Supabase platform features are intentionally unused. |
| AWS RDS | Strong later-production option. | Mature backup/restore and point-in-time restore capabilities, but higher setup burden. Best when the app needs stronger operational controls, AWS storage/OCR alignment, or private networking. |

Database requirements:

- `DATABASE_URL` must remain secret.
- Migrations must run explicitly before opening traffic.
- Connection pooling must be reviewed before server count or concurrency increases.
- Backups and restore drills matter before broad beta access.
- Local/test parity should remain through `TEST_DATABASE_URL` and the existing migration/reset tooling.

## Object Storage Options

| Option | Fit | Notes |
| --- | --- | --- |
| AWS S3 | Best baseline fit. | The current adapter generates S3-style presigned PUT/GET URLs. S3 is a mature default for browsers and future iOS upload/download flows. Pair with private buckets, short TTLs, CORS review, lifecycle rules, and least-privilege credentials. |
| Cloudflare R2 | Good S3-compatible candidate. | Useful if egress cost control is a priority. Verify presigned URL behavior, endpoint shape, CORS, custom-domain needs, and compatibility with the current signing code before choosing. |
| Backblaze B2 | Good S3-compatible candidate. | Potentially cost-attractive. Verify presigned browser uploads/downloads, CORS, lifecycle controls, region fit, and SDK compatibility before choosing. |
| Supabase Storage | Relevant if Supabase is selected for database/auth. | Could simplify provider count, but the current API expects S3-compatible config. Verify signed URL behavior, private bucket controls, and how much Supabase-specific code would be introduced. |

Readiness implications:

- Production storage currently requires `FILE_STORAGE_DRIVER=s3` plus bucket, region, access key id, and secret access key.
- Provider-specific endpoints can use `FILE_STORAGE_ENDPOINT` and `FILE_STORAGE_FORCE_PATH_STYLE`.
- Normal API responses must continue to hide object keys, bucket names, signed URLs, local paths, and provider internals.

## Auth Provider Options

| Option | Fit | Notes |
| --- | --- | --- |
| Clerk | Preferred beta candidate. | Strong hosted sign-in product shape and common web/mobile support. Needs a focused proof of concept for Fastify request validation, session/token handling, external subject mapping, account lifecycle, and future iOS flow. |
| Auth0 | Strong but heavier. | Mature identity platform, API authorization docs, broad SDK coverage, and enterprise-oriented options. Higher operational and configuration complexity than a beta likely needs. |
| Supabase Auth | Strong if Supabase is also chosen for Postgres/storage. | Email/password, passwordless, and social provider flows are common product shapes. Evaluate JWT validation, mobile deep linking, and whether auth/database coupling is desirable. |
| Managed platform auth | Only relevant if the deployment/database platform includes auth that fits API validation. | Can reduce providers, but may lock identity to the hosting choice. Validate backend token/session verification before choosing. |
| Custom auth | Not recommended. | Password handling, account recovery, abuse prevention, session revocation, and operational security are outside the current product scope. |

Auth contract:

- Provider identity maps to internal `users`.
- Workspace membership and roles stay in `workspace_memberships`.
- `401` remains missing/invalid auth.
- `403` remains insufficient active role.
- `404` remains cross-workspace or missing membership.
- Client-supplied roles, workspace ids, user ids, entitlements, and object keys are ignored.

## Billing Provider Options

| Option | Fit | Notes |
| --- | --- | --- |
| Stripe Billing | Recommended first paid-provider candidate. | Good subscription fit, hosted checkout/customer portal patterns, invoices, and webhook-driven lifecycle events. Requires webhook handling, customer/subscription mapping, entitlement cache, and failure handling before access is tied to payment state. |
| Paddle/Lemon Squeezy-style merchant-of-record provider | Relevant if seller administration is a larger concern. | Hosted portal and subscription flows can reduce some business operations. Verify supported countries, product type fit, payout model, user experience, webhook model, and current fees before deciding. |
| Manual/no billing for private beta | Recommended for first beta. | Keeps auth, storage, and import risks separate from payments. Use manual workspace access and no paid entitlements until production auth is stable. |

Billing should not block exports or deletion controls. Any entitlement model must be derived from trusted webhook/provider state, not client UI state.

## OCR Provider Strategy

| Strategy | Fit | Notes |
| --- | --- | --- |
| No production OCR for first beta | Recommended. | The lifecycle/status UI can exist while production OCR is disabled. Users can see queued/disabled states without the app promising automated text extraction. |
| Managed OCR provider later | Good next step after storage/auth are stable. | Pilot with explicit usage limits, queueing, retries, failure messages, and cost controls. AWS Textract and Google Cloud Vision/Document AI-style providers should be evaluated with real documents before selection. |
| Document AI provider later | Good if structured extraction becomes necessary. | Higher cost and complexity. Keep product copy focused on record organization rather than automated conclusions. |
| Local/client-side OCR | Possible future experiment, not preferred for hosted reliability. | Avoids sending documents to an OCR provider but is harder to make consistent across browsers/mobile and can be slow for large files. |

OCR implementation requirements:

- Async queue or worker.
- Idempotent request handling.
- Retry and failure states.
- Per-workspace usage limits.
- Provider response redaction in logs.
- Storage access pattern that never exposes raw object keys to clients.
- Clear user-facing copy that OCR is processing text only and may fail.

## Recommended Phased Implementation Sequence

1. Ticket 50: deployment target config skeleton for Render, including service boundaries, build/start commands, environment groups, and deployment checklist. No external deploy required.
2. Ticket 51: production Postgres/deployment environment template, migration runbook, backup/restore checklist, and staging database path.
3. Ticket 52: production auth provider proof of concept and adapter integration, including internal user mapping and workspace membership tests.
4. Ticket 53: production object storage provider configuration and real signed upload/download QA, using S3 first unless a verified alternative is selected.
5. Ticket 54: private beta deployment runbook and deployed visual QA against the hosted environment.
6. Ticket 55: billing provider integration after auth is stable, starting with Stripe Billing unless merchant-of-record needs override it.
7. Ticket 56: OCR provider pilot with queue, retry, limits, and cost guardrails.
8. Ticket 57: import pipeline backend with preview, duplicate detection, merge rules, and audit trail.
9. Ticket 58: monitoring/logging/error-reporting pass, backup restore drill, and operational readiness review.

## Environment Variable Matrix

| Variable | Owner/service | Local required | Production required | Secret | Purpose | Readiness impact |
| --- | --- | --- | --- | --- | --- | --- |
| `APP_ENV` | API runtime | Optional | Yes | No | Select local/test/production behavior. | Production mode enforces storage/auth readiness more strictly. |
| `NODE_ENV` | API/runtime host | Optional | Yes | No | Node runtime mode. | Used as fallback for `APP_ENV`. |
| `PORT` | API host | Optional | Host-defined | No | API listen port. | Config validation only. |
| `DATABASE_URL` | Postgres | Yes | Yes | Yes | API database connection. | Required for config and database readiness. |
| `TEST_DATABASE_URL` | Local/test Postgres | Test only | No | Yes | Test database reset/check path. | Not part of production readiness. |
| `DB_POOL_MAX` | API/Postgres | Optional | Yes | No | Postgres pool size. | Config validation only. |
| `MIGRATIONS_TABLE` | Migration tooling | Optional | Optional | No | Migration table override. | Migration tooling only. |
| `REQUEST_ID_HEADER` | API/runtime host | Optional | Optional | No | Request id header name. | Error/readiness safety context only. |
| `AUTH_PROVIDER` | Auth | Optional | Yes | No | `dev`, `none`, or future selected provider. | `dev` is local-only; `none` and placeholders are not ready in production. |
| `DEV_AUTH_ENABLED` | Auth | Optional | Yes | No | Enables dev auth only outside production. | Must be false in production. |
| `DEV_AUTH_EMAIL` | Auth/local seed | Optional | No | No | Local dev user email. | Local/dev only. |
| `DEV_AUTH_DISPLAY_NAME` | Auth/local seed | Optional | No | No | Local dev user display name. | Local/dev only. |
| `SESSION_COOKIE_NAME` | Auth | Optional | Future | No | Session cookie name if cookie flow is used. | No production-ready effect until adapter exists. |
| `AUTH_ISSUER_URL` | Future auth provider | No | Future | No | Token/session issuer. | Future auth adapter validation. |
| `AUTH_AUDIENCE` | Future auth provider | No | Future | No | API audience/client target. | Future auth adapter validation. |
| `AUTH_JWKS_URL` | Future auth provider | No | Future | No | Public key discovery for token validation. | Future auth adapter validation. |
| `AUTH_WEBHOOK_SECRET` | Future auth provider | No | Future if webhooks used | Yes | Account lifecycle webhook verification. | Future auth/account sync. |
| `FILE_STORAGE_DRIVER` | Object storage | Optional | Yes | No | `local`, `test`, or `s3`. | Must be `s3` for production storage readiness. |
| `FILE_STORAGE_BUCKET` | Object storage | No | Yes | No, but sensitive | Bucket name. | Required for `s3` readiness; do not print in readiness output. |
| `FILE_STORAGE_REGION` | Object storage | No | Yes | No | Storage region/signing region. | Required for `s3` readiness. |
| `FILE_STORAGE_ENDPOINT` | Object storage | No | Provider-specific | No, but sensitive | S3-compatible endpoint override. | Config validation only. |
| `FILE_STORAGE_ACCESS_KEY_ID` | Object storage | No | Yes | Yes | Storage credential id. | Required for `s3` readiness; never print value. |
| `FILE_STORAGE_SECRET_ACCESS_KEY` | Object storage | No | Yes | Yes | Storage credential secret. | Required for `s3` readiness; never print value. |
| `FILE_STORAGE_FORCE_PATH_STYLE` | Object storage | Optional | Provider-specific | No | S3 path-style URL behavior. | Config behavior only. |
| `FILE_STORAGE_UPLOAD_URL_TTL_SECONDS` | Object storage | Optional | Yes | No | Upload signed URL lifetime. | Config validation only. |
| `FILE_STORAGE_DOWNLOAD_URL_TTL_SECONDS` | Object storage | Optional | Yes | No | Download signed URL lifetime. | Config validation only. |
| `OCR_MODE` | OCR | Optional | Yes | No | `disabled`, `fake`, or `test` today; future provider modes need code. | `disabled` is safe; fake/test are not production-ready. |
| `OCR_PROVIDER` | Future OCR | No | Future | No | Selected OCR provider identifier. | Future OCR readiness only. |
| `OCR_QUEUE_URL` | Future worker/queue | No | Future if async OCR exists | Yes | Queue endpoint or identifier. | Future OCR/import worker readiness. |
| `OCR_API_KEY` | Future OCR | No | Future if provider requires it | Yes | OCR provider credential. | Future OCR readiness; never print value. |
| `BILLING_PROVIDER` | Billing | Optional | Yes | No | `none` today; future selected billing provider. | `none` is readiness-disabled, not a failure. |
| `BILLING_WEBHOOK_SECRET` | Future billing | No | Future if billing exists | Yes | Billing webhook verification. | Future billing readiness. |
| `BILLING_PRICE_ID` | Future billing | No | Future if billing exists | No, but operational | Plan/price identifier. | Future entitlement checks. |
| `BILLING_PORTAL_RETURN_URL` | Future billing | No | Future if portal exists | No | Hosted portal return URL. | Future billing UX. |
| `ANALYTICS_ENABLED` | API/web ops | Optional | Optional | No | Analytics toggle. | No current readiness impact. |
| `EMAIL_PROVIDER` | Future email | No | Future if notifications exist | No | Transactional email provider. | Future notification readiness. |
| `EMAIL_API_KEY` | Future email | No | Future if provider requires it | Yes | Transactional email credential. | Future notification readiness. |
| `ERROR_REPORTING_DSN` | Future monitoring | No | Optional | Yes | Error reporting destination. | Operational, not current readiness. |

## Risk Register

| Risk | Why it matters | Mitigation |
| --- | --- | --- |
| Auth/workspace isolation | Sensitive records must never cross workspaces. | Keep database-backed membership checks, cross-workspace `404`, and tests for forged claims. |
| Storage leakage/signed URL handling | Document files are sensitive. | Private buckets, short signed URL TTLs, opaque storage keys, strict CORS, no bucket/key output in normal responses. |
| OCR cost explosion | OCR can create variable provider usage. | Keep OCR disabled for beta, add quotas, queue controls, retries, and budget review before enabling. |
| Billing/entitlement mismatch | UI or stale webhook state could grant or block access incorrectly. | Do not tie access to billing until webhook mapping and entitlement tests exist. |
| Import duplicate/merge risk | Legacy records can be duplicated or merged incorrectly. | Build preview/confirm flow, legacy id metadata, duplicate detection, and audit trail before writing imports. |
| Backup/restore risk | Hosted data requires a clear recovery path. | Choose database backup posture, test restore, document storage cleanup rules, and keep export paths working. |
| iOS compatibility risk | A web-only auth/storage flow could block mobile later. | Keep API platform-neutral, use provider mobile SDKs only after validation, and test signed URL upload/download from mobile. |
| Operational cost drift | Storage, OCR, DB, and logs can grow quietly. | Add budget checks, usage dashboards, retention policies, and provider review before larger beta. |
| Vendor lock-in | Provider-specific APIs can make migration expensive. | Preserve Postgres, S3-compatible storage, and provider-neutral auth mapping where practical. |
| Privacy expectations | Home records, files, OCR text, notes, and amounts are sensitive. | Limit logs, avoid analytics on sensitive values, document support access, and keep exports/deletion paths explicit. |

## Acceptance Criteria For Real Production Readiness

- `APP_ENV=production` deployment readiness passes against the deployed environment.
- `/ready` reports `ok` for required services and does not print sensitive values.
- Production auth validates real users through the selected provider.
- Provider identity maps to internal users and workspace memberships.
- Workspace authorization tests cover owner/editor/viewer, forged claims, and cross-workspace `404`.
- Storage upload/download works with the real provider from browser QA and future iOS QA.
- Object storage remains private and signed URLs expire as configured.
- Backup and restore steps are documented and tested.
- Visual QA runs against the deployed environment.
- Billing remains disabled or has webhook-backed entitlement tests.
- OCR remains disabled or has queue, retry, cost-limit, and failure-state tests.
- Import remains disabled or has preview/confirm/merge tests.
- No real credentials, signed URLs, raw OCR text, provider internals, local paths, database URLs, or storage keys appear in public output.
- Product copy stays limited to organizing home records for professional review.

## Recommended Decision

Choose Render as the first hosted beta target, Render Postgres for the first small private beta database, AWS S3 for object storage, Clerk as the first auth proof-of-concept candidate, no live billing for private beta, and no production OCR for private beta.

After the beta is stable, revisit Postgres and operations:

- Move to Neon if branching/pooling/staging workflow becomes the main need.
- Move to AWS RDS if backup, restore, private networking, or AWS service alignment becomes the main need.
- Reconsider R2 or B2 only after signed upload/download and CORS behavior pass browser and iOS-oriented QA.
- Add Stripe Billing only after production auth and entitlement mapping are tested.
- Pilot managed OCR only after file storage and cost guardrails are stable.
