import { describe, expect, it, vi } from "vitest";

// vi.mock hoists above any const, so the factories are inlined. `then` must
// stay undefined: a function there makes the mocked module thenable and
// vitest awaits it forever.
vi.mock("../../bridge/commands", () =>
  new Proxy({}, {
    has: () => true,
    get: (_t, prop) => (prop === "then" ? undefined : vi.fn()),
  }));
vi.mock("../../bridge/runtime", () =>
  new Proxy({}, {
    has: () => true,
    get: (_t, prop) => (prop === "then" ? undefined : vi.fn()),
  }));

import { useAppStore } from "./app";

describe("adding a server", () => {
  it("swaps the SSH project form for the Linux host setup", () => {
    useAppStore.setState({ sshModalOpen: true, addProjectPickerOpen: false, addProjectTarget: null, addProjectStart: null });

    useAppStore.getState().setUpLinuxHost();

    const s = useAppStore.getState();
    expect(s.sshModalOpen).toBe(false);
    expect(s.addProjectPickerOpen).toBe(true);
    expect(s.addProjectStart).toBe("linux-host");
    expect(s.addProjectTarget).toBeNull();
  });

  it("opens the picker on its first screen otherwise", () => {
    useAppStore.setState({ addProjectStart: "linux-host" });
    useAppStore.getState().addProject();
    expect(useAppStore.getState().addProjectStart).toBeNull();

    useAppStore.setState({ addProjectStart: "linux-host" });
    useAppStore.getState().addProjectForPeer("aabbccdd", "dev-server");
    expect(useAppStore.getState().addProjectStart).toBeNull();
    expect(useAppStore.getState().addProjectTarget).toEqual({ slug: "aabbccdd", alias: "dev-server" });

    useAppStore.setState({ addProjectStart: "linux-host" });
    useAppStore.getState().closeAddProjectPicker();
    expect(useAppStore.getState().addProjectStart).toBeNull();
  });

  it("opens the SSH project form from Connections", () => {
    useAppStore.setState({ sshModalOpen: false });
    useAppStore.getState().openSSHProject();
    expect(useAppStore.getState().sshModalOpen).toBe(true);
  });
});
