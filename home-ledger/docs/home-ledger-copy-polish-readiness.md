# Home Ledger Copy Polish Readiness

## Reference

- Copy polish baseline: `4a210d1` (`Polish Home Ledger user-facing copy`).
- Follow-up scope: shared SaaS UI polish, light local/browser and website source review, verification, and artifact-safe QA handling.
- Local SaaS QA database URL used: `postgres://home_ledger:home_ledger@localhost:5432/home_ledger_dev`.
- Local API test database URL used: `postgres://home_ledger:home_ledger@localhost:5432/home_ledger_test`.

## Scope Completed

- Shared SaaS web styling in `apps/web/styles.css` was tightened for mobile navigation density, filter/chip rhythm, status pills, empty states, mobile table cards, page spacing, and modal heading fit.
- `scripts/beta-qa.cjs` was updated so temporary QA runtime names and restore fixture filenames use Home Ledger naming.
- Local/browser app and website source surfaces were reviewed for obvious rename fallout and visible old/AI-giveaway copy. No additional runtime copy changes were needed in those surfaces.
- Visual QA output was written to temporary directories with `QA_OUTPUT_DIR="$(mktemp -d)"`; tracked `release/qa` and `release/saas-web-visual-qa` artifacts were not refreshed.

## Compatibility Preserved

- No API routes, public API response contracts, database schemas, migrations, auth behavior, billing behavior, import behavior, file-storage behavior, OCR behavior, backup version, or stored enum values were changed.
- `BACKUP_APP_ID = "home-basis-tracker"` remains unchanged for restore compatibility.
- The backup compatibility assertion in `scripts/beta-qa.cjs` still expects `home-basis-tracker`.

## Verification Run

All commands were run from `home-ledger/`.

| Command | Result |
| --- | --- |
| `npm test` | Passed: 44 tests. |
| `npm run test:web` | Passed: 14 files, 98 tests. |
| `npm run test:api` | Passed without failures; DB-backed tests skipped when no `TEST_DATABASE_URL` was attached. |
| `TEST_DATABASE_URL=postgres://home_ledger:home_ledger@localhost:5432/home_ledger_test npm run test:api` | Passed: 195 tests, 0 skipped. |
| `npm run check:syntax` | Passed. |
| `npm run check:web` | Passed. |
| `npm run check:api` | Passed. |
| `npm run check:model` | Passed. |
| `QA_OUTPUT_DIR="$(mktemp -d)" npm run qa:beta` | Passed against `http://127.0.0.1:3102`. |
| `DATABASE_URL=postgres://home_ledger:home_ledger@localhost:5432/home_ledger_dev npm run dev:api` | Started API on `127.0.0.1:4000` for SaaS visual QA. |
| `npm run dev:web` | Started Vite web app on `127.0.0.1:5173` for SaaS visual QA. |
| `QA_OUTPUT_DIR="$(mktemp -d)" npm run qa:saas:web` | Passed with local API and database-backed web app. |
| `git diff --check -- home-ledger` | Passed. |
| `git status --short home-ledger` | Showed only the intended stylesheet, QA script, and readiness note changes. |

## Visual QA Status

- `qa:beta` passed and verified the browser beta flow, backup creation, backup restore, and document fixture handling.
- `qa:saas:web` passed across light and dark mode pages at mobile, tablet, and desktop widths, including add-record modal captures.
- Electron emitted macOS task-policy warnings during visual QA; they did not fail the run and did not indicate app-level QA failures.

## Remaining Manual Review

- Manually spot-check SaaS dashboard, follow-ups, properties, vendors, projects, expenses, documents, exports, settings, import, and billing in a real browser session after deployment or preview build.
- Manually spot-check the local export/backup screen, document preview, calculator disclaimers, tutorial workspace, and website pages before a public release.
- Keep any future screenshot/report refresh in a dedicated artifact commit.
