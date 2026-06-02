# Mac Release Checklist

Use this checklist before publishing a Message Archive Utility Mac download.

## Credentials

Keep Apple credentials outside Git.

```bash
source ~/.message-archive-signing-env
```

Use `.env.example` only as a placeholder reference. Never commit real Apple IDs, API keys, app-specific passwords, team IDs, keychain profiles, or certificate material.

## Local Validation

```bash
npm test
npm run check:syntax
npm run pack:mac
npm run check:mac-package
npm run smoke:packaged
```

## Signed DMG

```bash
npm run pack:mac:dmg:signed
npm run smoke:dmg
```

The signed DMG script is expected to build the backend executable, build the frontend, package the app, sign/notarize the app, sign/notarize the DMG, staple the ticket, and run Gatekeeper assessment.

## Human Checks

- Install the DMG on a clean Mac user profile.
- Launch the app from `/Applications`.
- Confirm no Gatekeeper warning appears for an unidentified developer.
- Confirm the real archive does not show sample conversations or messages by default.
- Open Tutorial Workspace, load the sample tutorial archive, search messages, use filters, create a tutorial export, reset, and exit.
- Confirm the real archive remains empty after tutorial reset and exit unless a real import has been run.
- Import a private or redacted real iPhone backup fixture when available.
- Search real imported messages.
- Export CSV, PDF, and XLSX from the real archive.
- Quit and relaunch to confirm real archive persistence.
- Confirm app name, icon, bundle id, and version.

## Website Download

- Upload only the latest notarized DMG intended for users.
- Keep a checksum or release inventory entry for the uploaded artifact.
- Confirm website download links point to the intended file.
- Re-run website route checks after URL wiring.
