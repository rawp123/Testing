# Home Basis Tracker

Home Basis Tracker is a local-first records binder for homeowners. It helps organize home improvement expenses, project notes, document status, and local file attachments so a homeowner can export a clean summary for CPA review.

It is not budgeting software, tax software, legal advice, or tax advice. Expense classifications are for organization only and should be reviewed with a CPA.

## What It Tracks

- Properties, including optional address, purchase date, purchase price, and notes.
- Projects, including category, status, dates, contractor/vendor, and notes.
- Expenses, including property, optional project, date, vendor, description, amount, classification, category, documentation status, and notes.
- Document notes, including type, related property/project/expense, added date, notes, and optional local file attachment metadata.

## Local Storage Model

The app does not create an account, upload files, call third-party APIs, or use server-side storage.

- Structured records are stored in this browser profile with `localStorage`.
- Attached document files are stored in this browser profile with IndexedDB.
- CSV and print exports include document metadata, not attached file contents.
- Full backup JSON files include structured records and attached files encoded inside the backup.

Browser storage is convenient, but it is not a backup. Clearing browser data, changing browser profiles, using private browsing, or browser storage cleanup can remove records and attached files.

## Backup And Restore

Use **Export > Download full backup** to create a private JSON backup. Keep that file somewhere you already use for important personal records.

Use **Export > Restore from backup** to replace the current records in this browser profile with a prior backup. Restore does not upload the file. It validates that the backup appears to belong to Home Basis Tracker, strips local file paths from restored display fields, validates known category/status values, normalizes relationships, and skips backup files or attached files that are too large for this MVP.

Backup files are plaintext JSON and can contain sensitive home, vendor, amount, note, receipt, invoice, photo, and document contents. Treat them like private records.

## Exports

- **Download CSV** creates an expense ledger with property, project, category, date, vendor, description, amount, classification, documentation status, and notes.
- **Print summary** creates a printable CPA review summary.
- Export wording should say "review with your CPA" or "share with your CPA", not tax-filing language.

## What Is Intentionally Not Included

- Cloud sync.
- User accounts or authentication.
- Payment or subscription flows.
- OCR or external AI/document processing APIs.
- Tax filing, tax forms, or tax/legal advice.
- Unsupported claims about expense eligibility, savings, or acceptance by a tax authority.

## Manual QA Checklist

Before a private beta build, verify these flows in a browser:

- Start with no saved data and confirm the onboarding state is useful.
- Add a property.
- Add a project for that property.
- Add expenses for each classification: potential basis addition, repair or maintenance, and unclear / ask CPA.
- Filter expenses by classification, category, documentation status, and project.
- Add a document note with and without a file attachment.
- Confirm displayed file metadata uses a file name only, not a raw local path.
- Download an attached file.
- Remove an attached file and confirm the related expense returns to needs follow-up when appropriate.
- Download the CSV and confirm expected columns.
- Print the summary and confirm storage/backup controls are hidden.
- Download a full backup.
- Restore a backup in a clean browser profile or after clearing local app records.
- Confirm local data safety copy is visible in the export center.

## Private Beta Notes

This MVP depends on browser storage and should be tested in the browser and profile the homeowner expects to use. For a more durable Mac app, the next storage step would be a real local database and a user-chosen document storage folder, while preserving the same cautious CPA-review language.
