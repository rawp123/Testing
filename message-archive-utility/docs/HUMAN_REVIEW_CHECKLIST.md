# Human Review Checklist

Use this checklist after automated validation passes.

## Automated Preflight

Run from `message-archive-utility/`:

```bash
npm test
npm run check:syntax
npm run pack:mac
npm run check:mac-package
npm run smoke:packaged
git diff --check
```

For a signed release:

```bash
source ~/.message-archive-signing-env
npm run pack:mac:dmg:signed
npm run smoke:dmg
```

## Fake Data Review

- Import fake sample data.
- Confirm archive stats show expected message and conversation counts.
- Search for a known fake term.
- Export PDF.
- Export XLSX.
- Export CSV.
- Quit and reopen to confirm persistence.

## Real Data Review

Use only private local data. Do not commit real backups, databases, messages, attachments, exports, or screenshots.

- Test a small known iPhone backup.
- Confirm copied `sms.db` files stay in ignored private storage.
- Confirm linked attachment metadata imports correctly.
- Confirm copied attachments stay in ignored private storage.
- Confirm search results are useful and do not expose raw local paths.
- Confirm export filenames and download types are safe.

## Product Review

- Confirm website copy does not imply cloud storage.
- Confirm privacy copy is plain and direct.
- Confirm import troubleshooting language is useful for non-technical users.
- Confirm unsupported import paths are labeled honestly.

## Git Hygiene

- Confirm `data/`, `imports/`, `exports/`, `backups/`, `attachments/`, `private/`, `messages/`, release artifacts, databases, and private fixtures are ignored.
- Commit only source, tests, docs, package files, and intended product assets.
