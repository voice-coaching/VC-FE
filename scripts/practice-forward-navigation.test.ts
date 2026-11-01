import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import { practiceDetailHref } from "../src/lib/practice-entry";
import { safeInternalPath } from "../src/lib/navigation";

function source(path: string) {
  return ts.createSourceFile(
    path,
    readFileSync(path, "utf8"),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
}
function component(path: string, name: string, deps: Record<string, unknown>) {
  const file = source(path);
  const node = file.statements.find(
    (node) => ts.isFunctionDeclaration(node) && node.name?.text === name,
  );
  assert.ok(node, `Missing actual ${name} component`);
  const code = ts.transpile(node.getText(file).replace(/^export\s+/, ""), {
    target: ts.ScriptTarget.ES2022,
    jsx: ts.JsxEmit.React,
  });
  return new Function(...Object.keys(deps), `${code}\nreturn ${name};`)(
    ...Object.values(deps),
  ) as (props: Record<string, unknown>) => React.ReactElement;
}
function buttons(
  element: unknown,
): React.ReactElement<Record<string, unknown>>[] {
  if (Array.isArray(element)) return element.flatMap(buttons);
  if (!React.isValidElement<Record<string, unknown>>(element)) return [];
  return [
    ...(element.type === "button" ? [element] : []),
    ...buttons(element.props.children),
  ];
}
const content = {
  id: 10,
  contentType: "NEWS",
  category: "NEWS",
  difficulty: "BEGINNER",
  title: "오늘의 기사",
  scriptText: "첫 번째 문장입니다.",
  estimatedSeconds: 10,
  referenceAudioAvailable: false,
  targetPronunciations: [],
};
const tick = () => new Promise((resolve) => setImmediate(resolve));
const useState = (initial: unknown) => [
  typeof initial === "function" ? initial() : initial,
  () => {},
];

test("article preview cannot skip an unrecorded article even when the adjacent API has a next item", () => {
  const Preview = component(
    "src/components/practice-detail.tsx",
    "PracticeDetail",
    {
      React,
      useState,
      useEffect: () => {},
      useRouter: () => ({
        push: () => assert.fail("Unrecorded preview must not navigate forward"),
      }),
      useSearchParams: () => new URLSearchParams(),
      getAuthenticatedUserId: () => "owner",
      cacheResources: { adjacentContent: () => "adjacent" },
      readUserClientCache: () => ({ previous: { id: 9 }, next: { id: 11 } }),
      categoryLabel: (value: string) => value,
      splitSentences: () => [content.scriptText],
      ChevronLeft: () => null,
      ChevronRight: () => null,
      ReferencePlayer: () => null,
    },
  );
  const element = Preview({ content, onStart: () => {} });
  const next = buttons(element).find((button) =>
    renderToStaticMarkup(button).includes("다음 기사"),
  );
  assert.ok(next);
  assert.equal(next.props.disabled, true);
  assert.equal(next.props.onClick, undefined);
  assert.match(renderToStaticMarkup(element), /녹음을 완료한 뒤 결과 화면/);
});

function navigation(
  complete: boolean,
  type = "NEWS",
  request = async () => ({ id: 11 }),
) {
  const calls: unknown[] = [];
  const destinations: string[] = [];
  const errors: unknown[] = [];
  let cleanup = () => {};
  let authEpoch = 1;
  const Button = component(
    "src/components/next-practice-content-button.tsx",
    "NextPracticeContentButton",
    {
      React,
      useState: (initial: unknown) => [
        initial,
        (value: unknown) => {
          errors.push(value);
        },
      ],
      useRef: (current: unknown) => ({ current }),
      useLayoutEffect: (effect: () => () => void) => {
        cleanup = effect();
      },
      useSearchParams: () =>
        new URLSearchParams(
          "returnTo=%2Fnews&resumeSequence=1&sessionId=20&start=1",
        ),
      getAuthSessionVersion: () => authEpoch,
      safeInternalPath,
      practiceDetailHref,
      api: {
        content: {
          getAdjacent: async (...args: unknown[]) => {
            calls.push(args);
            return { next: await request() };
          },
          getNext: async (...args: unknown[]) => {
            calls.push(args);
            return await request();
          },
        },
      },
    },
  );
  const element = Button({
    content: { ...content, contentType: type, category: "TENSE_CONSONANT" },
    recordingComplete: complete,
    onNext: (href: string) => destinations.push(href),
  });
  const button = buttons(element)[0];
  return {
    button,
    calls,
    destinations,
    errors,
    click: button.props.onClick as () => void,
    unmount: () => cleanup(),
    logout: () => {
      authEpoch++;
    },
  };
}

test("incomplete recording blocks both the button and its handler without requesting another problem", async () => {
  const run = navigation(false);
  assert.equal(run.button.props.disabled, true);
  run.click();
  await tick();
  assert.deepEqual(run.calls, []);
  assert.deepEqual(run.destinations, []);
});

for (const type of ["NEWS", "SENTENCE", "ANNOUNCER"])
  test(`completed ${type} recording can advance to a fresh problem without carrying the old run`, async () => {
    const run = navigation(true, type);
    assert.equal(run.button.props.disabled, false);
    run.click();
    run.click();
    await tick();
    assert.equal(run.calls.length, 1);
    assert.equal(run.destinations.length, 1);
    const url = new URL(run.destinations[0], "https://example.test");
    assert.equal(url.pathname, "/practice/11");
    for (const param of ["start", "resumeSequence", "sessionId"])
      assert.equal(url.searchParams.has(param), false);
    if (type === "NEWS") assert.equal(url.searchParams.get("previousId"), "10");
    else
      assert.deepEqual(run.calls[0], [
        {
          type,
          category: "TENSE_CONSONANT",
          difficulty: "BEGINNER",
          excludeId: 10,
        },
      ]);
  });

test("failed next-content requests retain the current result and permit an explicit retry", async () => {
  let attempts = 0;
  const run = navigation(true, "NEWS", async () => {
    if (++attempts === 1) throw new Error("temporary failure");
    return { id: 11 };
  });
  run.click();
  await tick();
  assert.deepEqual(run.destinations, []);
  assert.ok(run.errors.includes("temporary failure"));
  run.click();
  await tick();
  assert.equal(run.destinations.length, 1);
});

for (const invalidate of ["unmount", "logout"] as const)
  test(`a late next-content response cannot navigate after ${invalidate}`, async () => {
    let resolve!: (value: { id: number }) => void;
    const deferred = new Promise<{ id: number }>((done) => {
      resolve = done;
    });
    const run = navigation(true, "NEWS", () => deferred);
    run.click();
    run[invalidate]();
    resolve({ id: 11 });
    await tick();
    assert.deepEqual(run.destinations, []);
  });

test("the active sequence requires every recording to finish and save before enabling forward navigation", () => {
  const file = source("src/components/sentence-practice-sequence.tsx");
  let gate = "";
  function visit(node: ts.Node) {
    if (
      ts.isVariableDeclaration(node) &&
      node.name.getText(file) === "canAdvance"
    )
      gate = node.initializer!.getText(file);
    ts.forEachChild(node, visit);
  }
  visit(file);
  assert.ok(gate, "The active sequence completion gate must be exercised");
  const allowed = new Function(
    "allCompleted",
    "capture",
    "recording",
    `return ${gate};`,
  );
  const captured = {
    allCaptured: true,
    saving: false,
    hasFailedSave: false,
    error: null,
  };
  assert.equal(allowed(true, captured, false), true);
  assert.equal(allowed(false, captured, false), false);
  assert.equal(allowed(true, captured, true), false);
  for (const patch of [
    { allCaptured: false },
    { saving: true },
    { hasFailedSave: true },
    { error: "failed" },
  ])
    assert.equal(
      Boolean(allowed(true, { ...captured, ...patch }, false)),
      false,
    );
});

function completion(deps: Record<string, unknown>) {
  const file = source("src/components/sentence-practice-sequence.tsx");
  let callback = "";
  function visit(node: ts.Node) {
    if (
      ts.isJsxAttribute(node) &&
      node.name.getText(file) === "onConfirm" &&
      node.initializer &&
      ts.isJsxExpression(node.initializer)
    )
      callback = node.initializer.expression!.getText(file);
    ts.forEachChild(node, visit);
  }
  visit(file);
  assert.ok(callback, "The active report confirmation must be exercised");
  const code = ts.transpile(`const confirm = ${callback};`, {
    target: ts.ScriptTarget.ES2022,
  });
  return new Function(...Object.keys(deps), code + "\nreturn confirm;")(
    ...Object.values(deps),
  ) as (saved: boolean) => Promise<void>;
}

test("report confirmation cannot bypass the recording-completion gate", async () => {
  const confirm = completion({ canAdvance: false });
  await assert.rejects(confirm(false), /모든 문장의 녹음을 완료한 뒤/);
});

test("next-problem navigation waits for the report choice and recording cleanup", async () => {
  const calls: string[] = [];
  const confirm = completion({
    canAdvance: true,
    admissions: [{ sessionId: 1 }, { sessionId: 2 }],
    reportSaves: {
      set: async (_kind: string, id: number, saved: boolean) => {
        assert.equal(saved, false);
        calls.push(`save-${id}`);
      },
    },
    courseId: null,
    courseStepId: null,
    invalidateLearningCaches: () => calls.push("invalidate"),
    mounted: { current: true },
    authEpoch: { current: 1 },
    getAuthSessionVersion: () => 1,
    capture: {
      cleanup: async () => {
        calls.push("cleanup");
      },
    },
    removeUserClientCache: () => calls.push("cache"),
    userId: "owner",
    resource: "run",
    nextHref: "/practice/11?returnTo=%2Fnews",
    router: {
      push: (href: string) => {
        assert.equal(href, "/practice/11?returnTo=%2Fnews");
        calls.push("navigate");
      },
    },
  });
  await confirm(false);
  assert.deepEqual(calls, [
    "save-1",
    "save-2",
    "invalidate",
    "cleanup",
    "cache",
    "navigate",
  ]);
});
