import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test, { afterEach } from "node:test";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import { createRemoteApi } from "../src/lib/api/remote";
import { createCanonicalAnalysisClient } from "../src/lib/api/canonical";
import {
  ApiError,
  clearAccessToken,
  getAccessToken,
  saveAccessToken,
} from "../src/lib/api/client";
import {
  assertCoachingInput,
  coachingLimitNotice,
  coachingPeriodDate,
  readCoachingUsage,
} from "../src/lib/coaching-usage";
import { describePracticeError } from "../src/lib/practice-error";
import type { CoachingUsage } from "../src/lib/api/types";

const free: CoachingUsage = {
  membershipType: "free",
  environment: null,
  unlimited: false,
  startsAt: "2050-11-01T00:00:00Z",
  expiresAt: "2050-12-01T00:00:00Z",
  limit: 8,
  used: 3,
  reserved: 1,
  remaining: 4,
  canRequestCoaching: true,
};
const admin: CoachingUsage = {
  membershipType: "admin",
  environment: "TEST",
  unlimited: true,
  startsAt: null,
  expiresAt: null,
  limit: null,
  used: 0,
  reserved: 0,
  remaining: null,
  canRequestCoaching: true,
};
const paid: CoachingUsage = {
  ...free,
  membershipType: "paid",
  environment: "TEST",
  limit: 30,
  remaining: 26,
};
const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = originalFetch;
  clearAccessToken();
});
function component(path: string, name: string, deps: Record<string, unknown>) {
  const file = ts.createSourceFile(
    path,
    readFileSync(path, "utf8"),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const code = file.statements
    .find((node) => ts.isFunctionDeclaration(node) && node.name?.text === name)
    ?.getText(file);
  assert.ok(code);
  return new Function(
    ...Object.keys(deps),
    ts.transpile(code.replace(/^export /, ""), {
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.React,
    }) + `\nreturn ${name};`,
  )(...Object.values(deps));
}
test("free, TEST paid and admin responses preserve server counts and nullable fields", () => {
  for (const data of [
    free,
    paid,
    admin,
    { ...free, remaining: 0, canRequestCoaching: false },
  ])
    assert.equal(readCoachingUsage(data), data);
  for (const data of [
    null,
    {},
    { ...free, remaining: undefined },
    { ...free, reserved: -1 },
    { ...free, remaining: 9 },
    { ...free, expiresAt: "invalid" },
    { ...admin, unlimited: false },
    { ...free, unlimited: true },
    { ...free, remaining: 0, canRequestCoaching: true },
  ])
    assert.throws(() => readCoachingUsage(data));
});
test("usage is an authenticated no-store read and has no user ID parameter", async () => {
  saveAccessToken("coaching-test-token");
  let requests = 0;
  globalThis.fetch = async (url, init) => {
    requests++;
    assert.equal(String(url), "/api/backend/api/users/me/coaching-usage");
    assert.equal(init?.cache, "no-store");
    assert.equal(
      new Headers(init?.headers).get("authorization"),
      "Bearer coaching-test-token",
    );
    return Response.json({ result: true, data: free });
  };
  assert.deepEqual(
    await createRemoteApi("/api/backend").users.getCoachingUsage(),
    free,
  );
  assert.equal(requests, 1);
});
test("quota and period refusals remain distinct from authentication errors, including on retry", async () => {
  saveAccessToken("coaching-test-token");
  let calls = 0;
  const client = createCanonicalAnalysisClient("/api/backend");
  for (const code of [
    "COACHING_QUOTA_EXCEEDED",
    "COACHING_PERIOD_EXPIRED",
    "COACHING_SCRIPT_LIMIT_EXCEEDED",
    "COACHING_AUDIO_LIMIT_EXCEEDED",
  ]) {
    const status =
      code.includes("QUOTA") || code.includes("PERIOD") ? 403 : 422;
    globalThis.fetch = async (url, init) => {
      calls++;
      assert.match(String(url), /\/(analyze|analysis\/retry)$/);
      assert.equal(
        new Headers(init?.headers).get("X-Analysis-Result-Schema"),
        "voice-coaching.runpod-analysis-result.v6",
      );
      assert.deepEqual(JSON.parse(String(init?.body)), {
        accepted: true,
        policyRevision: "current-policy",
      });
      return Response.json(
        { result: false, code, message: "server refusal", data: null },
        { status },
      );
    };
    for (const send of [client.analyze, client.retry])
      await assert.rejects(
        send(141, { accepted: true, policyRevision: "current-policy" }),
        (error: unknown) => {
          assert.ok(error instanceof ApiError);
          assert.equal(error.status, status);
          assert.equal(error.code, code);
          assert.notEqual(describePracticeError(error).kind, "auth");
          assert.ok(coachingLimitNotice(error));
          return true;
        },
      );
    assert.equal(getAccessToken(), "coaching-test-token");
  }
  assert.equal(calls, 8); // no automatic resubmission or token refresh for these refusals
  assert.equal(
    describePracticeError(new ApiError("auth", 401, "AUTHENTICATION_REQUIRED"))
      .kind,
    "auth",
  );
});
test("300 code points and 90 seconds are inclusive for all plans", () => {
  assert.doesNotThrow(() => assertCoachingInput("😀".repeat(300), 90_000));
  for (const [script, duration, code] of [
    ["가".repeat(301), 1000, "COACHING_SCRIPT_LIMIT_EXCEEDED"],
    ["가".repeat(300) + " ", 1000, "COACHING_SCRIPT_LIMIT_EXCEEDED"],
    ["👨‍👩‍👧‍👦".repeat(43), 1000, "COACHING_SCRIPT_LIMIT_EXCEEDED"],
    [" \n", 1000, "COACHING_SCRIPT_LIMIT_EXCEEDED"],
    ["문장", 90001, "COACHING_AUDIO_LIMIT_EXCEEDED"],
    ["문장", 0, "COACHING_AUDIO_LIMIT_EXCEEDED"],
  ] as const)
    assert.throws(
      () => assertCoachingInput(script, duration),
      (error: unknown) => error instanceof ApiError && error.code === code,
    );
});
test("usage UI displays reservations, real expiry, TEST membership and admin input limits", () => {
  for (const data of [free, paid, admin]) {
    const Summary = component(
      "src/components/coaching-usage-summary.tsx",
      "CoachingUsageSummary",
      {
        React,
        coachingPeriodDate,
        useCoachingUsage: () => ({
          data,
          isPending: false,
          isError: false,
          isFetching: false,
          refetch: () => {},
        }),
      },
    );
    const markup = renderToStaticMarkup(Summary({}));
    if (data.unlimited) {
      assert.ok(markup.includes("횟수 제한 없음"));
      assert.ok(markup.includes("90초"));
      assert.ok(!markup.includes("null"));
    } else {
      assert.ok(markup.includes(`${data.remaining}회 / ${data.limit}회`));
      assert.ok(markup.includes("예약 1회"));
      assert.ok(markup.includes(coachingPeriodDate(data.expiresAt!)));
    }
    if (data.membershipType === "free")
      assert.ok(markup.includes("매월 새로 지급되지 않아요"));
    if (data.membershipType === "paid")
      assert.ok(markup.includes("TEST 이용권"));
  }
  const Summary = component(
    "src/components/coaching-usage-summary.tsx",
    "CoachingUsageSummary",
    {
      React,
      coachingPeriodDate,
      useCoachingUsage: () => ({
        data: null,
        isPending: false,
        isError: true,
        isFetching: false,
        refetch: () => {},
      }),
    },
  );
  const markup = renderToStaticMarkup(Summary({}));
  assert.ok(markup.includes("사용량 다시 확인"));
  assert.ok(!markup.includes("8회"));
  assert.ok(!markup.includes("횟수 제한 없음"));
});
test("usage requests are keyed by account and epoch, refresh on mutations and discard late replies", async () => {
  let epoch = 7;
  const effects: Array<() => void | (() => void)> = [];
  type QueryOptions = {
    queryKey: unknown;
    staleTime: number;
    gcTime: number;
    queryFn: () => Promise<unknown>;
  };
  let options!: QueryOptions;
  const events = new Map<string, () => void>();
  let invalidations = 0;
  const hook = component(
    "src/hooks/use-coaching-usage.ts",
    "useCoachingUsage",
    {
      useEffect: (effect: () => void | (() => void)) => effects.push(effect),
      useSyncExternalStore: () => epoch,
      subscribeAuthSession: () => {},
      getAuthSessionVersion: () => epoch,
      getAuthenticatedUserId: () => "owner-a",
      ApiError,
      useQueryClient: () => ({
        invalidateQueries: () => {
          invalidations++;
          return Promise.resolve();
        },
      }),
      useQuery: (input: QueryOptions) => {
        options = input;
        return { data: null };
      },
      api: { users: { getCoachingUsage: async () => free } },
      COACHING_USAGE_CHANGED: "usage-change",
      window: {
        addEventListener: (name: string, fn: () => void) =>
          events.set(name, fn),
        removeEventListener: (name: string) => events.delete(name),
      },
    },
  );
  hook();
  assert.deepEqual(options.queryKey, ["coaching-usage", "owner-a", 7]);
  assert.equal(options.staleTime, 0);
  assert.equal(options.gcTime, 0);
  const cleanup = effects[0]();
  events.get("usage-change")!();
  assert.equal(invalidations, 1);
  const pending = options.queryFn();
  epoch = 8;
  await assert.rejects(
    pending,
    (error: unknown) =>
      error instanceof ApiError && error.code === "AUTH_SESSION_CHANGED",
  );
  if (typeof cleanup === "function") cleanup();
  assert.equal(events.size, 0);
});

test("a month-long usage period re-arms the browser timer and refreshes at the real expiry", () => {
  let now = Date.parse(free.startsAt!);
  const effects: Array<() => void | (() => void)> = [];
  const timers: Array<{ run: () => void; delay: number }> = [];
  let refreshed = 0,
    cleared = 0;
  const hook = component(
    "src/hooks/use-coaching-usage.ts",
    "useCoachingUsage",
    {
      useEffect: (effect: () => void | (() => void)) => effects.push(effect),
      useSyncExternalStore: () => 1,
      subscribeAuthSession: () => {},
      getAuthSessionVersion: () => 1,
      getAuthenticatedUserId: () => "owner",
      ApiError,
      useQuery: () => ({ data: free }),
      useQueryClient: () => ({
        invalidateQueries: () => {
          refreshed++;
          return Promise.resolve();
        },
      }),
      COACHING_USAGE_CHANGED: "usage-change",
      api: {},
      Date: { parse: Date.parse, now: () => now },
      window: {
        setTimeout: (run: () => void, delay: number) => {
          timers.push({ run, delay });
          return timers.length;
        },
        clearTimeout: () => {
          cleared++;
        },
      },
    },
  );
  hook();
  const cleanup = effects[1]();
  assert.equal(timers[0].delay, 2_147_483_647);
  now += timers[0].delay;
  timers[0].run();
  assert.ok(timers[1].delay > 24 * 60 * 60 * 1000);
  assert.equal(refreshed, 0);
  now = Date.parse(free.expiresAt!) + 1;
  timers[1].run();
  assert.equal(refreshed, 1);
  if (typeof cleanup === "function") cleanup();
  assert.equal(cleared, 1);
});
