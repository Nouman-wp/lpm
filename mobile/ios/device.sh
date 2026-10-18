# Sourced by run.sh and open.sh: resolves the iPhone to run on into $DEVICE_ID,
# empty when there is none.
#
# The first connected physical device (its UDID, or the CoreDevice UUID older
# devicectl lists), else a paired one devicectl can reach over the network,
# unless DEVICE_ID is set already. Newer devicectl lists simulators too (a booted
# one shows as connected), so those are dropped. The `|| true` guards matter:
# grep exits 1 on no match, and under `set -euo pipefail` that would kill the
# sourcing script right here.
UDID_RE='[0-9a-f]{8}-([0-9a-f]{16}|[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})'
DEVICES="$(xcrun devicectl list devices 2>/dev/null | grep -iv simulated || true)"
DEVICE_ID="${DEVICE_ID:-$(printf '%s\n' "$DEVICES" \
  | grep -i connected | grep -oiE "$UDID_RE" | head -1 || true)}"
if [ -z "$DEVICE_ID" ]; then
  DEVICE_ID=$(printf '%s\n' "$DEVICES" \
    | grep -i 'available' | grep -oiE "$UDID_RE" | head -1 || true)
fi
