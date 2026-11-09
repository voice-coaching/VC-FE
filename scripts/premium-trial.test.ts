import assert from "node:assert/strict";
import test, { afterEach } from "node:test";
import {
  activatePremiumTrial,
  loadPremiumTrial,
} from "../src/lib/premium-trial";
import { readCoachingUsage } from "../src/lib/coaching-usage";

const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = originalFetch;
});
const active = {
  status: "ACTIVE",
  eligible: false,
  startsAt: "2026-11-09T03:00:00Z",
  expiresAt: "2026-11-12T03:00:00Z",
};
function respond(data: unknown) {
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ result: true, data }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
}
test("eligibility is read-only and activation trusts only server time", async () => {
  const calls: RequestInit[] = [];
  globalThis.fetch = async (url, init) => {
    assert.equal(url, "/api/backend/api/users/me/premium-trial");
    calls.push(init!);
    return new Response(
      JSON.stringify({
        result: true,
        data:
          init?.method === "POST"
            ? active
            : {
                status: "ELIGIBLE",
                eligible: true,
                startsAt: null,
                expiresAt: null,
              },
      }),
      { headers: { "Content-Type": "application/json" } },
    );
  };
  assert.equal((await loadPremiumTrial()).eligible, true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].method, "GET");
  assert.deepEqual(await activatePremiumTrial(), active);
  assert.equal(calls[1].method, "POST");
  assert.equal(calls[1].body, undefined);
  assert.equal(calls[1].cache, "no-store");
});
test("invalid or non-active grants never show activation success", async () => {
  for (const data of [
    { ...active, expiresAt: "2026-11-13T03:00:00Z" },
    { ...active, eligible: true },
    { ...active, status: "EXPIRED" },
    { status: "INELIGIBLE", eligible: false, startsAt: null, expiresAt: null },
  ]) {
    respond(data);
    await assert.rejects(activatePremiumTrial());
  }
});
test("72-hour unlimited usage requires TRIAL and valid server boundaries", () => {
  const usage = {
    membershipType: "paid",
    environment: "TRIAL",
    unlimited: true,
    startsAt: active.startsAt,
    expiresAt: active.expiresAt,
    limit: null,
    used: 0,
    reserved: 0,
    remaining: null,
    canRequestCoaching: true,
  };
  assert.equal(readCoachingUsage(usage), usage);
  for (const invalid of [
    { ...usage, expiresAt: null },
    { ...usage, limit: 30 },
    { ...usage, environment: "TEST" },
    { ...usage, membershipType: "free" },
    { ...usage, expiresAt: "2026-11-12T03:00:01Z" },
  ])
    assert.throws(() => readCoachingUsage(invalid));
});
