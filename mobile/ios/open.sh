#!/bin/bash
set -euo pipefail

cd "$(dirname "$0")"

source ./team.sh "Apple Development"

echo "▸ Regenerating project (team $TEAM)…"
xcodegen generate

echo "▸ Opening in Xcode and building…"
osascript - "$PWD/LpmMobile.xcodeproj" >/dev/null <<'APPLESCRIPT'
on run argv
  tell application "Xcode"
    activate
    set doc to open (item 1 of argv)
    repeat 120 times
      if loaded of doc then exit repeat
      delay 0.5
    end repeat
    build doc
  end tell
end run
APPLESCRIPT
