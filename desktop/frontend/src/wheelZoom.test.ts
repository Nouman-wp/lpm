import { describe, expect, it } from "vitest";
import { WHEEL_GESTURE_GAP_MS, createWheelZoomGate } from "./wheelZoom";

const plain = { ctrlKey: false, metaKey: false };
const cmd = { ctrlKey: false, metaKey: true };
const ctrl = { ctrlKey: true, metaKey: false };

function gate() {
  let t = 1000;
  const zooms = createWheelZoomGate(() => t);
  return {
    zooms,
    wait: (ms: number) => {
      t += ms;
    },
  };
}

describe("createWheelZoomGate", () => {
  it("zooms a gesture that starts with ⌘ or Ctrl held", () => {
    const { zooms, wait } = gate();
    expect(zooms(cmd)).toBe(true);
    wait(16);
    expect(zooms(cmd)).toBe(true);
    wait(WHEEL_GESTURE_GAP_MS + 1);
    expect(zooms(ctrl)).toBe(true);
  });

  it("keeps a plain scroll a scroll when a modifier goes down while it coasts", () => {
    const { zooms, wait } = gate();
    expect(zooms(plain)).toBe(false);
    for (let i = 0; i < 60; i++) {
      wait(16);
      expect(zooms(i < 10 ? plain : cmd)).toBe(false);
    }
  });

  it("zooms once the wheel has rested and a new gesture starts with the modifier", () => {
    const { zooms, wait } = gate();
    zooms(plain);
    wait(16);
    expect(zooms(cmd)).toBe(false);
    wait(WHEEL_GESTURE_GAP_MS + 1);
    expect(zooms(cmd)).toBe(true);
  });

  it("stops zooming when the modifier is let go mid-gesture", () => {
    const { zooms, wait } = gate();
    expect(zooms(cmd)).toBe(true);
    wait(16);
    expect(zooms(plain)).toBe(false);
  });
});
