import { describe, expect, it } from "vitest";
import { addedToast, dropOverlayLabel } from "./sidebarFolderDrop";

describe("dropOverlayLabel", () => {
  it("names the folder a drop lands in", () => {
    expect(dropOverlayLabel()).toBe("Drop to add as project");
    expect(dropOverlayLabel("Clients")).toBe("Drop into Clients");
  });
});

describe("addedToast", () => {
  it("says nothing when no project was added", () => {
    expect(addedToast([])).toBeNull();
  });

  it("names one or two projects, and counts more", () => {
    expect(addedToast(["storefront"])).toBe("Added storefront");
    expect(addedToast(["storefront"], "Clients")).toBe("Added storefront to Clients");
    expect(addedToast(["api", "web"])).toBe("Added api and web");
    expect(addedToast(["a", "b", "c"], "Work")).toBe("Added 3 projects to Work");
  });
});
