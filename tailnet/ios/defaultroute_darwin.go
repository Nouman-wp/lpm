package main

import "tailscale.com/net/netmon"

func setDefaultRouteInterface(iface string) {
	netmon.UpdateLastKnownDefaultRouteInterface(iface)
}
