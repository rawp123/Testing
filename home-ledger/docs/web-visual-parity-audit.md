# Web Visual Parity Audit And Design Foundation Plan

Ticket 21 documents the visual and workflow gap between the existing
downloadable Home Basis Tracker app and the new SaaS React web shell before
additional CRUD screens are built.

This is a planning and alignment artifact. It does not define a new domain
model, database schema, API route, tax/legal/accounting conclusion, or runtime
behavior change.

## Executive summary

The existing polished product reference in this repo is the Electron/Mac
downloadable app, not a native iOS source tree. Searches did not find a Home
Ledger/Home Basis Tracker `*.xcodeproj`, `*.xcworkspace`, `Package.swift`,
`*.swift`, `Info.plist`, or `Podfile` source package in this repo. The closest
available visual source of truth is:

- Existing app source: `frontend/app.js`, `frontend/styles.css`,
  `backend/domain/model.js`, `backend/domain/backup.js`,
  `backend/storage/document-storage.js`, `desktop/main.cjs`
- Existing release/build references: `desktop/package.json`,
  `docs/MAC_RELEASE_CHECKLIST.md`, `scripts/build-signed-dmg.sh`,
  `release/mac/mac-arm64/Home Basis Tracker.app`
- Current visual references: `release/qa/beta-dashboard-light.png`,
  `release/qa/beta-dashboard-dark.png`, `release/qa/beta-projects-light.png`,
  `release/qa/beta-documents-light.png`,
  `release/qa/beta-document-form-light.png`,
  `release/qa/app-mobile-light.png`
- SaaS web shell to compare: `apps/web/src/App.tsx`,
  `apps/web/src/components/AppShell.tsx`,
  `apps/web/src/dashboard/DashboardPage.tsx`,
  `apps/web/src/dashboard/DashboardSummaryCards.tsx`,
  `apps/web/src/dashboard/RecentActivity.tsx`,
  `apps/web/src/dashboard/NeedsAttention.tsx`, `apps/web/styles.css`

The React web shell is a sound technical foundation, but visually it is not yet
the same product family as the existing app. The biggest differences are the
generic SaaS-style page header card, metric cards, extra dashboard summary
cards, synthetic branding, disabled placeholder navigation links, and layout
patterns that reintroduce card clutter the existing app had already moved away
from.

The best next step is not another product feature. The next ticket should
create a web design foundation that ports the existing app's shell, tokens,
navigation, summary row, panel/table patterns, modal/form patterns, dark mode,
and mobile behavior into reusable React components. After that, CRUD screens
can be built on a stable visual system instead of corrected screen by screen.

## Confirmed source behavior

### Existing downloadable app

Confirmed from `frontend/app.js`, `frontend/styles.css`, and release QA
screenshots:

- Product shell uses a fixed desktop sidebar with the real app icon image from
  `/desktop/build/icon.png`.
- Desktop navigation is a vertical set of button-like tabs, not generic text
  links. The active tab appears as a white or dark raised control with an icon
  tile and label.
- Settings is separated in the lower sidebar area rather than mixed into the
  primary task navigation.
- Mobile navigation becomes a compact top header with horizontally scrollable
  tabs.
- The dashboard starts with a large, unframed page title: "Your home records".
- Dashboard summary metrics are inline summary links, not separate card tiles.
- Quick actions sit immediately below the summary row.
- Dashboard content is organized into practical panels with clear headers,
  compact filters, and compact tables.
- Dashboard uses two subtabs: "Recent activity" and "Needs attention".
- Filters live inside the relevant panel and feel secondary to the returned
  records.
- Record-heavy screens use compact grids/tables instead of large expanded
  cards.
- Document forms use compact, utilitarian copy and place the file field near
  the top.
- Light mode uses a warm off-white page wash, white surfaces, muted borders,
  dark ink, and deep green action color.
- Dark mode uses dark green/black surfaces with the same hierarchy, not a
  different design language.

### Current SaaS web shell

Confirmed from `apps/web`:

- `apps/web` is now a React, Vite, and TypeScript app.
- The typed API client and dashboard view model are useful and should be
  preserved.
- The current web UI only implements the dashboard foundation; other nav items
  are placeholders.
- The current app shell uses "Home Ledger" branding with a generated text
  symbol rather than the existing app icon treatment.
- The current dashboard uses a bordered page-intro card and card-like summary
  metrics, which do not match the current downloadable app dashboard.
- The current dashboard adds a secondary grid with expense, attention, and
  document summary cards, which increases visual clutter compared with the
  existing dashboard.
- Needs attention is present as a dashboard control, but the broad dashboard
  visual layout has not yet been ported from the existing app.

## Alignment matrix

| Area | Existing app reference | Current web shell | Alignment |
| --- | --- | --- | --- |
| Brand | Real app icon, "Home Basis Tracker" in screenshots | Synthetic symbol, "Home Ledger" | Product naming/open decision; visual treatment misaligned |
| Desktop shell | Fixed sidebar, button tabs, settings separated | Sidebar with nav links and disabled placeholders | Should fix before CRUD |
| Mobile shell | Top brand row and horizontal nav | Not yet verified against current app mobile screenshots | Should fix before CRUD |
| Page header | Large unframed H1, small contextual copy when useful | Bordered page intro card with workspace/user metadata | Should fix before CRUD |
| Dashboard metrics | Inline summary row with "VIEW" actions | Separate metric cards | Should fix before CRUD |
| Dashboard actions | Compact quick-action row | Present but embedded in current shell hierarchy | Needs alignment |
| Recent activity | Panel with filters and compact table | Present, but surrounding layout differs | Partially aligned |
| Needs attention | Dashboard subtab and compact action-oriented content | Present in secondary card/grid treatment | Should fix before CRUD |
| Record lists | Compact grids/tables | Dashboard only; other screens not built | Preserve pattern before building screens |
| Forms | Compact modal, direct labels, file-first document flow | Not implemented in web yet | Build shared pattern first |
| Copy tone | Direct, utilitarian, mature | Mostly neutral, but some SaaS shell copy feels generic | Tune while aligning |
| Dark mode | Same hierarchy as light mode | Exists in CSS, needs visual parity pass | Should verify |
| Data safety | No storage internals or OCR text in normal lists | Web tests preserve safety exclusions | Aligned |

## Mismatch and risk table

| Severity | Risk | Why it matters | Recommended action |
| --- | --- | --- | --- |
| Blocker before broad frontend | No canonical web visual contract existed before this doc | CRUD screens would multiply drift | Use this doc as the source for Tickets 22-24 |
| Blocker before broad frontend | Product name mismatch: local app screenshots say "Home Basis Tracker"; SaaS docs and shell say "Home Ledger" | Branding affects nav, title, export/download language, and App Store/web positioning | Decide whether SaaS UI displays "Home Ledger", "Home Basis Tracker", or a transitional name |
| Should fix before frontend | Generic web shell patterns differ from existing app shell | Users will feel like the web app is a different product | Port sidebar/top-nav structure and tokens |
| Should fix before frontend | Summary cards replace existing inline dashboard metrics | Reintroduces card-heavy feel the existing app moved away from | Build a shared `SummaryRow` pattern |
| Should fix before frontend | Extra dashboard secondary grid adds clutter | Conflicts with dashboard declutter direction | Move those counts into summary/subtabs/tables |
| Should fix before frontend | Placeholder disabled nav links look unfinished | Makes the app feel less real during review | Use real tab buttons with unavailable states only where necessary |
| Should fix before frontend | Current page intro card competes with content panels | Existing app uses a clearer unframed page title | Replace with shared `PageTitle` pattern |
| Can defer | Native iOS visual source is not present | Mac app source/screenshots are sufficient for web MVP visual parity | Ask for iOS screenshots before iOS-specific visual claims |
| Can defer | Full screenshot automation for apps/web is not established | Manual review is possible now, but drift can return | Add visual QA in a later hardening ticket |
| No action | API client and dashboard view model are typed and tested | Useful architecture foundation | Preserve these modules |

## Design foundation to create next

Ticket 22 should introduce shared web UI primitives that mirror the existing
app rather than styling each future screen independently.

Recommended components/modules:

- `AppShell`: desktop sidebar plus mobile top navigation modeled on
  `frontend/app.js`
- `BrandMark`: real product icon treatment, pending product name decision
- `PageTitle`: large unframed page title with restrained supporting metadata
- `SummaryRow`: inline metrics with optional record-link actions
- `QuickActions`: compact action row with existing app button hierarchy
- `WorkspacePanel`: reusable content panel with icon tile, heading, and optional
  right actions
- `SubTabs`: dashboard-style tab switcher for Recent activity / Needs attention
- `FilterPanel`: compact, collapsible or grouped filters inside result panels
- `CompactRecordTable`: shared table pattern for dashboard and future CRUD grids
- `EmptyState`: compact, action-oriented empty states
- `Modal` and `FormField`: compact forms that match the document attachment
  modal reference

Recommended CSS token port:

- Use the existing app tokens from `frontend/styles.css` as the starting point:
  `--surface`, `--surface-soft`, `--border`, `--border-soft`, `--ink`,
  `--muted`, `--green`, `--green-strong`, `--danger`, `--shadow-soft`,
  `--shadow-card`, `--radius-card`, `--radius-control`
- Preserve the light page wash: radial highlights plus `#f3f7f2`
- Preserve dark mode as a first-class theme, not an inverted afterthought
- Keep cards/panels near 8px to 10px radius
- Keep compact buttons around the existing 36px minimum height
- Keep grid/table text color consistent within each table

## Recommended implementation sequence

### Ticket 22: Web visual foundation and shell parity

Reasoning level: High.

Objective:

- Port the existing app shell, tokens, brand treatment, nav hierarchy, page title
  pattern, panel pattern, summary row pattern, and responsive shell behavior into
  `apps/web`.

Likely files:

- `apps/web/src/components/AppShell.tsx`
- `apps/web/src/App.tsx`
- `apps/web/src/dashboard/DashboardPage.tsx`
- `apps/web/src/dashboard/DashboardSummaryCards.tsx`
- `apps/web/styles.css`
- `apps/web/tests/dashboard.test.tsx`
- `apps/web/README.md`

Out of scope:

- CRUD screens
- API changes
- file upload UI
- export UI
- billing/import/auth implementation

Acceptance criteria:

- The web dashboard shell visibly matches `release/qa/beta-dashboard-light.png`
  and `release/qa/beta-dashboard-dark.png` in structure and hierarchy.
- The page title is unframed.
- Summary metrics are inline, not card tiles.
- The sidebar/top nav uses the existing app's button-tab language.
- The dashboard does not show the extra secondary summary card grid.
- Existing web tests pass after updating expected copy/structure.

### Ticket 23: Dashboard parity and subtab behavior

Reasoning level: High.

Objective:

- Make the web dashboard content match the existing dashboard flow:
  summary row, quick actions, property overview, Recent activity subtab, Needs
  attention subtab, compact filters, and compact tables.

Acceptance criteria:

- Recent activity and Needs attention are real subtabs.
- Filters are inside each panel and visually secondary to results.
- Dashboard actions keep users anchored.
- No raw OCR text, storage internals, signed URLs, or local paths appear.

### Ticket 24: Shared record grid and modal contracts

Reasoning level: High.

Objective:

- Establish reusable table/grid and modal/form contracts before building
  Properties, Projects, Expenses, and Documents screens.

Acceptance criteria:

- Shared grid supports dynamic filters, compact actions, empty states, and mobile
  behavior.
- Shared modal supports focused forms and anchored record detail flows.
- Copy remains direct and utilitarian.

### Ticket 25: Properties web screen

Reasoning level: High.

Objective:

- Build the first CRUD screen using the shared components.

Acceptance criteria:

- Property list/grid, create/edit modal, empty state, and route/modal behavior
  use the shared visual foundation.

### Ticket 26 and later

Recommended order:

1. Projects web screen with project-centered follow-ups
2. Expenses web screen
3. Documents web screen and file lifecycle UI
4. Export UI
5. Settings/data controls
6. Visual QA and accessibility hardening

## Things not to change in Ticket 22

- Do not change `apps/api` behavior.
- Do not change PostgreSQL schema or migrations.
- Do not change local/downloadable app behavior.
- Do not change backup, restore, export, OCR, or file storage semantics.
- Do not add tax/legal/accounting conclusion language.
- Do not expose raw storage keys, bucket names, signed URLs, local paths, or OCR
  text outside explicit authorized endpoints.
- Do not build CRUD screens until the shared shell and visual foundation are in
  place.

## Open product and engineering questions

1. What should the SaaS UI display as the product name: "Home Ledger",
   "Home Basis Tracker", or another final name?
2. Are `release/qa/beta-*.png` the canonical visual references, or should a new
   clean screenshot set be captured from the currently preferred local app build?
3. Should the SaaS MVP nav include not-yet-built local app sections such as
   Calculators and Tutorial, or should it show only implemented sections while
   preserving the same visual nav treatment?
4. Should the development review proxy used for API-backed local review become a
   documented Vite proxy setup?
5. Should visual regression screenshots be added before CRUD screens, or after
   the shell/dashboard parity pass?
6. If a native iOS app or final App Store screenshots exist outside this repo,
   should they supersede the Electron/Mac screenshots for mobile visual
   alignment?

## Recommended next prompt

Use this for Ticket 22:

```text
Implement Ticket 22: Web visual foundation and shell parity.

Follow AGENTS.md and docs/web-visual-parity-audit.md.

Goal:
Make the React/Vite SaaS web shell feel like the existing downloadable Home
Basis Tracker app before building CRUD screens.

Use these visual references:
- release/qa/beta-dashboard-light.png
- release/qa/beta-dashboard-dark.png
- release/qa/beta-projects-light.png
- release/qa/beta-documents-light.png
- release/qa/beta-document-form-light.png
- release/qa/app-mobile-light.png

Use these source references:
- frontend/app.js
- frontend/styles.css
- apps/web/src/App.tsx
- apps/web/src/components/AppShell.tsx
- apps/web/src/dashboard/DashboardPage.tsx
- apps/web/styles.css

Implement only the shared visual foundation and dashboard shell alignment:
- Port the existing app shell/nav visual language into apps/web.
- Port core CSS tokens, light/dark surfaces, spacing, panel, table, and button
  hierarchy.
- Replace the generic page intro card with the existing app's unframed page title
  pattern.
- Replace dashboard metric cards with an inline summary row.
- Remove the extra dashboard secondary summary card grid.
- Preserve typed API client and dashboard view-model behavior.
- Preserve sensitive-field exclusion and integer-cent formatting tests.
- Do not build CRUD screens.
- Do not change apps/api.
- Do not change local/downloadable app behavior.

Before implementing, decide and document the product-name handling if the web
shell still says "Home Ledger" while the reference app says "Home Basis Tracker".

Run:
- npm --prefix apps/web run check:syntax
- npm --prefix apps/web test
- npm --prefix apps/web run build
- npm run check:web
- npm run test:web
- npm run build:web
- git diff --check

Summarize files changed, checks run, visual alignment changes, intentional
divergences, and remaining risks.
```
