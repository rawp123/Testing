# iPhone Backup Import

Real iPhone backup extraction is not implemented in this scaffold.

The intended future path is to support local, encrypted or unencrypted iPhone backups created by Finder or Apple Devices. Any backup files should remain outside this repository in an ignored folder such as `backups/` or a private path elsewhere on the machine.

## Current Dry Run

The backend currently provides a locator-only dry run:

```text
POST /import/iphone-backup/dry-run
```

Request body:

```json
{
  "backup_folder_path": "/path/to/local/iphone-backup"
}
```

The dry run only checks for `Manifest.db` inside the provided folder, opens it read-only, and looks for the `Files` row where:

- `domain = 'HomeDomain'`
- `relativePath = 'Library/SMS/sms.db'`

It returns whether the SMS database entry was found, the manifest metadata, and the expected resolved backup file path for that file ID.

It does not copy `sms.db`, parse `sms.db`, read messages, store message contents, scan outside the provided backup folder, or create import data.

## Controlled Copy Step

After the dry run locates the SMS database entry, the backend can copy only that resolved backup file:

```text
POST /import/iphone-backup/copy-sms-db
```

Request body:

```json
{
  "backup_folder_path": "/path/to/local/iphone-backup"
}
```

The copy step reuses the dry-run locator, verifies that the resolved source path stays inside the provided backup folder, and writes the copy under:

```text
data/imports/iphone/
```

Copied files use timestamped names such as:

```text
data/imports/iphone/sms_import_20260101T120000Z.db
```

The destination folder is ignored by Git. The endpoint will not overwrite an existing import file.

This is still not an importer. It does not parse `sms.db`, read message rows, extract attachments, store message content, or commit copied databases.

## Schema Validation

Copied databases can be checked with a schema-only validation endpoint:

```text
POST /import/iphone-backup/validate-sms-db
```

Request body:

```json
{
  "copied_sms_db_path": "/path/to/project/data/imports/iphone/sms_import_20260101T120000Z.db"
}
```

The copied database path must be inside the project’s ignored `data/imports/iphone/` directory.

The validator opens the SQLite database read-only and checks only `sqlite_master` for these table names:

- `message`
- `handle`
- `chat`
- `chat_message_join`
- `attachment`
- `message_attachment_join`

The response includes `valid`, `present_tables`, `missing_tables`, `parsed: false`, and `message_contents_read: false`.

It does not query message text/body columns, import messages, or store message contents.

Future work should document:

- How to locate a local backup.
- How to read the backup manifest safely.
- How to map message records into the normalized schema.
- How to handle attachments without copying private files into Git.
