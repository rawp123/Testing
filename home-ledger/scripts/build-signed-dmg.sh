#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DESKTOP_DIR="$PROJECT_DIR/desktop"
APP_VERSION="$(node -p "require(process.argv[1]).version" "$DESKTOP_DIR/package.json")"
MACHINE_ARCH="$(uname -m)"
case "$MACHINE_ARCH" in
  x86_64)
    APP_ARCH="x64"
    ;;
  arm64)
    APP_ARCH="arm64"
    ;;
  *)
    APP_ARCH="$MACHINE_ARCH"
    ;;
esac
DMG_PATH="$PROJECT_DIR/release/mac/Home Basis Tracker-$APP_VERSION-$APP_ARCH.dmg"

has_api_key_notary_credentials() {
  [[ -n "${APPLE_API_KEY:-}" && -n "${APPLE_API_KEY_ID:-}" ]]
}

has_apple_id_notary_credentials() {
  [[ -n "${APPLE_ID:-}" && -n "${APPLE_APP_SPECIFIC_PASSWORD:-}" && -n "${APPLE_TEAM_ID:-}" ]]
}

has_keychain_notary_credentials() {
  [[ -n "${APPLE_NOTARIZE_KEYCHAIN_PROFILE:-}" || -n "${APPLE_KEYCHAIN_PROFILE:-}" ]]
}

if [[ -z "${CSC_NAME:-}" ]]; then
  cat >&2 <<'EOF'
Set CSC_NAME to your Developer ID Application signing identity before building a signed DMG.
Example value formats:
- Your Name (TEAMID)
- Developer ID Application: Your Name (TEAMID)
EOF
  exit 1
fi

ELECTRON_BUILDER_IDENTITY="$CSC_NAME"
ELECTRON_BUILDER_IDENTITY="${ELECTRON_BUILDER_IDENTITY#Developer ID Application: }"

if ! has_api_key_notary_credentials && ! has_apple_id_notary_credentials && ! has_keychain_notary_credentials; then
  cat >&2 <<'EOF'
Set notarization credentials before building a signed DMG.
Use one of:
- APPLE_API_KEY and APPLE_API_KEY_ID, with APPLE_API_ISSUER for Team API keys
- APPLE_ID, APPLE_APP_SPECIFIC_PASSWORD, APPLE_TEAM_ID
- APPLE_NOTARIZE_KEYCHAIN_PROFILE, with optional APPLE_NOTARIZE_KEYCHAIN
- Legacy APPLE_KEYCHAIN_PROFILE, with optional APPLE_KEYCHAIN
EOF
  exit 1
fi

cd "$DESKTOP_DIR"
npx electron-builder --mac dmg --publish never \
  -c.mac.identity="$ELECTRON_BUILDER_IDENTITY" \
  -c.mac.hardenedRuntime=true \
  -c.mac.entitlements=build/entitlements.mac.plist \
  -c.mac.entitlementsInherit=build/entitlements.mac.inherit.plist \
  -c.mac.notarize=true

if [[ ! -f "$DMG_PATH" ]]; then
  echo "Expected signed DMG was not created." >&2
  exit 1
fi

codesign --force --sign "$CSC_NAME" --timestamp "$DMG_PATH"

if has_api_key_notary_credentials; then
  api_key_args=(--key "$APPLE_API_KEY" --key-id "$APPLE_API_KEY_ID")
  if [[ -n "${APPLE_API_ISSUER:-}" ]]; then
    api_key_args+=(--issuer "$APPLE_API_ISSUER")
  fi
  xcrun notarytool submit "$DMG_PATH" \
    "${api_key_args[@]}" \
    --wait
elif has_apple_id_notary_credentials; then
  xcrun notarytool submit "$DMG_PATH" \
    --apple-id "$APPLE_ID" \
    --password "$APPLE_APP_SPECIFIC_PASSWORD" \
    --team-id "$APPLE_TEAM_ID" \
    --wait
else
  KEYCHAIN_PROFILE="${APPLE_NOTARIZE_KEYCHAIN_PROFILE:-${APPLE_KEYCHAIN_PROFILE:-}}"
  KEYCHAIN_PATH="${APPLE_NOTARIZE_KEYCHAIN:-${APPLE_KEYCHAIN:-}}"
  if [[ -n "$KEYCHAIN_PATH" ]]; then
    xcrun notarytool submit "$DMG_PATH" \
      --keychain "$KEYCHAIN_PATH" \
      --keychain-profile "$KEYCHAIN_PROFILE" \
      --wait
  else
    xcrun notarytool submit "$DMG_PATH" \
      --keychain-profile "$KEYCHAIN_PROFILE" \
      --wait
  fi
fi

xcrun stapler staple "$DMG_PATH"
xcrun stapler validate "$DMG_PATH"
spctl --assess --type open --context context:primary-signature -vvv "$DMG_PATH"
