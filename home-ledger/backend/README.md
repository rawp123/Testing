# Local Backend

Home Basis Tracker does not run a network server. This folder is the product-local backend layer used by both the browser app and Electron shell.

- `domain/`: records model, validation, sanitization, CSV export, backup shaping, constants, and pure helpers.
- `storage/`: browser storage and desktop bridge adapters for records and document files.
