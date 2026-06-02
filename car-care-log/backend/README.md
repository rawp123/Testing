# Desktop Backend

This folder holds Car Care Log's Electron main-process backend.

- `main.ts`: Electron backend entry point and IPC handlers.
- `database.ts`: local SQLite persistence and backup/restore operations.
- `ocr.ts`: local OCR and PDF/text extraction.
- `preview.ts`: safe attachment preview generation.
- `intakeCleanup.ts`: cleanup for abandoned document-intake files.
- `runtimePaths.ts`: packaged-runtime asset resolution.
