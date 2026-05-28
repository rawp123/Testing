#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DESKTOP_DIR="$PROJECT_DIR/desktop"

has_api_key_notary_credentials() {
  [[ -n "${APPLE_API_KEY:-}" && -n "${APPLE_API_KEY_ID:-}" && -n "${APPLE_API_ISSUER:-}" ]]
}

has_apple_id_notary_credentials() {
  [[ -n "${APPLE_ID:-}" && -n "${APPLE_APP_SPECIFIC_PASSWORD:-}" && -n "${APPLE_TEAM_ID:-}" ]]
}

has_keychain_notary_credentials() {
  [[ -n "${APPLE_KEYCHAIN:-}" && -n "${APPLE_KEYCHAIN_PROFILE:-}" ]]
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
- APPLE_KEYCHAIN, APPLE_KEYCHAIN_PROFILE
EOF
  exit 1
fi

"$PROJECT_DIR/scripts/build-backend-executable.sh"
"$PROJECT_DIR/scripts/build-desktop.sh"

cd "$DESKTOP_DIR"
npx electron-builder --mac dmg --publish never \
  -c.mac.identity="$CSC_NAME" \
  -c.mac.hardenedRuntime=true \
  -c.mac.entitlements=build/entitlements.mac.plist \
  -c.mac.entitlementsInherit=build/entitlements.mac.inherit.plist \
  -c.mac.notarize=true
