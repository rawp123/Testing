# Human Review Checklist

Use this checklist after the automated validation suite passes.

## Automated Preflight

Run from `home-ledger/`:

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
git diff --check
```

Run signed/notarized packaging only when distribution credentials are configured:

```bash
source ~/.home-basis-tracker-signing-env
npm run pack:mac:dmg:signed
npm run smoke:dmg
```

## Product Review

- Confirm app copy consistently says CPA review, not tax filing.
- Confirm the app does not imply it calculates basis, deductions, tax savings, or eligibility.
- Confirm local-first wording is accurate for both desktop and browser versions.
- Confirm fresh real records start empty and do not show sample properties, expenses, or documents by default.
- Confirm the Tutorial Workspace is visibly separate from the real records workspace.
- Confirm tutorial sample records can be edited, exported, backed up, restored, reset, and exited without changing real records.
- Confirm website copy matches the current app behavior and signed DMG availability.
- Confirm export and backup wording explains that backup files are private plaintext JSON.

## App Workflow Review

- Start with no saved data.
- Open Tutorial Workspace.
- Review sample property, project, expense, document, CPA summary/export, backup, restore, reset, and exit flows.
- Exit Tutorial Workspace and confirm the real workspace is still empty.
- Add a property.
- Add a project.
- Add expenses for each classification.
- Add documents with and without files.
- Preview supported attachments.
- Run local text reading on at least one image, one PDF, and one text file.
- Run `npm run qa:private-documents` when ignored private fixtures are available.
- Download CSV.
- Print summary.
- Download full backup.
- Restore into a clean profile.
- Confirm old stored files are cleaned up after restore where practical.

## Git Hygiene

- Confirm `release/`, private documents, real backups, local exports, app data, and generated packages are ignored.
- Commit only source, tests, docs, package files, and intended app/website assets.
