# Architecture

Car Care Log is split into three layers:

- `backend`: Electron main process code, local SQLite database, file copying, CSV export, backup/restore, OCR, previews, and native dialogs. The Electron backend entry is `backend/main.ts`.
- `desktop/preload`: narrow IPC bridge exposed as `window.carCareLog`.
- `frontend`: React UI for dashboard, vehicles, service records, documents, export/backup, and settings.
- `shared/receiptParser.ts`: deterministic local parsing for OCR text.

Shared domain types and explainable duplicate-risk logic live in `shared`.

## Data Model

Primary tables:

- `vehicles`
- `service_records`
- `attachments`
- `settings`

Attachments store app-managed filenames internally. The renderer receives safe metadata only: label, attachment type, added date, file type, MIME type, size, and OCR status.

## OCR Intake

OCR execution happens in the Electron main process. The renderer can request OCR for an app-managed attachment or import a new document into a temporary app-managed intake area. The renderer never receives raw source file paths.

Current local extraction:

- PNG/JPEG OCR through Tesseract.js
- bundled English data from `@tesseract.js-data/eng`
- text extraction for `.txt` and `.csv`
- PDF embedded text extraction through `pdfjs-dist` for up to eight pages
- scanned PDF rasterization through `pdfjs-dist` and `@napi-rs/canvas` for up to three pages, followed by local Tesseract OCR
- first-page macOS `sips`/Quick Look preview fallback if PDF rendering fails
- HEIC/WebP/GIF are stored and previewed where possible, but OCR is marked unavailable until local conversion is added

After OCR, `shared/receiptParser.ts` suggests fields using explainable keyword and pattern rules. Suggestions are editable and must be reviewed before saving.

Current OCR guardrails:

- `OCR_MAX_BYTES` rejects files larger than 15 MB.
- `PDF_TEXT_PAGE_LIMIT` caps embedded PDF text extraction at eight pages.
- `PDF_SCANNED_PAGE_OCR_LIMIT` caps scanned-PDF OCR at three rendered pages.
- Embedded PDF and plain text extraction are capped before returning text for review/storage.
- OCR can return `partial` when a document has more pages than the current limit or when only some pages are readable.

Next scanned-PDF milestone checklist:

- Add cancellable/background OCR jobs for batches and long-running documents.
- Consider promoting the scanned-page cap into a user-facing setting after real receipt testing.
- Reuse the existing review-before-save flow so multi-page OCR remains advisory, not automatic data entry.
- Ensure each rasterized page image is deleted in success and failure paths.
- Add manual QA notes for very long scanned PDFs, unreadable pages, and cancellation/discard.

## Temporary Files And Cleanup

Attachment imports are copied into app-managed local storage. Document intake uses an app-managed `intake` directory while the user reviews suggested fields.

Cleanup behavior in the current implementation:

- Intake files are deleted after the reviewed service record is created.
- Intake files are deleted when the user discards the intake.
- App startup removes stale files from the app-managed intake directory after the current retention window.
- Scanned-PDF raster images are written under the OS temp directory with a `car-care-log-pdf-ocr-` prefix and removed after OCR finishes, including failure and partial-extraction paths.
- Image and PDF previews are capped before base64 data is sent to the renderer.
- Restore validates the backup manifest and database before replacing local data, copies only database-referenced regular attachment files, and rejects symlinked backup attachments.

## Packaging And Runtime Assets

The OCR path relies on local runtime assets and macOS tools:

- `@tesseract.js-data/eng` must be included so Tesseract.js can run without downloading language data.
- `pdfjs-dist` must be included with its standard font data for embedded PDF text extraction.
- `@napi-rs/canvas` must be included so scanned PDF pages can be rendered locally.
- `/usr/bin/sips` and `/usr/bin/qlmanage` are macOS-specific fallback commands used only when the primary PDF renderer cannot create page images.

Packaging checks should confirm that packaged builds can resolve the Tesseract language path, the `pdfjs-dist` package root, the `pdfjs-dist/standard_fonts` directory, and the native `@napi-rs/canvas` package for the target Mac architecture.

Packaging implementation:

- Electron Builder is configured in `electron-builder.config.cjs`.
- `npm run package:mac` produces a local directory build under `release/mac-arm64/`, plus DMG and ZIP artifacts under `release/`.
- `scripts/generate-app-icon.mjs` generates `assets/app-icon.icns`, the 1024px source PNG, and the macOS iconset.
- File-backed OCR assets are unpacked from ASAR through `asarUnpack`.
- `backend/runtimePaths.ts` prefers `app.asar.unpacked` when packaged asset paths exist there.
- `scripts/verify-runtime-assets.mjs` verifies development and packaged OCR/runtime assets.
- `scripts/after-pack.cjs` removes unused camera, microphone, Bluetooth, audio capture, and broad App Transport Security plist entries so packaged metadata stays aligned with the app's privacy posture.
- `scripts/notarize.cjs` is wired as `afterSign` and submits to Apple only when a complete environment-based credential set is available.
- `CAR_CARE_LOG_SMOKE_TEST=1` enables an opt-in packaged startup smoke check. If `CAR_CARE_LOG_SMOKE_FILE` is set, the app writes a JSON result after app-ready, database initialization, and storage initialization.

Current packaging limitations:

- Notarization depends on Apple credentials provided through environment variables.
- The app icon is generated locally and should be replaced with a designer-reviewed production icon before a public release if brand polish becomes important.
- DMG and ZIP artifacts are generated, but distribution should wait for successful notarization.

## Real-World Document QA

Private receipt and invoice fixtures belong in `fixtures/private-documents/`, which is ignored by git. The checklist in `docs/REAL_WORLD_DOCUMENT_QA.md` covers dealership PDFs, independent shop invoices, oil-change receipts, tire invoices, phone photos, scanned PDFs, and multi-page PDFs.

## Duplicate-Risk Logic

The first version checks:

- same vehicle
- same or simple related service category
- service date within the last 24 months
- or mileage within the configured threshold when both records have mileage

The UI language is intentionally cautious: "Last recorded", "May have been done recently", and "Based on your records."

## Network Posture

Core app functionality does not require network calls. There is no runtime cloud backend, telemetry, analytics, account system, or third-party storage.

OCR does not upload documents. Tesseract runs locally with bundled language data, and PDF processing uses local files plus app-local PDF rendering. Fixed local macOS binaries are used only as a fallback. The source includes tests that scan for browser network APIs and common external OCR endpoints.

Security posture:

- Source file paths are used only in the main process for import/copy/OCR work.
- The renderer receives safe attachment metadata and data URLs for previews, not raw source paths.
- User-facing errors strip local file paths and map pathful filesystem failures to plain recovery guidance.
- Fallback native rasterization calls use fixed local binary paths with `execFile`, avoiding shell-string execution.
- No external OCR, vision, storage, or parsing service is part of the runtime design.

## Known Limitations

- OCR is English-only.
- Scanned-PDF OCR is capped at three pages.
- Embedded-text PDFs are capped at eight pages.
- Files over 15 MB are rejected by OCR.
- HEIC/WebP/GIF OCR waits on local conversion support.
- OCR and parsing results are best-effort suggestions; service records are only as accurate as the user's review and saved edits.
