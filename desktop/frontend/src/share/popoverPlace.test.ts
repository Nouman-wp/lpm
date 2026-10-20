import { describe, expect, it } from "vitest";
import { placeSharePopover } from "./popoverPlace";

const VIEWPORT = { width: 1200, height: 800 };

describe("share popover placement", () => {
  it("hangs under a button with the right edges lined up", () => {
    const place = placeSharePopover({ left: 900, top: 40, right: 980, bottom: 68 }, 400, VIEWPORT);
    expect(place).toEqual({ left: 580, top: 74, maxHeight: 718 });
  });

  it("opens from a menu's point to the right of it", () => {
    const place = placeSharePopover({ left: 300, top: 50, right: 300, bottom: 50 }, 400, VIEWPORT);
    expect(place.left).toBe(300);
  });

  it("stays inside the window", () => {
    expect(placeSharePopover({ left: 1150, top: 50, right: 1150, bottom: 50 }, 400, VIEWPORT).left).toBe(792);
    expect(placeSharePopover({ left: 0, top: 50, right: 100, bottom: 70 }, 400, VIEWPORT).left).toBe(8);
  });

  it("moves up when the room below is too short", () => {
    const place = placeSharePopover({ left: 300, top: 760, right: 300, bottom: 760 }, 400, VIEWPORT);
    expect(place.top).toBe(472);
    expect(place.maxHeight).toBe(320);
  });
});
