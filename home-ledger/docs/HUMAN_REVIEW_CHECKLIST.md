# Human Review Checklist

Use this checklist after the automated validation suite passes.

## Automated Preflight

Run from `home-ledger/`:

```bash
npm test
npm run check:model
npm run check:syntax
npm run smoke:desktop
npm run qa:render
npm run qa:beta
npm run pack:mac
npm run check:mac-package
git diff --check
```

Run signed/notarized packaging only when distribution credentials are configured:

```bash
source ~/.home-basis-tracker-signing-env
npm run pack:mac:dmg:signed
```

## Product Review

- Confirm app copy consistently says CPA review, not tax filing.
- Confirm the app does not imply it calculates basis, deductions, tax savings, or eligibility.
- Confirm local-first wording is accurate for both desktop and browser versions.
- Confirm website copy matches the current app behavior and signed DMG availability.
- Confirm export and backup wording explains that backup files are private plaintext JSON.

## App Workflow Review

- Start with no saved data.
- Add a property.
- Add a project.
- Add expenses for each classification.
- Add documents with and without files.
- Preview supported attachments.
- Run local text reading on at least one image, one PDF, and one text file.
- Download CSV.
- Print summary.
- Download full backup.
- Restore into a clean profile.
- Confirm old stored files are cleaned up after restore where practical.

## Git Hygiene

- Confirm `release/`, private documents, real backups, local exports, app data, and generated packages are ignored.
- Commit only source, tests, docs, package files, and intended app/website assets.
