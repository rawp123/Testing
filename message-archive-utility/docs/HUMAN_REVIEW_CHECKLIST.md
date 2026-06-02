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
npm run smoke:dmg
git diff --check
```

For a signed release:

```bash
source ~/.message-archive-signing-env
npm run pack:mac:dmg:signed
npm run smoke:dmg
```

## Tutorial Workspace Review

- Start with a fresh app data folder or clean Mac user profile.
- Confirm the real archive opens without sample conversations or messages.
- Open Tutorial Workspace and load the sample tutorial archive.
- Practice conversation browsing, search, summary, message filters, tutorial export, reset, and exit.
- Confirm resetting the tutorial removes the sample workspace state.
- Confirm the real Browse Archive view is still empty unless a real import has been run.

## Smoke-Test Fake Data Review

- Run the packaged or installed smoke script.
- Confirm the script reports empty first launch state before importing fake test data.
- Confirm fake test data is imported only into the temporary smoke data directory.
- Confirm search, PDF export, XLSX export, CSV export, and close/reopen persistence pass in smoke storage.

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
