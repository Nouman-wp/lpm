import { describe, expect, it } from "vitest";
import YAML from "yaml";
import firstLaunchSource from "../src-tauri/src/firstlaunch.rs?raw";
import { AGENT_EMOJI_CHOICES, agentForEmoji, matchingAgentEmoji } from "./agentEmoji";

function seededGlobalActions(): Record<string, { emoji?: string; cmd: string }> {
  const yml = firstLaunchSource.match(/DEFAULT_GLOBAL_YML: &str = "([^"]*)"/)?.[1];
  if (!yml) throw new Error("DEFAULT_GLOBAL_YML not found");
  return YAML.parse(yml).actions;
}

describe("agentForEmoji", () => {
  it("reads each agent's glyph back as that agent", () => {
    for (const { agent, emoji } of AGENT_EMOJI_CHOICES) {
      expect(agentForEmoji(emoji)).toBe(agent);
      expect(agentForEmoji(` ${emoji} `)).toBe(agent);
    }
  });

  it("draws each first-launch agent action with its own agent's mark", () => {
    const actions = Object.values(seededGlobalActions());
    expect(actions.map((a) => a.cmd)).toEqual(["claude", "codex"]);
    for (const action of actions) expect(agentForEmoji(action.emoji)).toBe(action.cmd);
  });

  it("leaves real emoji and blanks alone", () => {
    for (const emoji of [undefined, "", "  ", "🚀", "✨", "🤖", "✻✻"]) {
      expect(agentForEmoji(emoji)).toBeNull();
    }
  });
});

describe("matchingAgentEmoji", () => {
  it("lists every agent for an empty search", () => {
    expect(matchingAgentEmoji("  ")).toHaveLength(AGENT_EMOJI_CHOICES.length);
  });

  it("finds an agent by its name or id, ignoring case", () => {
    expect(matchingAgentEmoji("CLA").map((c) => c.agent)).toEqual(["claude"]);
    expect(matchingAgentEmoji("opencode").map((c) => c.agent)).toEqual(["opencode"]);
    expect(matchingAgentEmoji("rocket")).toEqual([]);
  });
});
