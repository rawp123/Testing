# Home Ledger Web Foundation

This package is the first SaaS web wiring layer. It is intentionally narrow:

- Central API client for the existing `/api/v1` SaaS API.
- Session/workspace bootstrap using the API's current dev/session behavior.
- Dashboard summary read flow.
- Compact dashboard shell with Recent activity and Needs attention surfaces.
- Dependency-free tests for API errors, dashboard states, integer-cent formatting, and sensitive-field exclusion.

The downloadable/local app remains the product reference for navigation, compact records, direct copy, dashboard activity, and needs-attention patterns. This package does not reuse local app storage, IndexedDB document storage, desktop bridge behavior, local ids, local file paths, or inline OCR text.

## Local Development Assumptions

The web app expects the API to be available at `/api/v1`, typically through a later dev proxy or deployment edge configuration. During this foundation ticket, no production auth UI is implemented. The API's configured dev auth/session behavior remains the local development path.

## Current Scope

Implemented:

- `GET /api/v1/session`
- `GET /api/v1/workspaces/:workspaceId/dashboard`
- Dashboard loading, empty workspace, ready, and error states

Not implemented yet:

- Full CRUD screens
- File upload UI
- Follow-up resolution UI
- Export UI
- Billing
- Import
- Production auth UI
- Native iOS wiring
