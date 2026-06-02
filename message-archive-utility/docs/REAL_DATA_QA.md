# Real Data QA

Message Archive Utility should be tested with realistic message archives locally, but real message data must never be committed.

## Private Fixture Folder

If local fixtures are needed, use:

```text
fixtures/private-archives/
```

This folder is ignored by Git. Prefer tiny, known, redacted archives where possible.

## Data To Test

- A small iPhone local backup with known conversations.
- A backup with attachments.
- A backup with group conversations.
- A backup with messages that have empty `message.text` but readable attributed/payload content.
- A backup with missing or unavailable attachments.

## Manual Checks

- Confirm import explains what it found.
- Confirm search finds known messages.
- Confirm conversation titles are readable.
- Confirm attachment metadata is present without leaking raw local paths.
- Confirm CSV, PDF, and XLSX exports download and open.
- Confirm exports contain expected fake or private test content only.
- Confirm copied databases and attachments remain in ignored private storage.

## Safety Checks

- Confirm no real `sms.db`, `Manifest.db`, `Manifest.plist`, `Info.plist`, `Status.plist`, `.mdbackup`, `.mddata`, attachments, message exports, or screenshots appear in `git status`.
- Confirm any real-data QA notes are kept outside Git unless fully redacted.
