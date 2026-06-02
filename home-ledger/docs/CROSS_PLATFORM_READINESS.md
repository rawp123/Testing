# Cross-Platform Readiness

Home Basis Tracker currently has two real app surfaces:

- Mac desktop app through Electron.
- Browser app through localStorage and IndexedDB.

The product website is separate from the app runtime.

## Current Mac Strengths

- App-managed records and document storage.
- Desktop smoke test.
- Unsigned local packaging.
- Signed/notarized DMG packaging path.
- Private file permissions and atomic record/backup writes where supported.
- Local document text extraction.

## Current Browser Strengths

- Same frontend and domain model.
- No account or server dependency.
- Browser profile storage for records and IndexedDB attachments.
- Export, print, backup, and restore flows.

## Browser Limitations

- Storage can be cleared by browser profile changes.
- Private browsing may not persist data.
- File storage behavior varies by browser and quota.
- The browser version should be positioned as local and convenient, not as durable storage by itself.

## Future Windows/Linux Considerations

Before producing Windows or Linux builds:

- Replace Mac-specific release assumptions in docs and website copy.
- Add platform packaging scripts and package verification.
- Add clean-profile smoke testing on the target platform.
- Verify app data paths, file permissions, backup saves, and attachment storage.
- Review notarization/signing equivalents for the target platform.

## Mobile Considerations

Mobile web should be treated as a possible lightweight viewer or capture helper only after storage and backup behavior is explicitly tested. Do not imply mobile durability until attachment storage, backup download, restore, and file picker behavior are verified on real devices.
