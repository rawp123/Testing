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

Future work should document:

- How to locate a local backup.
- How to read the backup manifest safely.
- How to map message records into the normalized schema.
- How to handle attachments without copying private files into Git.
