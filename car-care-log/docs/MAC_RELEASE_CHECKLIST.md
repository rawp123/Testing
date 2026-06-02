# Mac Release Checklist

Use this checklist for a downloadable Car Care Log DMG. Keep real customer data and signing credentials out of Git.

## Credentials

- Use `.env.example` only as a placeholder reference.
- Never commit real Apple IDs, API keys, app-specific passwords, team IDs, keychain profiles, certificates, or private keys.
- Load signing values from a local shell file such as `~/.car-care-log-signing-env`.
- Confirm `CSC_NAME` names the intended Developer ID Application certificate.
- Confirm one complete notarization credential path is available before running the signed build.

## Build

Run the local validation suite first:

```bash
npm run lint
npm run typecheck
npm test
npm run build
npm run verify:runtime-assets
npm run smoke:fresh-user
```

Build and validate a signed distribution DMG:

```bash
source ~/.car-care-log-signing-env
npm run package:mac:signed
npm run smoke:packaged -- --app "release/mac-arm64/Car Care Log.app"
npm run smoke:dmg
```

The signed DMG script is expected to generate icons, build the app, package the macOS artifacts, verify OCR/runtime assets, run the packaged smoke check, sign/notarize the app and DMG, staple the DMG, and run Gatekeeper assessment.

## Manual Install

- Mount the final DMG.
- Drag `Car Care Log.app` to `/Applications`.
- Launch it from `/Applications` on a clean Mac user profile.
- Confirm Gatekeeper opens the app without override steps.
- Add a vehicle, add a service record, attach a receipt, run OCR where available, export CSV, create a backup, restore from backup, quit, and reopen.
- Confirm no source file path, private fixture path, or signing value appears in the UI, logs, exports, or backup metadata.

## Website Download

- Upload only the latest notarized DMG intended for users.
- Keep the public filename, website download link, and release notes in sync.
- Preserve at least one previous known-good DMG privately until the new download has been tested from the website.

## Final Git Check

- Confirm `release/`, `out/`, private fixtures, local databases, backups, exports, and signing env files are ignored.
- Commit only source, tests, docs, package files, and intended app assets.
