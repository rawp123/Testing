# iPhone Backup Import

Real iPhone backup extraction is not implemented in this scaffold.

The intended future path is to support local, encrypted or unencrypted iPhone backups created by Finder or Apple Devices. Any backup files should remain outside this repository in an ignored folder such as `backups/` or a private path elsewhere on the machine.

Future work should document:

- How to locate a local backup.
- How to read the backup manifest safely.
- How to map message records into the normalized schema.
- How to handle attachments without copying private files into Git.
