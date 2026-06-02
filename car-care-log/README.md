# Car Care Log

Car Care Log is a local-first desktop app for vehicle service records, receipts, mileage, and maintenance history.

The app is meant to help answer: what did I already do, when, where, at what mileage, and how much did it cost?

## Stack

- Electron desktop app
- React + TypeScript renderer
- SQLite database persisted locally through `sql.js`
- Electron main/preload APIs for local file access
- Local attachment storage managed by the app
- Local OCR with Tesseract.js, bundled English language data, and local PDF processing
- Vitest tests for duplicate-risk logic, CSV export, and the local database path

This project is standalone inside `car-care-log/` and does not import from or depend on the sibling Message Archive Utility or Home Ledger apps.

## Product Layout

- `website/`: standalone marketing website for Car Care Log.
- `frontend/`: React renderer UI.
- `backend/`: Electron main-process backend, local database, file handling, OCR, previews, exports, backups, and restore logic.
- `desktop/preload/`: narrow IPC bridge exposed to the frontend.
- `shared/`: product-local contracts, sample data, parser logic, CSV helpers, safe errors, and shared types.
- `tests/`: product-local Vitest coverage.
- `docs/CROSS_PLATFORM_READINESS.md`: current Mac-beta boundary, cross-platform guardrails, and deferred packaging work.

Run the product website locally:

```bash
npm run dev:website
```

## Local-First Privacy

- No user account
- No cloud sync
- No telemetry or analytics
- No VIN lookup, service interval lookup, pricing lookup, diagnostics, OBD, or telematics
- No external database
- Attachments are copied into local app storage
- Raw source file paths are not shown in the UI

The app organizes records. It does not tell a user that a service is definitely needed or definitely not needed.

## Current MVP

Implemented:

- Vehicle profiles with add, edit, delete
- Service log with add, edit, delete
- Default service categories
- Duplicate-risk context for related services within 24 months or a configurable mileage window
- Dashboard with vehicles, recent services, reminders, spend, and last recorded common services
- Vehicle detail view with profile, timeline, last recorded services, spend, attachments, and filters
- Search across category, description, shop, notes, attachment label, and OCR text fields
- Local attachment copying for service records
- Safe attachment metadata display
- Image and PDF preview where supported
- Local OCR for PNG/JPEG images, PDFs, plus text extraction for `.txt` and `.csv` attachments
- OCR schema and UI states: not run, running, extracted, partial, failed, unavailable
- Receipt/document intake review flow with editable suggested service fields
- Deterministic local parser for date, mileage, shop/provider, category, description, total cost, and next-service hints
- CSV export
- Printable service history summary
- Local backup folder export including database and attachments
- Local restore from a backup folder
- Hardened local restore validation for backup manifests, databases, and attachment files
- Startup cleanup for abandoned document-intake files
- Four sample vehicles with realistic oil change, coolant, brakes, tire, inspection, battery, and transmission records

Scaffolded for later:

- OCR queue cancellation and background progress for batches of documents
- HEIC/WebP/GIF conversion before OCR
- PDF service history file export
- Excel export
- More complete print layout controls

## OCR Strategy

The app uses Tesseract.js locally for PNG/JPEG OCR and bundles English language data through `@tesseract.js-data/eng`. It does not call a cloud OCR service and does not send files outside the user's device.

For PDFs, the app first extracts embedded text locally with `pdfjs-dist` for up to eight pages. If a PDF appears to be scanned instead of text-based, the app renders up to three pages locally with `pdfjs-dist` and `@napi-rs/canvas`, then sends those temporary page images through local Tesseract OCR. If the PDF renderer cannot create page images, the app falls back to first-page macOS preview generation with `/usr/bin/sips`, then Quick Look `/usr/bin/qlmanage`. The fallback shell calls use fixed local binaries with `execFile`, not shell strings.

Current OCR limits are deliberate:

- Files larger than 15 MB are rejected by the local OCR service.
- Embedded-text PDFs read up to eight pages.
- Embedded PDF and plain text extraction are capped before storage/review.
- Scanned-PDF OCR reads up to three rendered pages.
- OCR can return `partial` when a document has more pages than the current limit or when some pages are unreadable.

Next OCR milestone notes:

- Add cancellable/background OCR jobs for long-running batches.
- Consider a user-visible scanned-PDF page limit setting after real receipt testing.
- Keep intake copies in app-managed local storage only until the user saves the reviewed record or discards the intake.

The database and UI include OCR status and text fields on attachments:

- `not_run`
- `running`
- `extracted`
- `partial`
- `failed`
- `unavailable`

After OCR completes, the app uses deterministic local parsing rules to suggest likely service fields. The user must review and confirm before creating or updating a service record.

## Packaging And Runtime Notes

OCR depends on runtime assets that need to survive packaging:

- `@tesseract.js-data/eng` provides the local English language data used by Tesseract.js.
- `pdfjs-dist` is used for embedded PDF text extraction; its standard font data must be available in packaged builds.
- `@napi-rs/canvas` is used to render scanned PDF pages locally before OCR.
- macOS `/usr/bin/sips` and `/usr/bin/qlmanage` are fallback first-page preview paths if PDF page rendering fails.

The primary PDF rendering path is app-local. The fallback preview commands are macOS-specific. Packaging uses Electron Builder and keeps file-backed OCR assets in `app.asar.unpacked` so they can be resolved reliably after packaging.

Current package status:

- `npm run package:mac` builds the current macOS package artifacts under `release/`, then verifies packaged OCR/runtime assets.
- `npm run package:mac:signed` requires a Developer ID signing identity and notarization credentials, signs the app, signs and notarizes the DMG, staples the DMG, then runs packaged runtime and Gatekeeper checks.
- A local Developer ID certificate may sign the app if present on the build machine.
- Notarization is configured but skipped unless Apple credential environment variables are supplied.
- `codesign --verify --deep --strict` should pass for local signed builds.
- Gatekeeper assessment rejects non-notarized Developer ID builds until notarization succeeds.
- The packaged app uses `assets/app-icon.icns`, generated from `scripts/generate-app-icon.mjs`.
- Unused camera, microphone, Bluetooth, audio capture, and broad App Transport Security plist entries are removed after packaging.

Notarization credential options:

- Keychain profile: `APPLE_NOTARIZE_KEYCHAIN_PROFILE` and optional `APPLE_NOTARIZE_KEYCHAIN`
- Legacy keychain profile: `APPLE_KEYCHAIN_PROFILE` and optional `APPLE_KEYCHAIN`
- App Store Connect API key: `APPLE_API_KEY` as a local `.p8` file path, plus `APPLE_API_KEY_ID` and `APPLE_API_ISSUER`
- Apple ID app-specific password: `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID`
- Developer ID signing identity: `CSC_NAME`, for example `Developer ID Application: Your Name (TEAMID)`

Set `APPLE_NOTARIZE=1` in CI when notarization is required; the build will fail if no complete credential set is available.

## Known Limitations

- OCR is English-only in this version.
- OCR quality depends on scan clarity, page orientation, contrast, and receipt layout.
- Scanned-PDF OCR is currently capped at three pages.
- HEIC, WebP, and GIF attachments are stored and previewed where supported, but OCR is unavailable until local conversion is added.
- The parser is deterministic and intentionally cautious; suggested fields may be incomplete or wrong and must be reviewed.

## Development

Install dependencies:

```bash
npm install
```

Run the app in development:

```bash
npm run dev
```

Run checks:

```bash
npm run icon:generate
npm run lint
npm run typecheck
npm test
npm run build
npm run verify:runtime-assets
npm run smoke:fresh-user
```

Preview the built app:

```bash
npm start
```

Package the current desktop build:

```bash
npm run package:mac
npm run verify:runtime-assets -- --app "release/mac-arm64/Car Care Log.app"
```

The directory app is used for smoke testing. The DMG and ZIP are distribution candidates after notarization is configured.

Package a signed and notarized distribution DMG:

```bash
source ~/.car-care-log-signing-env
npm run package:mac:signed
```

Keep signing credentials outside git. The signed release script preserves the app ID `com.carcarelog.app`, requires `CSC_NAME`, requires one complete notarization credential set, submits the app through Electron Builder's `afterSign` hook, signs and notarizes the DMG, staples the DMG, validates runtime assets, runs the packaged smoke check, and runs `codesign`, `xcrun stapler validate`, and `spctl` checks.

The same Apple Developer signing credentials used by the sibling Message Archive Utility release can be reused for this app. This machine currently has the expected Developer ID Application identity available in Keychain, and `~/.message-archive-signing-env` provides a working App Store Connect API key credential set. You can either source that file directly or create a separate `~/.car-care-log-signing-env` with the same Apple credential variables. See `.env.example` for the supported variable names.

Packaged startup smoke check:

```bash
SMOKE_FILE=$(mktemp /tmp/car-care-log-smoke.XXXXXX.json)
env -u ELECTRON_RUN_AS_NODE CAR_CARE_LOG_SMOKE_TEST=1 CAR_CARE_LOG_SMOKE_FILE="$SMOKE_FILE" \
  "release/mac-arm64/Car Care Log.app/Contents/MacOS/Car Care Log"
cat "$SMOKE_FILE"
rm -f "$SMOKE_FILE"
```

Or use the packaged smoke helper:

```bash
npm run smoke:packaged -- --app "release/mac-arm64/Car Care Log.app"
```

Private OCR QA, using ignored files under `fixtures/private-documents/`:

```bash
npm run qa:private-ocr
```

## Local Data

In normal Electron use, records are stored under Electron's app data location for Car Care Log. During tests, temporary directories are used.

Do not commit local databases, backups, exports, attachment storage, build artifacts, or packaged apps. The project `.gitignore` excludes those paths.

Private real-world document QA files belong in `fixtures/private-documents/`, which is ignored by git. See `docs/REAL_WORLD_DOCUMENT_QA.md`.

Final owner review notes live in `docs/HUMAN_REVIEW_CHECKLIST.md`.

## Backup And Restore

Backup creates a local folder containing:

- `manifest.json`
- `car-care-log.sqlite`
- `attachments/`

Restore replaces the current local records with the selected backup folder. It is local backup/restore only.
