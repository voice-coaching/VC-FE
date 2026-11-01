import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import ts from "typescript";
import { courseIntroduction } from "../src/lib/course-introduction";
import { createCourseMaterialRequests } from "../src/lib/course-materials";
import {
  classPracticeHref,
  classExamplesErrorMessage,
} from "../src/lib/class-practice";
import { ApiError } from "../src/lib/api/client";
import type {
  ApiContract,
  CourseDetail,
  CourseSummary,
  PracticeExamples,
} from "../src/lib/api/types";

const course = {
  id: 1,
  courseType: "INTONATION",
  title: "억양 기초 클래스",
  difficulty: "BEGINNER",
  progressPercent: 0,
} as CourseSummary;
const examples = {
  courseId: 1,
  stepId: 2,
  revision: 1,
  items: [{ id: "a", order: 1, practiceContentId: 5, text: "예문입니다." }],
} as PracticeExamples;

test("class introduction is available synchronously before any backend response", () => {
  assert.equal(
    courseIntroduction(course),
    "문장 끝 억양과 기본 높낮이를 익히는 초급 클래스입니다.",
  );
  assert.match(
    courseIntroduction({
      ...course,
      courseType: "PRONUNCIATION",
      title: "새 클래스",
    }),
    /모음·자음/,
  );
  assert.equal(
    courseIntroduction(course, { description: "갱신된 소개" } as CourseDetail),
    "갱신된 소개",
  );
});

test("hover, open and start share example requests while slow detail cannot block them", async () => {
  let release!: (value: CourseDetail) => void;
  const delayedDetail = new Promise<CourseDetail>((resolve) => {
    release = resolve;
  });
  let detailCalls = 0,
    exampleCalls = 0;
  const api = {
    courses: {
      get: () => {
        detailCalls++;
        return delayedDetail;
      },
    },
    examples: {
      listCourse: async () => {
        exampleCalls++;
        return examples;
      },
    },
  } as unknown as Pick<ApiContract, "courses" | "examples">;
  const materials = createCourseMaterialRequests(api, "user:INTONATION");
  const detail = materials.detail(1);
  assert.equal(materials.detail(1), detail);
  const opened = materials.examples(1);
  assert.equal(materials.examples(1), opened);
  assert.deepEqual(await opened, examples);
  assert.equal(exampleCalls, 1);
  assert.equal(detailCalls, 1);
  release({ description: "나중에 도착한 소개" } as CourseDetail);
  await detail;
});

test("cached material avoids network calls and a failed request can retry", async () => {
  let calls = 0;
  const api = {
    courses: {
      get: async () => {
        throw new Error("Unexpected detail request");
      },
    },
    examples: {
      listCourse: async () => {
        if (++calls === 1) throw new Error("offline");
        return examples;
      },
    },
  } as unknown as Pick<ApiContract, "courses" | "examples">;
  const materials = createCourseMaterialRequests(api, "user:INTONATION");
  assert.deepEqual(await materials.examples(1, examples), examples);
  const detail = { description: "캐시" } as CourseDetail;
  assert.equal(await materials.detail(1, detail), detail);
  assert.equal(calls, 0);
  await assert.rejects(materials.examples(1), /offline/);
  assert.deepEqual(await materials.examples(1), examples);
  assert.equal(calls, 2);
});

test("the actual class start handler navigates using examples without waiting for intro detail", async () => {
  const source = readFileSync("src/components/course-catalog.tsx", "utf8");
  const file = ts.createSourceFile(
    "course-catalog.tsx",
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  let body = "";
  function visit(node: ts.Node) {
    if (ts.isFunctionDeclaration(node) && node.name?.text === "start")
      body = node.body!.getText(file).slice(1, -1);
    ts.forEachChild(node, visit);
  }
  visit(file);
  assert.ok(body);
  let navigated = "";
  const noop = () => {};
  const deps = {
    startBusy: { current: false },
    lifecycle: { current: 1 },
    setStartingId: noop,
    setError: noop,
    progressByCourse: {},
    api: { courses: { start: async () => {} } },
    materials: {
      detail: () => {
        throw new Error("Intro must not block enrollment");
      },
      examples: async () => examples,
    },
    cachedExamples: () => examples,
    writeUserClientCache: noop,
    userId: "user",
    cacheResources: { courseExamples: () => "examples" },
    examplesByCourse: {},
    setExamplesByCourse: noop,
    updateUserClientCache: noop,
    cacheResource: "catalog",
    router: {
      push: (href: string) => {
        navigated = href;
      },
    },
    window: {
      location: { pathname: "/class/intonation", search: "?course=1" },
    },
    classPracticeHref,
    classExamplesErrorMessage,
    ApiError,
  };
  const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
  const execute = new AsyncFunction(
    "course",
    ...Object.keys(deps),
    ts.transpile(`async function run() {${body}}`, {
      target: ts.ScriptTarget.ES2022,
    }) + "\nreturn await run();",
  );
  await execute(course, ...Object.values(deps));
  const url = new URL(navigated, "https://example.test");
  assert.equal(url.pathname, "/practice/5");
  assert.equal(url.searchParams.get("exampleId"), "a");
  assert.equal(deps.startBusy.current, false);
});
