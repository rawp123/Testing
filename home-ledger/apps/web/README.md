# Home Ledger Web Frontend

This package is the first SaaS web wiring layer. It now uses React, Vite, and TypeScript while preserving the narrow Ticket 18 scope:

- Central API client for the existing `/api/v1` SaaS API.
- Session/workspace bootstrap using the API's current dev/session behavior.
- Dashboard summary and follow-up summary read flow.
- Compact dashboard shell with Recent activity and Needs attention surfaces.
- Vitest coverage for API errors, dashboard states, integer-cent formatting, and sensitive-field exclusion.

The downloadable/local app remains the product reference for navigation, compact records, direct copy, dashboard activity, and needs-attention patterns. This package does not reuse local app storage, IndexedDB document storage, desktop bridge behavior, local ids, local file paths, or inline OCR text.

Native iOS source was not found in this repository during the frontend architecture review. Until native iOS screenshots or source are available, the local/downloadable app UI and QA screenshots are the closest visual reference.

## Local Development Assumptions

The web app expects the API to be available at `/api/v1`, typically through a later dev proxy or deployment edge configuration. During local review, set `VITE_API_BASE_URL` to the running API. No production auth UI is implemented yet; the API's configured dev auth/session behavior remains the local development path.

For direct local review against the SaaS API:

```sh
TEST_DATABASE_URL=postgres://home_ledger:home_ledger@localhost:5432/home_ledger_test npm run saas:db:reset:test
DATABASE_URL=postgres://home_ledger:home_ledger@localhost:5432/home_ledger_test npm run seed:api:dev
DATABASE_URL=postgres://home_ledger:home_ledger@localhost:5432/home_ledger_test npm run dev:api
VITE_API_BASE_URL=http://127.0.0.1:4000/api/v1 npm run dev:web
curl -s http://127.0.0.1:4000/api/v1/session | python3 -m json.tool
```

The session response should include at least one membership for the dev user before opening the web app. Without that membership, the API can authenticate the dev user but the web app has no workspace to load.

## Current Scope

Implemented:

- `GET /api/v1/session`
- `GET /api/v1/workspaces/:workspaceId/dashboard`
- `GET /api/v1/workspaces/:workspaceId/follow-ups/summary`
- Dashboard loading, empty workspace, ready, and error states
- React component shell with compact dashboard tables and summary panels
- Properties, Projects, Expenses, Documents, and Export screens

Not implemented yet:

- Follow-up resolution UI
- Billing
- Import
- Production auth UI
- Production OCR provider wiring
- Native iOS wiring

Run checks with:

```sh
npm run check:web
npm run test:web
npm run build:web
```

Deployment configuration and production-readiness expectations are documented in `docs/deployment-readiness.md`, `docs/auth-provider-plan.md`, `docs/saas-provider-deployment-decision.md`, and `docs/render-deployment.md`. The current web app still relies on the existing API session contract and does not add production auth, billing, import execution, or production OCR UI.
