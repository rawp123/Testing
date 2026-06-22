# Home Basis Tracker

Home Basis Tracker helps homeowners keep improvement receipts, contractor invoices, permits, photos, project notes, and costs in one local app.

It is not budgeting software, tax software, legal advice, or tax advice. Cost types are for organization only.

## What It Tracks

- Properties, including optional address, purchase date, purchase price, and notes.
- Projects, including category, status, dates, contractor/vendor, and notes.
- Expenses, including property, optional project, date, vendor, description, amount, cost type, category, receipt/file status, and notes.
- Documents, including type, related property/project/expense, added date, notes, and optional attached file details.

## Local Storage Model

The app does not create an account, upload files, use outside services for files, or use server-side storage.

- Fresh real app storage starts empty. Sample home paperwork lives only in the separate Tutorial Workspace.
- In the Mac desktop app, saved details are stored in an app data file on the Mac, and attached files are copied into a folder managed by the app.
- In the web version, saved details are stored in the current browser profile with `localStorage`, and attached document files are stored in that browser profile with IndexedDB.
- CSV and print exports include document details, not attached file contents.
- Full backup JSON files include saved details and attached files inside the backup.

Local app storage is convenient, but it is not a backup. Deleting the app's local data, clearing browser data, changing browser profiles, or using private browsing can remove saved details and attached files.

The Tutorial Workspace is a temporary sample-data sandbox. Users can practice properties, projects, expenses, documents, review exports, backups, restores, reset, and exit without writing sample items into their real home file.

## Product Layout

- `website/`: standalone product website and support pages.
- `frontend/`: browser UI, HTML entry point, and visual styles.
- `backend/domain/`: local data model, validation, sanitization, CSV export, backup shaping, and shared constants.
- `backend/storage/`: browser storage and desktop bridge adapters for saved details and document files.
- `desktop/`: Electron shell, private desktop storage, packaging, and desktop smoke tests.
- `scripts/`: product-local validation and development helpers.
- `tests/`: focused Node tests for domain, backup, and desktop storage helper behavior.
- `docs/`: architecture, data safety, release, real-document QA, and cross-platform notes.
- `fixtures/`: optional QA fixtures. Private real-world documents belong in ignored subfolders.

Home Basis Tracker is standalone inside `home-ledger/`. It does not import app or website files from Message Archive Utility, Car Care Log, or the root website workspace.

Run the browser app locally:

```bash
npm run dev
```

Run the product website locally:

```bash
npm run dev:website
```

## Mac Desktop App

The desktop app is an Electron wrapper around the same private home paperwork app. It does not add accounts, cloud sync, tax filing, or outside file storage. Document text extraction runs locally for supported files.

Install desktop dependencies:

```bash
npm install --prefix desktop
```

Run the Mac app in development:

```bash
npm --prefix desktop start
```

Package an unsigned local Mac build:

```bash
npm run pack:mac
```

Package a signed and notarized Mac DMG:

```bash
source ~/.home-basis-tracker-signing-env
npm run pack:mac:dmg:signed
```

The signing environment file must stay outside Git and must not be printed. The signed DMG script uses `CSC_NAME` for the Developer ID Application identity, accepts Apple API key, Apple ID, or keychain-profile notarization credentials, signs and notarizes the DMG, staples the notarization ticket, and runs a Gatekeeper assessment. For `CSC_NAME`, use `Your Name (TEAMID)` or the full `Developer ID Application: Your Name (TEAMID)` certificate name.

The app intentionally shows friendly storage labels instead of raw local file paths. Users can download backups and exports from inside the app when they want a portable copy.

## Backup And Restore

Use **Export & backup > Download full backup** to create a private JSON backup. Keep that file somewhere you already use for important personal records.

Use **Export & backup > Restore from backup** to replace the current local app contents with a prior backup. Restore does not upload the file. It validates that the backup appears to belong to Home Basis Tracker, strips local file paths from restored display fields, validates known category/status values, normalizes relationships, and skips backup files or attached files that are too large for this beta.

Backup files are plaintext JSON and can contain sensitive home, vendor, amount, note, receipt, invoice, photo, and document contents. Treat them like private files.

Only restore backups you created or trust. The app skips several active or executable attachment types during restore, but a full backup can still contain private files and notes.

Tutorial backups and restores are scoped to the tutorial workspace. Exiting the tutorial returns to the real home file without copying sample items over.

See `docs/DATA_SAFETY.md` for the current storage, deletion, and restore guardrails.

## Exports

- **Download CSV** creates a cost export with property, project, category, date, vendor, description, amount, cost type, receipt/file status, and notes.
- **Print review summary** creates a printable review packet summary.
- Export wording should say "review packet" or "items for review", not tax-filing language.

## What Is Intentionally Not Included

- Cloud sync.
- User accounts or authentication.
- Payment or subscription flows.
- Cloud OCR or external AI/document processing APIs.
- Tax filing, tax forms, or tax/legal advice.
- Unsupported claims about expense eligibility, savings, or acceptance by a tax authority.

## QA And Review

Before a private beta build, verify the app flows in both the Mac app and web version when practical. The detailed human checklist lives in `docs/HUMAN_REVIEW_CHECKLIST.md`, and real-document guidance lives in `docs/REAL_WORLD_DOCUMENT_QA.md`.

Also verify the first-run boundary: the real app should not show sample items by default. The Tutorial Workspace should be opt-in, resettable, and visibly separate from the real workspace.

Useful validation commands from `home-ledger/`:

```bash
npm test
npm run check:syntax
npm run check:model
npm run smoke:desktop
npm run smoke:packaged
npm run smoke:dmg
npm run qa:render
npm run qa:beta
npm run qa:private-documents
npm run pack:mac
npm run check:mac-package
git diff --check
```

## Release Notes

The Mac app stores saved details and document copies locally through the desktop shell, and a signed/notarized DMG packaging path is available. Remaining release-readiness work is clean-install distribution QA, import/export migration testing, optional user-chosen backup locations, and continued review-packet wording checks.
