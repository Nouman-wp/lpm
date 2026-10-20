import { OG_CONTENT_TYPE, OG_SIZE, ogImage } from "@/lib/og-template";

export const alt =
  "lpm — share a live terminal with anyone, who joins from a link in their browser.";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function Image() {
  return ogImage({
    headline: ["Share your terminal live,", "in any browser."],
    subline:
      "Send a link to one terminal tab. They watch as it happens, with nothing to install, and type only when you let them.",
  });
}
