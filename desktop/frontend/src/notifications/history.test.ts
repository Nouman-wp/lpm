import { beforeEach, describe, expect, it } from "vitest";
import { selectUnreadAttention, useNotificationHistory, type NotificationRecord } from "./history";

const entry = (patch: Partial<NotificationRecord> = {}): NotificationRecord => ({
  id: "t1",
  kind: "success",
  title: "Pulled 2 projects",
  actions: [],
  count: 1,
  at: 1,
  ...patch,
});

describe("useNotificationHistory", () => {
  beforeEach(() => useNotificationHistory.getState().clear());

  it("keeps the newest first and replaces an entry updated under the same id", () => {
    const { record } = useNotificationHistory.getState();
    record(entry({ id: "a" }));
    record(entry({ id: "b" }));
    record(entry({ id: "a", title: "Pulled 3 projects", count: 2 }));

    const { entries } = useNotificationHistory.getState();
    expect(entries.map((e) => e.id)).toEqual(["a", "b"]);
    expect(entries[0]).toMatchObject({ title: "Pulled 3 projects", count: 2, read: false });
  });

  it("counts only unread failures and waiting agents for the bell", () => {
    const { record, markRead } = useNotificationHistory.getState();
    record(entry({ id: "ok" }));
    record(entry({ id: "fail", kind: "error" }));
    record(entry({ id: "wait", kind: "warning", event: "agentWaiting" }));
    expect(selectUnreadAttention(useNotificationHistory.getState())).toBe(2);

    markRead("fail");
    expect(selectUnreadAttention(useNotificationHistory.getState())).toBe(1);

    useNotificationHistory.getState().markAllRead();
    expect(selectUnreadAttention(useNotificationHistory.getState())).toBe(0);
  });
});
