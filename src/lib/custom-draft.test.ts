import assert from "node:assert/strict";
import test from "node:test";
import {
  countScriptCharacters,
  parseDraft,
  serializeDraft,
} from "./custom-draft";

test("draft round trip preserves whitespace and over-limit pasted text", () => {
  const text = "  첫 문장.\n" + "가".repeat(400);
  assert.equal(parseDraft(serializeDraft(text)), text);
});
test("empty, malformed, and incompatible drafts do not restore", () => {
  for (const value of [
    null,
    "broken",
    "null",
    "[]",
    '{"version":2,"text":"원고"}',
    '{"version":1,"text":7}',
    serializeDraft(" \n"),
  ])
    assert.equal(parseDraft(value), null);
});
test("300-character boundary counts visible characters, spaces, and newlines", () => {
  assert.equal(countScriptCharacters("가".repeat(300)), 300);
  assert.equal(countScriptCharacters("가".repeat(300) + " "), 301);
  assert.equal(countScriptCharacters("가\n나"), 3);
  assert.equal(countScriptCharacters("👨‍👩‍👧‍👦"), 1);
  assert.equal(countScriptCharacters("가"), 1);
});
