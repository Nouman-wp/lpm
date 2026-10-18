#!/bin/bash
set -euo pipefail

BUNDLE_ID="cx.lpm.mobile"
SCHEME="LpmMobile"
CONFIG="Debug"
DERIVED="build/DerivedData"

cd "$(dirname "$0")"

source ./team.sh "Apple Development"
source ./device.sh
if [ -z "$DEVICE_ID" ]; then
  echo "No iPhone found. Plug one in (or pair it over Wi-Fi), unlock it, and trust this Mac." >&2
  exit 1
fi

echo "▸ Regenerating project (picks up new sources)…"
xcodegen generate

echo "▸ Building $SCHEME for device $DEVICE_ID (team $TEAM)…"
xcodebuild \
  -project LpmMobile.xcodeproj \
  -scheme "$SCHEME" \
  -configuration "$CONFIG" \
  -destination "id=$DEVICE_ID" \
  -derivedDataPath "$DERIVED" \
  -allowProvisioningUpdates \
  DEVELOPMENT_TEAM="$TEAM" \
  build

APP_PATH="$DERIVED/Build/Products/$CONFIG-iphoneos/$SCHEME.app"

echo "▸ Installing to device…"
xcrun devicectl device install app --device "$DEVICE_ID" "$APP_PATH"

echo "▸ Launching…"
xcrun devicectl device process launch --device "$DEVICE_ID" "$BUNDLE_ID"
