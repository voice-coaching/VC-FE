import test from "node:test";
import assert from "node:assert/strict";
import { tokenDisallowsAdmin } from "./token";

test("only an explicit USER access claim triggers early rejection, never positive authorization", () => {
  const token = (claims: unknown) =>
    `header.${Buffer.from(JSON.stringify(claims)).toString("base64url")}.signature`;
  assert.equal(
    tokenDisallowsAdmin(token({ type: "access", role: "USER" })),
    true,
  );
  assert.equal(
    tokenDisallowsAdmin(token({ type: "access", role: "ADMIN" })),
    false,
  );
  for (const value of [
    null,
    "invalid",
    token({ role: "USER" }),
    token({ type: "refresh", role: "USER" }),
  ])
    assert.equal(tokenDisallowsAdmin(value), false);
});
