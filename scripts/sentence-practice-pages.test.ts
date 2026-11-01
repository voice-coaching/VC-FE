import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import { sentencePracticeItems } from "../src/lib/sentence-sequence";
import { sentenceResumeRequested } from "../src/lib/practice-entry";

function source(path: string) {
  return ts.createSourceFile(
    path,
    readFileSync(path, "utf8"),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
}
function evaluate(code: string, result: string, deps: Record<string, unknown>) {
  const js = ts.transpile(code, {
    target: ts.ScriptTarget.ES2022,
    jsx: ts.JsxEmit.React,
  });
  return new Function(...Object.keys(deps), `${js}\nreturn ${result};`)(
    ...Object.values(deps),
  );
}
function component(path: string, name: string, deps: Record<string, unknown>) {
  const file = source(path);
  const node = file.statements.find(
    (node) => ts.isFunctionDeclaration(node) && node.name?.text === name,
  );
  assert.ok(node, `Missing actual ${name}`);
  return evaluate(node.getText(file).replace(/^export\s+/, ""), name, deps) as (
    props: Record<string, unknown>,
  ) => React.ReactElement;
}
function children(
  element: unknown,
): React.ReactElement<Record<string, unknown>>[] {
  if (Array.isArray(element)) return element.flatMap(children);
  if (!React.isValidElement<Record<string, unknown>>(element)) return [];
  return [element, ...children(element.props.children)];
}
const noop = () => {};
const sentences = [
  "첫 번째 문장입니다.",
  "두 번째 문장입니다!",
  "마지막 문장입니다?",
];
const Reader = component(
  "src/components/sentence-reader.tsx",
  "SentenceReader",
  {
    React,
    useRef: () => ({ current: null }),
    useEffect: noop,
  },
);
const AnalysisLoader = component(
  "src/components/practice-analysis-loading.tsx",
  "PracticeAnalysisLoading",
  {
    React,
    Image: (props: Record<string, unknown>) =>
      React.createElement("img", props),
    AnalysisLoadingMessage: () => React.createElement("span", null, "분석 중"),
  },
);
function assertPage(
  props: Record<string, unknown>,
  index: number,
  expected = sentences,
) {
  const markup = renderToStaticMarkup(Reader(props));
  assert.equal((markup.match(/<li\b/g) ?? []).length, 1);
  assert.ok(markup.includes(expected[index]));
  for (const sentence of expected.filter((_, other) => other !== index))
    assert.ok(!markup.includes(sentence));
  assert.ok(markup.includes(`data-sentence-page="${index + 1}"`));
  assert.ok(markup.includes(`start="${index + 1}"`));
}

test("each reader page contains only its current sentence and original sentence number", () => {
  for (const variant of ["reader", "recording"])
    sentences.forEach((_, pageIndex) =>
      assertPage(
        {
          sentences,
          pageIndex,
          activeIndex: variant === "recording" ? pageIndex : undefined,
          variant,
        },
        pageIndex,
      ),
    );
});

test("the script-library source preview still renders the full manuscript", () => {
  const markup = renderToStaticMarkup(Reader({ sentences, variant: "cards" }));
  assert.equal((markup.match(/<li\b/g) ?? []).length, 3);
  for (const sentence of sentences) assert.ok(markup.includes(sentence));
});

function sequence(
  type: string,
  status: string,
  waiting = false,
  examples?: unknown,
) {
  const content = {
    id: 10,
    contentType: type,
    learningFocus: "PRONUNCIATION",
    scriptText: sentences.join(" "),
    referenceAudioAvailable: true,
  };
  const Sequence = component(
    "src/components/sentence-practice-sequence.tsx",
    "SentencePracticeSequence",
    {
      React,
      useState: (initial: unknown) => [
        typeof initial === "function" ? initial() : initial,
        noop,
      ],
      useRef: (current: unknown) => ({ current }),
      useEffect: noop,
      useCallback: (callback: unknown) => callback,
      useMemo: (compute: () => unknown) => compute(),
      useRouter: () => ({}),
      useSearchParams: () => new URLSearchParams(),
      getAuthenticatedUserId: () => "owner",
      getAuthSessionVersion: () => 1,
      sentenceResumeRequested,
      sentencePracticeItems,
      useAuthenticatedSentenceCapture: () => ({
        ready: true,
        allCaptured: waiting,
        saving: false,
        recordedCount: 1,
        files: {},
        nextIndex: 1,
        recorder: {
          status,
          index: 1,
          elapsedMs: 1200,
          splitting: false,
          getStream: () => null,
        },
      }),
      useRecordingDiscardGuard: () => ({ dialog: null }),
      SentenceReader: Reader,
      PracticeAnalysisLoading: AnalysisLoader,
      CoachingUsageSummary: () => null,
      SentenceRecordingControls: () => null,
      MicrophonePermissionNotice: () => null,
    },
  );
  const tree = Sequence({ content, courseExamples: examples });
  const reader = children(tree).find((element) => element.type === Reader);
  return { tree, reader };
}

for (const type of ["SENTENCE", "NEWS", "ANNOUNCER", "CUSTOM"])
  test(`active ${type} practice displays one sentence per page before and during capture`, () => {
    for (const status of ["idle", "requesting", "recording", "error"]) {
      const { reader } = sequence(type, status);
      assert.ok(reader);
      assertPage(reader.props, 1);
    }
  });

test("pronunciation and intonation class pages preserve their example order", () => {
  const examples = {
    items: [
      { id: "first", practiceContentId: 20, text: sentences[0] },
      {
        id: "second",
        practiceContentId: 21,
        text: sentences.slice(1).join(" "),
      },
    ],
  };
  const { reader } = sequence("SENTENCE", "recording", false, examples);
  assert.ok(reader);
  assertPage(reader.props, 1);
});

test("the final analysis wait does not re-display the first sentence as another practice page", () => {
  const { reader, tree } = sequence("NEWS", "done", true);
  assert.equal(reader, undefined);
  const markup = renderToStaticMarkup(tree);
  assert.ok(markup.includes("음성 품질 확인"));
  assert.ok(markup.includes("발음과 억양 분석"));
  assert.ok(!markup.includes(sentences[0]));
});

for (const path of [
  "recording-practice-session",
  "sentence-batch-practice-session",
])
  test(`${path} uses the same single-sentence pages for resumed, local and exam capture`, () => {
    const file = source(`src/components/${path}.tsx`);
    let jsx = "";
    function visit(node: ts.Node) {
      if (
        ts.isJsxSelfClosingElement(node) &&
        node.tagName.getText(file) === "SentenceReader"
      )
        jsx = node.getText(file);
      ts.forEachChild(node, visit);
    }
    visit(file);
    assert.ok(jsx);
    for (const phase of ["idle", "recording"]) {
      const element = evaluate(`const page = ${jsx};`, "page", {
        React,
        SentenceReader: Reader,
        phase,
        recording: phase === "recording",
        active: 1,
        activeSentence: 1,
        sentences,
      }) as React.ReactElement<Record<string, unknown>>;
      assertPage(element.props, 1);
    }
  });

test("the sentence page changes only after the current recording split succeeds", async () => {
  const file = source("src/hooks/use-sentence-recorder.ts");
  let arrow = "";
  function visit(node: ts.Node) {
    if (
      ts.isVariableDeclaration(node) &&
      node.name.getText(file) === "advance" &&
      node.initializer &&
      ts.isCallExpression(node.initializer)
    )
      arrow = node.initializer.arguments[0].getText(file);
    ts.forEachChild(node, visit);
  }
  visit(file);
  assert.ok(arrow);
  let finish!: (blob: Blob) => void;
  const split = new Promise<Blob>((resolve) => {
    finish = resolve;
  });
  let page = 0,
    error = "";
  const deps = {
    running: { current: true },
    transition: { current: false },
    generation: { current: 1 },
    currentIndex: { current: 0 },
    audio: { current: { split: () => split } },
    callback: { current: (index: number) => index + 1 },
    setSplitting: noop,
    setIndex: (index: number) => {
      page = index;
    },
    started: { current: 0 },
    setElapsedMs: noop,
    release: noop,
    setStatus: noop,
    setError: (message: string) => {
      error = message;
    },
  };
  const advance = evaluate(
    `const advance = ${arrow};`,
    "advance",
    deps,
  ) as () => Promise<void>;
  const pending = advance();
  assert.equal(page, 0);
  finish(new Blob(["captured PCM"]));
  await pending;
  assert.equal(page, 1);
  deps.audio.current.split = () => Promise.reject(new Error("capture failed"));
  await advance();
  assert.equal(page, 1);
  assert.equal(error, "capture failed");
  deps.running.current = false;
  await advance();
  assert.equal(page, 1);
});
