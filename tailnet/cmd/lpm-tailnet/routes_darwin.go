package main

import (
	"net"
	"time"

	"lpm.cx/tailnet/node"
	"tailscale.com/net/netns"
	"tailscale.com/types/logger"
)

const routePoll = 5 * time.Second

// followRoutes sends the node's traffic wherever the system routes it.
//
// Tailscale pins its sockets to the default interface so that its own tunnel
// can't loop them back into itself. This node has no tunnel, and pinned it
// can't follow a full-tunnel VPN: while one is up macOS has no route out of
// Wi-Fi alone, so every connection the node opens fails.
//
// Tailscale also ignores tunnel interfaces when it watches the network, so a
// VPN connecting, disconnecting or re-keying leaves the node on dead
// connections. Each of those moves the address this machine reaches the
// internet from, so the node restarts when it moves.
func followRoutes(n *node.Node, dir, hostname string) {
	netns.SetDisableBindConnToInterface(logger.Discard, true)
	go func() {
		last := egressAddr()
		for range time.Tick(routePoll) {
			addr := egressAddr()
			if addr == last {
				continue
			}
			last = addr
			if st, _ := n.Status(); addr != "" && st.State == node.StateRunning {
				n.Restart(dir, hostname)
			}
		}
	}()
}

// egressAddr is the local address internet traffic leaves from. Connecting a
// UDP socket only picks the route; nothing is sent.
func egressAddr() string {
	c, err := net.Dial("udp4", "192.0.2.1:80")
	if err != nil {
		return ""
	}
	defer c.Close()
	return c.LocalAddr().(*net.UDPAddr).IP.String()
}
