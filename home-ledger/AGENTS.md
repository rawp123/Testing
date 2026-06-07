# AGENTS.md

## Product boundaries

- This product organizes home records for professional review.
- Do not add tax, legal, accounting, or compliance conclusions.
- Do not use claims such as "deductible," "IRS-approved," "qualifies for basis," "audit-proof," or "tax-safe."
- Preferred classification language:
  - "Possible improvement"
  - "Repair / upkeep"
  - "Not sure, review later"
  - "Organize records for professional review"
- Preserve the distinction between organizing records and giving advice.

## Source of truth

- Treat the existing local Home Basis Tracker codebase as the source of truth for current behavior.
- Inspect existing code and tests before proposing rewrites.
- Preserve current model validation, backup validation, restore safety, relationship checks, follow-up generation, and export behavior unless explicitly instructed otherwise.
- Do not invent a new product model when existing behavior already answers the question.
- When behavior is ambiguous, document the ambiguity instead of silently choosing a new rule.

## Existing app compatibility

- For substantive product, API, domain model, validation, export, dashboard, follow-up, document/file/OCR, import/migration, or frontend/mobile work, inspect the existing app implementation before designing new behavior.
- Preserve useful product architecture, user workflows, terminology, ordering, and validation assumptions from the downloadable/local/iOS app where they are safe for SaaS.
- Before changing relevant behavior, identify mismatches between the existing app model and the SaaS API model, choose the path that minimizes migration, adapter, and frontend/mobile rework, and document intentional divergences.
- Known local/downloadable app reference files may include:
  - `backend/domain/model.js`
  - `backend/domain/backup.js`
  - `frontend/app.js`
  - `backend/storage/document-storage.js`
- If native iOS source exists, inspect it before mobile-facing API or client decisions. Search for `*.xcodeproj`, `*.xcworkspace`, `Package.swift`, `*.swift`, `Info.plist`, and `Podfile`.
- Do not blindly copy local-only assumptions into SaaS, including local filesystem paths, browser/desktop storage assumptions, local ids as SaaS ids, camelCase public API fields, floating-point money behavior, inline OCR text in normal document responses, client-side-only state assumptions, or local backup/restore behavior as cloud behavior.
- Preserve SaaS conventions: workspace-scoped authorization, cross-workspace 404 behavior, public snake_case fields, UUID identifiers, integer-cent money fields, separate document metadata/file lifecycle/OCR text handling, no raw storage keys or provider internals in normal metadata responses, explicit authorized OCR text endpoints only, and neutral review-oriented product language.
- When adding or changing enum-like values, classification values, follow-up reason codes, export headers, or client-visible response shapes, check existing app values first, add or update compatibility tests where practical, prefer canonical SaaS values with explicit legacy mappings, and avoid preserving unsafe legacy labels as canonical SaaS values.
- This compatibility review is not required for trivial formatting, lint-only, dependency, or documentation-only changes unless those docs define product contracts.

## Existing iOS Visual / UX Alignment

- For frontend, mobile, web UI, dashboard, form, navigation, component, copy, or product-flow work, inspect the existing iOS app before designing new UI.
- The SaaS/web frontend should feel like the same product family as the existing iOS app, not a generic SaaS/admin dashboard.
- Preserve where practical:
  - visual language
  - screen hierarchy
  - dashboard card structure
  - navigation labels
  - spacing and density
  - typography direction
  - button hierarchy
  - form field ordering
  - empty/loading/error state tone
  - document, expense, project, and follow-up workflows
  - user-facing terminology
- Adapt where necessary for web:
  - responsive layouts
  - keyboard accessibility
  - wider desktop viewports
  - browser navigation patterns
  - browser-safe file upload/download behavior
- Do not:
  - introduce generic SaaS dashboard styling that conflicts with the iOS app
  - invent new marketing copy or AI-sounding taglines
  - change product terminology without a clear reason
  - copy iOS-only platform controls if they do not make sense on web
  - break existing local/downloadable app behavior
- If native iOS source or screenshots are not available in the repo, state that clearly and use the closest available existing app implementation/screenshots as the product reference. If the visual reference is insufficient, ask for screenshots before making broad visual design changes.

## Engineering rules

- Prefer small, reviewable changes.
- One task should produce one coherent diff.
- Do not introduce new production dependencies without explaining why.
- Do not perform broad rewrites unless the task explicitly asks for them.
- Do not change public behavior without updating relevant docs.
- Do not remove tests unless the task explicitly asks for test removal and explains why.
- Preserve existing safety limits unless explicitly instructed otherwise, including file-size limits, backup-size limits, record-count caps, blocked attachment behavior, checksum validation, and relationship validation.

## Verification

- Before changing code, inspect the repo to identify the correct package manager, test commands, lint commands, and typecheck commands.
- Run the narrowest relevant tests for the change.
- For model, backup, restore, import, export, authorization, billing, or file-storage changes, add or update tests.
- If tests cannot be run, explain exactly why.
- Final response must list:
  - files changed
  - tests/checks run
  - any tests/checks not run
  - important risks or follow-up work

## UX rules

- Preserve compact grids for record-heavy screens.
- Preserve dynamic dependent filters.
- Keep filters visually separate from results.
- Prefer anchored modals/drawers over disruptive page jumps.
- Preserve project-centered follow-up resolution.
- Keep follow-up copy specific and actionable.
- Keep copy direct, utilitarian, and mature.
- Avoid tutorial-like production copy.
- Preserve dark/light readability.
- Avoid large card-heavy layouts for dense record views unless explicitly requested.

## Security and privacy rules

- Treat property addresses, expense amounts, vendor data, uploaded documents, OCR text, notes, exports, and activity history as sensitive.
- Do not send sensitive values to analytics.
- Do not expose raw object-storage keys.
- Use workspace-scoped authorization for all cloud records.
- Prefer explicit data export and deletion behavior.
- Support access to user documents or OCR text must be limited, intentional, and auditable.

## SaaS transition rules

- The future product is a web-first SaaS with iOS as a capture/review companion unless a task says otherwise.
- Do not clone local-only storage assumptions into the cloud product.
- Preserve exportability and migration safety.
- Prefer a migration path from current backup JSON into a cloud workspace.
- For money, use integer cents rather than floating-point amounts.
- For imported records, preserve legacy ids through import metadata instead of reusing them as primary keys.
