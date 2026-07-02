# Mac Release Checklist

Use this checklist before publishing a Home Ledger Mac download.

## Credentials

Keep credentials outside Git. A typical shell env file is:

```bash
source ~/.home-basis-tracker-signing-env
```

Use `.env.example` only as a sample reference. Never commit real Apple IDs, API keys, app-specific passwords, team IDs, keychain profiles, or certificate material.

## Local Validation

```bash
npm test
npm run check:model
npm run check:syntax
npm run smoke:desktop
npm run smoke:packaged
npm run qa:render
npm run qa:beta
npm run pack:mac
npm run check:mac-package
```

## Signed DMG

```bash
npm run pack:mac:dmg:signed
npm run smoke:dmg
```

The script is expected to sign the app, build the DMG, notarize it, staple the ticket, and run Gatekeeper assessment.

## Human Checks

- Install the DMG on a clean Mac user profile.
- Launch the app from `/Applications`.
- Confirm no Gatekeeper warning appears for an unidentified developer.
- Confirm the real app starts without sample records.
- Open Tutorial Workspace, practice the sample property/project/expense/document/export/backup flows, reset it, and exit.
- Confirm the real app still has no sample records after exiting the tutorial.
- Add a property, project, expense, and document.
- Attach a small PDF or image.
- Download a full backup.
- Restore the backup.
- Quit and relaunch to confirm records persist.
- Confirm the app name, icon, bundle id, and version are correct.

## Website Download

- Upload only the latest notarized DMG intended for users.
- Keep a checksum or release inventory entry for the uploaded artifact.
- Confirm the website download button points to the intended file.
- Confirm old download links are either removed or clearly versioned.
