import { test } from "node:test";
import assert from "node:assert/strict";
import { initial, othersText } from "../public/header.js";

test("the other people watching read as a sentence", () => {
  assert.equal(othersText([]), "");
  assert.equal(othersText(["Ben"]), "Ben is here too");
  assert.equal(othersText(["Ben", "Cleo"]), "Ben and Cleo are here too");
  assert.equal(othersText(["Ben", "Cleo", "Dev"]), "Ben and 2 others are here too");
});

test("an avatar shows the name's first letter", () => {
  assert.equal(initial("Maya's MacBook Pro"), "M");
  assert.equal(initial("  ana"), "A");
  assert.equal(initial("🦁 den"), "🦁");
  assert.equal(initial(""), "");
});
