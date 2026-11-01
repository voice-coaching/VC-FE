import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import * as React from "react";
import ts from "typescript";
import {
  canNavigateBack,
  installNavigationHistory,
  navigationDepth,
} from "../src/lib/navigation-history";
import {
  NAVIGATION_REQUEST_EVENT,
  safeInternalPath,
} from "../src/lib/navigation";

function file(path: string) {
  return ts.createSourceFile(
    path,
    readFileSync(path, "utf8"),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
}
function load(path: string, name: string, deps: Record<string, unknown>) {
  const source = file(path);
  const node = source.statements.find(
    (node) => ts.isFunctionDeclaration(node) && node.name?.text === name,
  );
  assert.ok(node, `Missing actual ${name}`);
  const code = ts.transpile(node.getText(source).replace(/^export\s+/, ""), {
    target: ts.ScriptTarget.ES2022,
    jsx: ts.JsxEmit.React,
  });
  return new Function(...Object.keys(deps), `${code}\nreturn ${name};`)(
    ...Object.values(deps),
  );
}
function exitRequired(path: string, deps: Record<string, unknown>): boolean {
  const source = file(`src/components/${path}.tsx`);
  let expression = "";
  function visit(node: ts.Node) {
    if (
      ts.isVariableDeclaration(node) &&
      node.name.getText(source) === "shouldConfirmExit"
    )
      expression = node.initializer!.getText(source);
    ts.forEachChild(node, visit);
  }
  visit(source);
  assert.ok(expression, `Missing ${path} exit policy`);
  return new Function(...Object.keys(deps), `return ${expression};`)(
    ...Object.values(deps),
  );
}

test("active multi-sentence runs keep the existing confirmation from preparation through the final analysis", () => {
  for (const status of ["idle", "requesting", "recording", "done", "error"]) {
    const required = exitRequired("sentence-practice-sequence", {
      allCompleted: false,
      items: [{}, {}],
      admissions: status === "done" ? [{}, {}] : [],
      recording: status === "recording",
      capture: {
        recorder: { status },
        saving: false,
        allCaptured: status === "done",
        recordedCount: status === "done" ? 2 : 0,
      },
    });
    assert.equal(required, true, status);
  }
});

test("a completed run and an untouched single sentence do not show an interruption prompt", () => {
  for (const [allCompleted, count] of [
    [true, 2],
    [false, 1],
  ] as const)
    assert.equal(
      exitRequired("sentence-practice-sequence", {
        allCompleted,
        items: Array(count).fill({}),
        admissions: [],
        recording: false,
        capture: {
          recorder: { status: "idle" },
          saving: false,
          recordedCount: 0,
        },
      }),
      false,
    );
});

test("single-sentence microphone preparation, saved audio and pending admission also remain protected", () => {
  for (const patch of [
    { recorder: { status: "requesting" } },
    { saving: true },
    { recordedCount: 1 },
  ])
    assert.equal(
      exitRequired("sentence-practice-sequence", {
        allCompleted: false,
        items: [{}],
        admissions: [],
        recording: false,
        capture: {
          recorder: { status: "done" },
          saving: false,
          recordedCount: 0,
          ...patch,
        },
      }),
      true,
    );
});

test("batch practice keeps confirmation after the last recording while feedback is pending", () => {
  for (const finished of [false, true])
    assert.equal(
      exitRequired("sentence-batch-practice-session", {
        finished,
        sentences: ["첫 문장", "다음 문장"],
        recorder: { status: "done" },
        recording: false,
        batch: {
          localComplete: true,
          savingRecordings: false,
          hasAttempt: true,
        },
      }),
      !finished,
    );
});

test("resumed and exam recordings retain the shared modal in errors and background workers never install a second guard", () => {
  for (const phase of [
    "idle",
    "restoring",
    "recording",
    "review",
    "uploading",
    "analyzing",
    "error",
    "result",
  ])
    for (const background of [false, true])
      assert.equal(
        exitRequired("recording-practice-session", {
          phase,
          background,
          showCompletion: false,
          sentences: ["첫 문장", "다음 문장"],
          recorder: { status: "done", blob: null },
          recordingAttempts: [],
        }),
        !background && phase !== "result",
        `${phase} background=${background}`,
      );
});

type Dialog = React.ReactElement<{
  open: boolean;
  onOpenChange: (value: boolean) => void;
}>;
type Guard = {
  dialog: Dialog;
  request: (kind: string, action: () => void) => void;
};
function elements(
  element: unknown,
): React.ReactElement<Record<string, unknown>>[] {
  if (Array.isArray(element)) return element.flatMap(elements);
  if (!React.isValidElement<Record<string, unknown>>(element)) return [];
  return [element, ...elements(element.props.children)];
}

function browser(active: boolean) {
  const events = new EventTarget();
  const entries: unknown[] = [null];
  let index = 0;
  const history = {
    get state() {
      return entries[index];
    },
    pushState(data: unknown) {
      entries.splice(++index);
      entries.push(data);
    },
    replaceState(data: unknown) {
      entries[index] = data;
    },
    go(delta: number) {
      index += delta;
      const event = new Event("popstate");
      Object.defineProperty(event, "state", { value: entries[index] });
      events.dispatchEvent(event);
    },
  };
  installNavigationHistory(history, () => "/practice/10");
  history.pushState({ __NA: true, tree: "practice" });
  const window = Object.assign(events, {
    history,
    location: { href: "https://example.test/practice/10" },
  });
  const document = new EventTarget();
  const refs: Array<{ current: unknown }> = [];
  const cleanups: Array<() => void> = [];
  let cursor = 0,
    rendered = false;
  let intent: unknown = null;
  const hook = load(
    "src/hooks/use-recording-discard-guard.tsx",
    "useRecordingDiscardGuard",
    {
      React,
      window,
      document,
      navigationDepth,
      NAVIGATION_REQUEST_EVENT,
      useState: () => [
        intent,
        (next: unknown) => {
          intent = next;
        },
      ],
      useRef: (value: unknown) =>
        refs[cursor++] ?? (refs[cursor - 1] = { current: value }),
      useEffect: (effect: () => undefined | (() => void)) => {
        if (!rendered) {
          const cleanup = effect();
          if (cleanup) cleanups.push(cleanup);
        }
      },
      AlertDialog: "dialog",
      AlertDialogContent: "section",
      AlertDialogTitle: "h2",
      AlertDialogDescription: "p",
      AlertDialogAction: "button",
      AlertDialogCancel: "button",
    },
  ) as (active: boolean, navigation: boolean) => Guard;
  const render = () => {
    cursor = 0;
    const result = hook(active, true);
    rendered = true;
    return result;
  };
  render();
  const requestNavigation = load("src/lib/navigation.ts", "requestNavigation", {
    window,
    NAVIGATION_REQUEST_EVENT,
    CustomEvent,
  });
  let clock = 1000;
  const Back = load("src/components/back-button.tsx", "BackButton", {
    React,
    window,
    canNavigateBack,
    safeInternalPath,
    requestNavigation,
    Date: { now: () => (clock += 1000) },
    useRef: (current: unknown) => ({ current }),
    useRouter: () => ({
      back: () => history.go(-1),
      replace: () => assert.fail("Expected the existing app history"),
    }),
  }) as (
    props: Record<string, unknown>,
  ) => React.ReactElement<Record<string, unknown>>;
  const back = Back({ fallback: "/news", children: "뒤로" });
  let navigations = 0;
  window.addEventListener("popstate", () => {
    navigations++;
  });
  return {
    render,
    history,
    window,
    get navigations() {
      return navigations;
    },
    back: back.props.onClick as () => void,
    cancel: () => render().dialog.props.onOpenChange(false),
    confirm: () => {
      const action = elements(render().dialog).find(
        (element) => element.type === "button" && element.props.onClick,
      );
      assert.ok(action);
      (action.props.onClick as () => void)();
    },
    cleanup: () => cleanups.forEach((cleanup) => cleanup()),
  };
}

test("header back opens the existing modal; continue preserves the run and stop navigates exactly once", () => {
  const run = browser(true);
  run.back();
  assert.equal(run.render().dialog.props.open, true);
  assert.equal(
    elements(run.render().dialog).find((element) => element.type === "h2")
      ?.props.children,
    "연습을 그만둘까요?",
  );
  assert.equal(run.navigations, 0);
  run.cancel();
  assert.equal(run.render().dialog.props.open, false);
  assert.equal(navigationDepth(run.history.state), 1);
  run.back();
  run.confirm();
  run.confirm();
  assert.equal(run.navigations, 1);
  assert.equal(navigationDepth(run.history.state), 0);
  const unload = new Event("beforeunload", { cancelable: true });
  run.window.dispatchEvent(unload);
  assert.equal(unload.defaultPrevented, false);
  run.cleanup();
});

test("browser back restores the current entry until the same interruption modal is confirmed", () => {
  const run = browser(true);
  run.history.go(-1);
  assert.equal(run.render().dialog.props.open, true);
  assert.equal(navigationDepth(run.history.state), 1);
  assert.equal(run.navigations, 0);
  run.cancel();
  assert.equal(navigationDepth(run.history.state), 1);
  run.history.go(-1);
  run.confirm();
  assert.equal(navigationDepth(run.history.state), 0);
  assert.equal(run.navigations, 1);
  run.cleanup();
});

test("completed practice returns immediately without an interruption modal", () => {
  const run = browser(false);
  run.back();
  assert.equal(run.render().dialog.props.open, false);
  assert.equal(run.navigations, 1);
  run.cleanup();
});
