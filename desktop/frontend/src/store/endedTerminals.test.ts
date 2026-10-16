import { afterEach, describe, expect, it } from "vitest";
import { useEndedTerminals } from "./endedTerminals";

describe("useEndedTerminals", () => {
  afterEach(() => useEndedTerminals.setState({ ended: {} }));

  it("keeps the first way a terminal ended", () => {
    const { mark } = useEndedTerminals.getState();
    mark("t1", null);
    mark("t1", 0);
    mark("t2", 3);
    expect(useEndedTerminals.getState().ended).toEqual({ t1: null, t2: 3 });
  });

  it("forgets a terminal once its session is gone", () => {
    const { mark, forget } = useEndedTerminals.getState();
    mark("t1", 1);
    forget("t1");
    forget("never");
    expect(useEndedTerminals.getState().ended).toEqual({});
  });
});
