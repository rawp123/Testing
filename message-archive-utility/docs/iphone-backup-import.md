# iPhone Backup Import

Real iPhone backup extraction is partially implemented. The backend can locate and copy `sms.db`, inspect metadata, and import messages/conversations from a copied `sms.db`. Message text is imported from `message.text` with a fallback for readable `attributedBody`/`payload_data` content when `message.text` is empty. Attachment extraction is not implemented.

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

## Metadata Inspection

After a copied database passes schema validation, it can be inspected for safe metadata counts:

```text
POST /import/iphone-backup/inspect-sms-db
```

Request body:

```json
{
  "copied_sms_db_path": "/path/to/project/data/imports/iphone/sms_import_20260101T120000Z.db"
}
```

The copied database path must stay inside the project’s ignored `data/imports/iphone/` directory. The inspector opens SQLite read-only and returns row counts for:

- `message`
- `handle`
- `chat`
- `chat_message_join`
- `attachment`
- `message_attachment_join`

It also returns `min_message_date` and `max_message_date` from the `message.date` column when that column is available.

The response includes `inspected: true`, `parsed: false`, and `message_contents_read: false`.

This is still metadata-only. It does not select `message.text`, `attributedBody`, `payload_data`, attachment payload data, or any message body content. It does not import messages into the app database, extract attachments, print message contents, or scan outside the provided copied database path and project import directory.

## Message Import

After a copied database has passed validation, messages can be imported into the app’s normalized archive database:

```text
POST /import/iphone-backup/import-messages
```

Request body:

```json
{
  "copied_sms_db_path": "/path/to/project/data/imports/iphone/sms_import_20260101T120000Z.db"
}
```

The copied database path must stay inside the project’s ignored `data/imports/iphone/` directory. The importer opens the copied `sms.db` read-only and reads:

- `handle` for contact handles
- `chat` for conversations
- `chat_message_join` for message-to-chat mapping
- `message.ROWID`, `message.handle_id`, `message.date`, `message.text`, `message.attributedBody`, `message.payload_data`, `message.is_from_me`, and `message.service`

Imported rows are mapped into:

- `contacts`
- `conversations`
- `conversation_participants`
- `messages`

The original iPhone message `ROWID` is stored as `messages.source_message_id`. Direction is derived from `is_from_me`, service is preserved when present, and iPhone timestamps are converted to ISO datetimes when possible.

Message body text comes from `message.text` first. If `message.text` is empty, the importer attempts to extract readable text from `message.attributedBody` and then `message.payload_data`. Re-running the importer is idempotent for already-imported rows, but it will update existing archive rows whose body is still blank if a fallback body can now be recovered.

It does not extract attachment files, attachment payload data, or write to the normalized `attachments` tables. The endpoint response returns counts only and does not include message text.

## Smoke-Test Result

A local private iPhone backup smoke test on May 15, 2026 imported:

- `172,591` total messages
- `2,159` message bodies recovered by the attributed-body fallback on re-import
- `291` remaining blank bodies after fallback extraction
- `1,182` conversations

The remaining blank bodies had no `attributedBody` or `payload_data` values in the sampled source database. Some remaining blanks are likely attachment-only or non-text rows. These numbers are a real-data implementation check, not a committed fixture; no private message database or message content should be added to Git.

Future work should document:

- How to locate a local backup.
- How to read the backup manifest safely.
- How to handle attachments without copying private files into Git.
