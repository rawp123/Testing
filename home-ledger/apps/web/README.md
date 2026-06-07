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

The web app expects the API to be available at `/api/v1`, typically through a later dev proxy or deployment edge configuration. During this foundation ticket, no production auth UI is implemented. The API's configured dev auth/session behavior remains the local development path.

Run the web package with:

```sh
npm run dev:web
npm run check:web
npm run test:web
npm run build:web
```

## Current Scope

Implemented:

- `GET /api/v1/session`
- `GET /api/v1/workspaces/:workspaceId/dashboard`
- `GET /api/v1/workspaces/:workspaceId/follow-ups/summary`
- Dashboard loading, empty workspace, ready, and error states
- React component shell with compact dashboard tables and summary panels

Not implemented yet:

- Full CRUD screens
- File upload UI
- Follow-up resolution UI
- Export UI
- Billing
- Import
- Production auth UI
- Native iOS wiring
