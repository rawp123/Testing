# Cross-Platform Readiness

Car Care Log is allowed to ship its beta and first download as a macOS build. This note tracks what is already portable, what is intentionally Mac-specific today, and what should wait until Windows and Linux packaging work starts.

## OK For The Current Mac Beta

- `package:mac`, notarization, entitlements, DMG, ZIP, `.app`, and `release/mac-arm64` paths are the current distribution path.
- Apple notarization and Gatekeeper notes remain relevant to the initial download.
- macOS `sips` and Quick Look preview are acceptable as a fallback when app-local PDF rendering fails.
- Window-close behavior keeps the normal macOS convention of leaving the app active until quit.

## Abstracted Or Tested Now

- Runtime `app.asar` asset lookup now handles both POSIX and Windows-style separators.
- Attachment original filenames are normalized across `/` and `\` so imported metadata does not leak source folders.
- Restore logic is covered for non-regular attachment files and legacy Windows-style stored attachment names.
- Fresh-user smoke coverage exercises database creation, attachment copy, CSV export, backup, restore, and restart/read-back against a temporary user data directory.
- Mounted-DMG smoke coverage verifies the macOS distribution image can expose a runnable app with packaged runtime assets.
- Migration coverage verifies an older local database schema upgrades without losing vehicle, service, attachment, or OCR text records.
- Backup hardening coverage includes missing manifest data, corrupted databases, oversized backup attachments, non-regular files, traversal-style names, and Windows-style separators.
- OCR PDF fallback behavior is explicit: native preview fallback is only allowed on macOS.
- Browser-preview and marketing copy use neutral desktop/device language.
- Browser-preview API coverage verifies document attachment and OCR actions clearly remain desktop-app-only in preview mode.
- CI is configured to run lint, typecheck, runtime asset verification, fresh-user smoke, and tests on macOS, Ubuntu, and Windows without attempting cross-platform packaging.

## Defer Until Windows/Linux Packaging

- Electron Builder targets and installer artifacts for Windows and Linux.
- Platform-specific app icons, signing, code-signing credentials, installer metadata, and auto-update choices.
- Replacement PDF preview fallbacks for Windows and Linux if app-local PDF rendering fails.
- Real smoke tests against packaged Windows and Linux desktop apps.
- Full accessibility automation beyond the current manual beta checklist.
- Any public download links or support claims for Windows/Linux.

## Ongoing Guardrails

- Keep user data under Electron's platform-specific `userData` directory.
- Use `path` APIs for filesystem paths and add tests when paths are serialized or restored.
- Avoid shell-string execution; use fixed binaries or structured process APIs where platform commands are unavoidable.
- Keep local-first promises platform-neutral: no account, no cloud sync, no telemetry, and no cloud OCR.
