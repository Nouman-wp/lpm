import { OG_CONTENT_TYPE, OG_SIZE, ogImage } from "@/lib/og-template";

export const alt =
  "lpm — a Mac terminal with a project sidebar: one persistent row per project, holding its terminals and running state.";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function Image() {
  return ogImage({
    headline: ["A Mac terminal with", "a project sidebar."],
    subline:
      "One row per project: its terminals, whether anything is running, and whether Claude Code or Codex is waiting on you.",
    eyebrow: "Project sidebar · macOS",
    platform: "Free · native on macOS",
  });
}
