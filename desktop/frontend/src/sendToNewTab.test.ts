import { describe, expect, it } from "vitest";
import { promptWithImagePaths } from "./sendToNewTab";

describe("promptWithImagePaths", () => {
  it("puts each image's path where its chip was", () => {
    expect(
      promptWithImagePaths("Match [Image #1] and [Image #2]", {
        1: "/tmp/a.png",
        2: "/tmp/Screenshot 1.png",
      }),
    ).toBe('Match  /tmp/a.png  and  "/tmp/Screenshot 1.png"');
  });

  it("keeps a token with no image as the text it is", () => {
    expect(promptWithImagePaths("See [Image #3]", {})).toBe("See [Image #3]");
  });
});
