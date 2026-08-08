import assert from "node:assert/strict";
import {
  createDevSession,
  DEV_ACCOUNT,
  isDevAccountEnabled,
} from "../src/lib/dev-account";

assert.equal(isDevAccountEnabled("development"), true);
assert.equal(isDevAccountEnabled("production"), false);
assert.equal(
  createDevSession(
    { email: DEV_ACCOUNT.email, password: DEV_ACCOUNT.password },
    "development",
  )?.user.nickname,
  DEV_ACCOUNT.nickname,
);
assert.equal(
  createDevSession(
    { email: DEV_ACCOUNT.email, password: "wrong-password" },
    "development",
  ),
  null,
);
assert.equal(
  createDevSession(
    { email: DEV_ACCOUNT.email, password: DEV_ACCOUNT.password },
    "production",
  ),
  null,
);

console.log("Development account verification passed");
