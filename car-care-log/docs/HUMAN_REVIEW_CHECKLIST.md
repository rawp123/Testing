# Human Review Checklist

Use this checklist after the engineering validation suite passes. Keep real documents private and local.

## Automated Preflight

- Run `npm run lint`.
- Run `npm run typecheck`.
- Run `npm test`.
- Run `npm run verify:runtime-assets`.
- Run `npm run smoke:fresh-user`.
- Confirm the GitHub Actions macOS, Ubuntu, and Windows matrix passes after pushing.

## Real Documents

- Place private receipts and invoices in `fixtures/private-documents/`.
- Run `npm run qa:private-ocr` when private fixtures are available.
- Test at least one dealership repair-order PDF.
- Test at least one independent shop invoice PDF.
- Test a phone photo of a receipt.
- Test a scanned PDF with no embedded text.
- Test a multi-page service record.
- Confirm no original source file path appears anywhere in the UI.
- Confirm extracted fields are useful but still easy to correct before saving.
- Confirm failed, partial, and unavailable OCR states explain what happened without overpromising.

## Product Judgment

- Review the app name, bundle identifier, and generated icon.
- Review dashboard, vehicle detail, service log, documents, export/backup, and settings copy.
- Confirm duplicate-risk copy feels cautious and not like mechanical advice.
- Confirm the printable summary has the right level of detail for resale, mechanic visits, and personal records.

## Apple Distribution

- Provide Apple Developer notarization credentials only outside git.
- Run `APPLE_NOTARIZE=1 npm run package:mac`.
- Run `npm run package:mac:signed` for a distribution DMG when `CSC_NAME` and notarization credentials are available.
- Run `npm run smoke:packaged -- --app "release/mac-arm64/Car Care Log.app"` after packaging.
- Validate the app and DMG with `codesign`, `xcrun stapler validate`, and `spctl`.
- Install the notarized DMG on a clean Mac user profile.

## Git Hygiene

- Confirm `release/`, `out/`, local databases, private documents, backups, exports, attachments, and generated iconset files are not tracked.
- Commit only source, tests, docs, package files, and intended app assets.
