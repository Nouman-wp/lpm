#!/bin/bash
set -euo pipefail

cd "$(dirname "$0")"

source ./team.sh "Apple Development"
source ./device.sh

# The generated project isn't byte-stable, so only rewrite it when the spec or
# sources changed: a rewrite makes an open Xcode reload it and cancel the build.
echo "▸ Regenerating project (team $TEAM)…"
xcodegen generate --use-cache

if [ -n "$DEVICE_ID" ]; then
  echo "▸ Opening in Xcode and running on iPhone ${DEVICE_ID}…"
else
  echo "▸ No iPhone found, so opening in Xcode and building only…"
fi
osascript - "$PWD/LpmMobile.xcodeproj" "$DEVICE_ID" >/dev/null <<'APPLESCRIPT'
on run {projectPath, deviceId}
  tell application "Xcode"
    activate
    set doc to open projectPath
    repeat 3 times
      repeat 120 times
        if loaded of doc then exit repeat
        delay 0.5
      end repeat
      if deviceId is "" then
        set r to build doc
      else
        repeat with dest in run destinations of doc
          try
            if device identifier of device of dest is deviceId then
              set active run destination of doc to contents of dest
              exit repeat
            end if
          end try
        end repeat
        set r to run doc
      end if
      -- A reload after regeneration cancels the action within a second or two.
      repeat 10 times
        delay 0.5
        if status of r is cancelled then exit repeat
      end repeat
      if status of r is not cancelled then exit repeat
    end repeat
  end tell
end run
APPLESCRIPT
