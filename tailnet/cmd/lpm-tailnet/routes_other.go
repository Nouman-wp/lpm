//go:build !darwin

package main

import "lpm.cx/tailnet/node"

func followRoutes(*node.Node, string, string) {}
