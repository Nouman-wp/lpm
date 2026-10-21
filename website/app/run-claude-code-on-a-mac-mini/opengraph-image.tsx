import { OG_CONTENT_TYPE, OG_SIZE, ogImage } from "@/lib/og-template";

export const alt =
  "Claude Code and Codex sessions running on a Mac mini, started from lpm on a laptop.";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function Image() {
  return ogImage({
    headline: ["Claude Code and Codex,", "running on your Mac mini."],
    subline:
      "Start them from your laptop. Close the lid, and they keep working. Come back to each session marked Done.",
    eyebrow: "Claude Code and Codex, on the Mac that stays home",
  });
}
