# Real-World Document QA

Home Basis Tracker should be tested with real home improvement documents locally, but real documents must never be committed.

## Private Fixture Folder

Place private test files here:

```text
fixtures/private-documents/
```

The folder is ignored by git. Prefer redacted copies when possible.

## Documents To Test

- Contractor invoice PDF.
- Store receipt PDF.
- Phone photo of a paper receipt.
- Building permit PDF.
- Project contract or estimate.
- Before/after project photo.
- Scanned PDF with no embedded text.
- Multi-page invoice or permit packet.
- Plain text note or vendor email excerpt saved as text.

## Manual Checks

For each document, confirm:

- The file can be attached to a document record.
- The displayed file name does not expose a raw local path.
- Preview opens for supported PDFs/images.
- Unsupported files remain stored locally with clear, cautious wording.
- Local text reading works or fails with a useful message.
- Extracted text is not treated as tax advice or automatic classification.
- Downloading an attachment creates a separate copy outside the app.
- Removing an attachment updates related expense status when appropriate.
- Full backup includes the attachment.
- Restore into a clean profile recreates the document record and attachment when the backup file is valid.

## Safety Checks

- Confirm no real names, addresses, phone numbers, payment details, permit numbers, or private notes are committed.
- Confirm `git status --ignored` shows private fixture folders as ignored.
- Confirm restore skips active/executable file types.
- Confirm restore skips a checksum-mismatched attachment in a newly generated backup.
