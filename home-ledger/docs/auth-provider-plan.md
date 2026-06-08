# SaaS Production Auth Provider Plan

Home Ledger SaaS currently supports local/dev/test auth only. No production auth provider, hosted sign-in flow, signup flow, logout flow, password handling, or provider token validation is implemented in this ticket.

This plan defines the boundary a later provider integration must satisfy while preserving workspace-scoped authorization.

## Required Capabilities

A production provider must support:

- Server-side request identity verification for each API request.
- A stable external subject that can be mapped to one internal Home Ledger user.
- Email and display-name claims suitable for account display after provider-side validation.
- Session or token revocation behavior that can be checked by the API or enforced by short lifetimes.
- Web compatibility for the Vite frontend and future native iOS compatibility.
- Secure callback, redirect, and cookie/token handling for deployed domains.
- Clear operational logs that avoid raw tokens, raw auth headers, provider secrets, and full provider claims.

The provider must not become the source of workspace roles. Workspace membership and role decisions stay in the Home Ledger database.

## Adapter Contract

The production auth adapter should expose one request-resolution boundary:

1. Verify the incoming session or token server-side.
2. Extract only the stable external subject and safe display claims needed by the app.
3. Map the external subject to an internal `users` row, creating or linking only through an explicit policy.
4. Load active workspace memberships from `workspace_memberships`.
5. Return the same internal auth shape used by route authorization today.

Route authorization must remain database-backed:

- Missing or invalid auth returns `401 unauthenticated`.
- Invalid workspace id format returns `400 invalid_request`.
- Missing membership, inactive membership, deleted workspace, or cross-workspace access returns `404 not_found`.
- Active membership with insufficient role returns `403 forbidden`.

The adapter must never trust client-supplied user ids, workspace ids, memberships, roles, entitlements, object keys, or billing state.

## Current Modes

- `AUTH_PROVIDER=dev` with `DEV_AUTH_ENABLED=true` is local/test behavior. `/ready` reports this as `local_only`.
- `AUTH_PROVIDER=none` means production sign-in is not connected. `/ready` reports this as `not_ready`.
- Any other provider name is a placeholder until a real adapter exists. `/ready` reports this as `not_ready` and does not echo the provider name.

## Decision Criteria

Select a provider after checking current features and pricing separately. Compare candidates on:

- Server-side verification model and SDK maturity.
- Hosted sign-in and account recovery UX.
- Session lifetime, revocation, refresh, and cookie support.
- Email claim behavior and account-linking controls.
- Native iOS support.
- Audit logs and operational visibility.
- Data export/deletion support for account lifecycle work.
- Deployment fit with the selected hosting platform.
- Lock-in risk and migration path for external subject identifiers.

## Provider Category Tradeoffs

Managed auth SaaS:

- Usually fastest to integrate for hosted sign-in, account recovery, and multi-platform SDKs.
- Adds vendor dependency and requires careful review of data residency, lifecycle, logs, and pricing.

Database/platform auth:

- Can fit well when the database, API, and hosting platform are already aligned.
- May couple Home Ledger more tightly to the platform and can affect future hosting choices.

Custom auth:

- Offers maximum control over UX and data model.
- Requires password, recovery, abuse prevention, session management, and security operations that are outside the current product scope.

## Implementation Sequence

1. Choose the provider and verify current pricing, platform support, iOS support, and operational constraints.
2. Define production environment variables without placing raw secrets in readiness output.
3. Add a production adapter module that verifies requests and returns the internal auth shape.
4. Add explicit user-linking rules for provider subject to internal user.
5. Preserve route-level workspace membership checks exactly as database checks.
6. Add web sign-in/session UI only after the API adapter exists.
7. Add integration tests for valid auth, invalid auth, revoked/expired auth, and cross-workspace access.
8. Update `/ready` so the selected provider can report `ok` only when required config is present and validation is implemented.
9. Update deployment docs, operational runbooks, and visual QA once the real provider flow exists.

## Non-Goals For This Ticket

- No real provider SDK.
- No OAuth, OIDC, JWT, SSO, MFA, or password validation.
- No signup, signin, logout, recovery, or account deletion endpoints.
- No schema changes.
- No fake sign-in controls.
- No changes to workspace authorization behavior.

## iOS Notes

Future iOS support should use the same provider identity and internal user mapping as the web app. The API should not require web-only headers or browser-only assumptions for authenticated API calls. Native sessions must still resolve to internal users and database-backed workspace memberships before any workspace route is served.

## Security And Testing

Tests should cover:

- Local/dev auth remains `local_only`.
- Production with no provider remains `not_ready`.
- Provider placeholders remain `not_ready` until an adapter exists.
- Readiness output excludes tokens, raw auth headers, provider secrets, provider request ids, database URLs, storage keys, signed URLs, local paths, raw OCR text, and billing provider internals.
- 401, 403, and 404 behavior remains stable.
- Cross-workspace access stays hidden behind `404 not_found`.
- Frontend copy does not claim production sign-in is connected before the provider flow exists.

Readiness should stay conservative: production auth is not ready until the selected adapter both verifies request identity and maps it into the internal user and workspace membership model.
