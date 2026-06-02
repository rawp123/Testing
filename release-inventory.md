# Release Inventory

Date: June 2, 2026

This inventory records the current signed, notarized, stapled macOS ARM64 release artifacts for the three independent product workspaces.

## Artifacts

| Product | Version | DMG | Size | SHA-256 | Apple Notarization ID |
| --- | --- | --- | --- | --- | --- |
| Message Archive Utility | 0.1.0 | `message-archive-utility/release/mac/Message Archive Utility-0.1.0-arm64.dmg` | 128M | `b6379c5f043dbe0e80ae2298eca0932a9b99d2ee6e975a536f2fb39f5ea57bb9` | `eb43f5e7-6f26-439a-8633-526440538eb1` |
| Home Basis Tracker | 0.1.0 | `home-ledger/release/mac/Home Basis Tracker-0.1.0-arm64.dmg` | 139M | `b69f8aadb7dabe502935a7b09c31bd05a9c71eec464e3736070399e76febaa42` | `689fc85e-8eba-4084-bc42-5c4d8c00faf7` |
| Car Care Log | 0.1.0 | `car-care-log/release/Car-Care-Log-0.1.0-arm64.dmg` | 169M | `cc26e5a7247fb95b559b5922f6d92f6ad33b0042fcde2a6ad0e6844c78c11668` | `d3c05d3f-176e-4d2c-81f3-932686fbdfec` |

## Automated Validation Completed

All three products passed:

- Apple app notarization.
- Apple DMG notarization.
- Staple and validate.
- Gatekeeper assessment as `Notarized Developer ID`.
- App bundle `codesign --verify --deep --strict`.
- `hdiutil verify` on the final DMG.
- Packaged app smoke testing.
- Mounted-DMG app smoke testing.
- Product-specific package/resource checks.

Additional product QA completed:

- Message Archive Utility: backend tests, package check, installed-app smoke, website route smoke.
- Home Basis Tracker: syntax check, model check, desktop smoke, render QA, beta QA, package resource check.
- Car Care Log: typecheck, lint, test suite, runtime asset verification, packaged smoke, website route smoke.

## Current Release Commits

- `64f3119` Separate Message Archive Utility workspace
- `c022c88` Organize Home Ledger workspace and website
- `4debdf9` Add separated Car Care Log workspace
- `58d76bd` Fix Message Archive signed DMG identity handling
- `4c154fb` Add Home Ledger local document text extraction
- `303a3fa` Fix Home Ledger signed DMG identity handling
- `e90026f` Fix Car Care Log signed DMG identity handling

## Remaining Manual QA

For each product:

- Install the DMG into `/Applications` from Finder.
- Launch normally from `/Applications`.
- Confirm the first-run experience is clear.
- Create one small realistic record set.
- Confirm local data persists after quit and reopen.
- Confirm export or backup flow works.
- Confirm no raw local paths appear in the UI.
- Remove test data after the check.

Product-specific manual checks:

- Message Archive Utility: import a small known message archive sample, search it, export it, reopen the app, and confirm the archive still loads.
- Home Basis Tracker: add a property, project, expense, and attached document; run local text reading on a PDF or image; download a backup; restore it in a clean profile.
- Car Care Log: add a vehicle, service record, and receipt; confirm OCR/runtime assets work with a real receipt or invoice; export the service history.

## Publishing Steps

These remain manual unless release-host credentials are provided to Codex:

- Choose public or private beta status for each product.
- Upload the three DMGs to the selected release host.
- Record the final public download URLs.
- Update each product website download button to the final URL.
- Re-run website route checks after URL wiring.
- Push commits and any release tag or branch to the remote repository.

Suggested tag:

```bash
git tag release-three-products-notarized-2026-06-02
```

