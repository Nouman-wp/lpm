import { describe, expect, it } from "vitest";
import { jobRowPreview } from "./jobRowPreview";
import type { JobInfo } from "../../../jobsFormat";

const job = (over: Partial<JobInfo>): JobInfo => ({
  id: "news",
  valid: true,
  enabled: true,
  ...over,
});

describe("jobRowPreview", () => {
  it("previews the newest message, flattened", () => {
    expect(
      jobRowPreview(job({ lastResult: "completed", lastMessage: "## Done\n**Prices** rose" }), ""),
    ).toEqual({ prefix: "", text: "Done Prices rose", tone: "muted" });
  });

  it("counts several unread messages in front of the preview", () => {
    expect(jobRowPreview(job({ unread: 12, lastMessage: "Hello" }), "")).toEqual({
      prefix: "9+ new · ",
      text: "Hello",
      tone: "unread",
    });
    expect(jobRowPreview(job({ unread: 1, lastMessage: "Hello" }), "").prefix).toBe("");
  });

  it("falls back to what the job does before it has said anything", () => {
    expect(jobRowPreview(job({ description: "Check   for updates" }), "").text).toBe(
      "Check for updates",
    );
    expect(jobRowPreview(job({}), "").text).toBe("No runs yet");
  });

  it("lets a state that needs attention win over the last message", () => {
    const said = { lastMessage: "Old answer" };
    expect(jobRowPreview(job({ ...said, valid: false, error: "Bad action" }), "")).toEqual({
      prefix: "",
      text: "Bad action",
      tone: "error",
    });
    expect(jobRowPreview(job({ ...said, running: true }), "Running — 4m").text).toBe(
      "Running — 4m",
    );
    expect(jobRowPreview(job({ ...said, lastResult: "skipped-pending-copy" }), "").tone).toBe(
      "warning",
    );
    expect(jobRowPreview(job({ ...said, lastResult: "error" }), "")).toEqual({
      prefix: "",
      text: "Problem during the run. Open it to see what happened.",
      tone: "error",
    });
  });
});
