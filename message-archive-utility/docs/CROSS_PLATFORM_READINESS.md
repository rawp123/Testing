# Cross-Platform Readiness

Message Archive Utility is currently release-shaped for macOS desktop distribution and local website support.

## Current Mac Strengths

- Electron desktop wrapper.
- Bundled backend executable.
- Local loopback API with token-protected endpoints.
- Signed/notarized DMG path.
- Installed, packaged, and mounted-DMG smoke scripts.
- Backend import/search/export tests.
- Package checks for frontend bundle, backend executable, network posture, privacy keys, and app identifier.

## Browser Development

The browser development flow is useful for frontend/backend work, but the product should be positioned around local desktop archive handling unless a separate browser storage/import model is explicitly built and tested.

## Windows/Linux Considerations

Before producing Windows or Linux builds:

- Replace macOS-specific iPhone backup discovery assumptions.
- Add platform-specific package scripts.
- Add package verification and smoke tests on the target platform.
- Review local backend executable packaging for the target platform.
- Review signing and installer trust requirements for the target platform.

## Mobile Considerations

Mobile should not be positioned as a supported runtime until import, storage, export, and privacy behavior are designed and tested on real devices.
