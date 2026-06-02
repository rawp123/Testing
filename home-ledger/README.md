# Home Basis Tracker

Home Basis Tracker helps homeowners keep improvement receipts, contractor invoices, permits, photos, project notes, and cost records in one local app for CPA review.

It is not budgeting software, tax software, legal advice, or tax advice. Expense classifications are for organization only and should be reviewed with a CPA.

## What It Tracks

- Properties, including optional address, purchase date, purchase price, and notes.
- Projects, including category, status, dates, contractor/vendor, and notes.
- Expenses, including property, optional project, date, vendor, description, amount, classification, category, documentation status, and notes.
- Documents, including type, related property/project/expense, added date, notes, and optional local file attachment metadata.

## Local Storage Model

The app does not create an account, upload files, call third-party APIs, or use server-side storage.

- In the Mac desktop app, structured records are stored in an app-managed records file on the Mac, and attached files are copied into an app-managed documents folder.
- In the web version, structured records are stored in the current browser profile with `localStorage`, and attached document files are stored in that browser profile with IndexedDB.
- CSV and print exports include document metadata, not attached file contents.
- Full backup JSON files include structured records and attached files encoded inside the backup.

Local app storage is convenient, but it is not a backup. Deleting the app's local data, clearing browser data, changing browser profiles, or using private browsing can remove records and attached files.

## Product Layout

- `website/`: standalone product website and support pages.
- `frontend/`: browser UI, HTML entry point, and visual styles.
- `backend/domain/`: local data model, validation, sanitization, CSV export, backup shaping, and shared constants.
- `backend/storage/`: browser storage and desktop bridge adapters for records and document files.
- `desktop/`: Electron shell, private desktop storage, packaging, and desktop smoke tests.
- `scripts/`: product-local validation and development helpers.

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

The desktop app is an Electron wrapper around the same local-first records binder. It does not add accounts, cloud sync, tax filing, or third-party storage. Document text extraction runs locally for supported files.

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
source ~/.message-archive-signing-env
npm run pack:mac:dmg:signed
```

The signing environment file must stay outside Git and must not be printed. The signed DMG script uses `CSC_NAME` for the Developer ID Application identity, accepts Apple API key, Apple ID, or keychain-profile notarization credentials, signs and notarizes the DMG, staples the notarization ticket, and runs a Gatekeeper assessment.

The app intentionally shows friendly storage labels instead of raw local file paths. Users can download backups and exports from inside the app when they want a portable copy.

## Backup And Restore

Use **Export & backup > Download full backup** to create a private JSON backup. Keep that file somewhere you already use for important personal records.

Use **Export & backup > Restore from backup** to replace the current local app records with a prior backup. Restore does not upload the file. It validates that the backup appears to belong to Home Basis Tracker, strips local file paths from restored display fields, validates known category/status values, normalizes relationships, and skips backup files or attached files that are too large for this beta.

Backup files are plaintext JSON and can contain sensitive home, vendor, amount, note, receipt, invoice, photo, and document contents. Treat them like private records.

Only restore backups you created or trust. The app skips several active or executable attachment types during restore, but a full backup can still contain private files and notes.

## Exports

- **Download CSV** creates a cost record export with property, project, category, date, vendor, description, amount, classification, documentation status, and notes.
- **Print summary** creates a printable CPA review summary.
- Export wording should say "review with your CPA" or "share with your CPA", not tax-filing language.

## What Is Intentionally Not Included

- Cloud sync.
- User accounts or authentication.
- Payment or subscription flows.
- Cloud OCR or external AI/document processing APIs.
- Tax filing, tax forms, or tax/legal advice.
- Unsupported claims about expense eligibility, savings, or acceptance by a tax authority.

## Manual QA Checklist

Before a private beta build, verify these flows in both the Mac app and web version when practical:

- Start with no saved data and confirm the onboarding state is useful.
- Add a property.
- Add a project for that property.
- Add expenses for each classification: potential basis addition, repair or maintenance, and unclear / ask CPA.
- Filter expenses by classification, category, documentation status, and project.
- Add a document with and without a file attachment.
- Confirm displayed file metadata uses a file name only, not a raw local path.
- Download an attached file.
- Remove an attached file and confirm the related expense returns to needs follow-up when appropriate.
- Download the CSV and confirm expected columns.
- Print the summary and confirm storage/backup controls are hidden.
- Download a full backup.
- Restore a backup in a clean browser profile or after clearing local app records.
- Confirm local data safety copy is visible in the export center.

Useful validation commands:

```bash
npm run check:syntax
npm run check:model
npm run smoke:desktop
npm run pack:mac
npm run check:mac-package
git diff --check
```

## Private Beta Notes

The Mac app now stores records and document copies locally through the desktop shell. The next durability step after this beta pass would be import/export migration testing, optional user-chosen backup locations, and signed/notarized distribution, while preserving the same cautious CPA-review language.
