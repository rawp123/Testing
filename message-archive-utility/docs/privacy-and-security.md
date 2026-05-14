# Privacy And Security

This app is local-first. It is intended to help a user work with their own message archive without uploading private data to a hosted service.

## Repository Rules

- Do not commit real messages.
- Do not commit phone backups, `sms.db`, attachments, imports, exports, or generated SQLite databases.
- Keep real data outside this repository or inside ignored local folders.
- Use the included fake fixture when testing importer behavior.

## Local Data

Future local databases should be stored in `data/` or another ignored location. Exports should be written to `exports/`. Raw source files should be placed in `imports/` or `backups/`. These folders are ignored by Git.

## Sharing The Repo

Before publishing or sharing, run `git status` and review all staged files. Anything containing real message content, contact details, phone numbers, attachments, or backup metadata should be removed from Git tracking.
