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
  [[ -n "${APPLE_API_KEY:-}" && -n "${APPLE_API_KEY_ID:-}" && -n "${APPLE_API_ISSUER:-}" ]]
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
Example value format: Developer ID Application: Your Name (TEAMID)
EOF
  exit 1
fi

if ! has_api_key_notary_credentials && ! has_apple_id_notary_credentials && ! has_keychain_notary_credentials; then
  cat >&2 <<'EOF'
Set notarization credentials before building a signed DMG.
Use one of:
- APPLE_API_KEY, APPLE_API_KEY_ID, APPLE_API_ISSUER
- APPLE_ID, APPLE_APP_SPECIFIC_PASSWORD, APPLE_TEAM_ID
- APPLE_NOTARIZE_KEYCHAIN_PROFILE, with optional APPLE_NOTARIZE_KEYCHAIN
- Legacy APPLE_KEYCHAIN_PROFILE, with optional APPLE_KEYCHAIN
EOF
  exit 1
fi

cd "$DESKTOP_DIR"
npx electron-builder --mac dmg --publish never \
  -c.mac.identity="$CSC_NAME" \
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
  xcrun notarytool submit "$DMG_PATH" \
    --key "$APPLE_API_KEY" \
    --key-id "$APPLE_API_KEY_ID" \
    --issuer "$APPLE_API_ISSUER" \
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
  keychain_args=()
  if [[ -n "$KEYCHAIN_PATH" ]]; then
    keychain_args+=(--keychain "$KEYCHAIN_PATH")
  fi
  xcrun notarytool submit "$DMG_PATH" \
    "${keychain_args[@]}" \
    --keychain-profile "$KEYCHAIN_PROFILE" \
    --wait
fi

xcrun stapler staple "$DMG_PATH"
xcrun stapler validate "$DMG_PATH"
spctl --assess --type open --context context:primary-signature -vvv "$DMG_PATH"
