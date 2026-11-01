import assert from "node:assert/strict";
import test from "node:test";
import {
  admittedSequenceHref,
  initialSentenceAdmissions,
  practiceDetailHref,
  practiceStartsImmediately,
  sentenceResumeRequested,
} from "../src/lib/practice-entry";
import { classPracticeHref } from "../src/lib/class-practice";
import type { PracticeExamples } from "../src/lib/api/types";

const saved = [{ sessionId: 10, recordingId: 20, analysisId: 30 }];
for (const type of ["news", "sentences", "announcer"]) {
  test(`${type} catalog entry shows detail and never restores old analysis implicitly`, () => {
    const url = new URL(
      practiceDetailHref(5, `/${type}`),
      "https://example.test",
    );
    assert.equal(practiceStartsImmediately(url.searchParams), false);
    assert.equal(sentenceResumeRequested(url.searchParams), false);
    assert.deepEqual(initialSentenceAdmissions(false, saved, 1), []);
    assert.deepEqual(
      initialSentenceAdmissions(false, { corrupted: true }, 1),
      [],
    );
  });
}

for (const type of ["PRONUNCIATION", "INTONATION"]) {
  test(`${type} class start opens recording preparation without restoring previous results`, () => {
    const examples = {
      courseId: 1,
      stepId: 2,
      revision: 3,
      items: [{ id: "example-1", practiceContentId: 5 }],
    } as PracticeExamples;
    const url = new URL(
      classPracticeHref(examples, 0, "/class"),
      "https://example.test",
    );
    assert.equal(practiceStartsImmediately(url.searchParams), true);
    assert.equal(sentenceResumeRequested(url.searchParams), false);
    assert.deepEqual(initialSentenceAdmissions(false, saved, 1), []);
  });
}

test("only an admitted run adds explicit resume intent, which survives reload without bypassing detail on a new catalog visit", () => {
  const href = admittedSequenceHref(
    "https://example.test/practice/5?returnTo=%2Fnews#sentence",
  );
  const resumed = new URL(href, "https://example.test");
  assert.equal(resumed.searchParams.get("returnTo"), "/news");
  assert.equal(resumed.hash, "#sentence");
  assert.equal(practiceStartsImmediately(resumed.searchParams), true);
  assert.equal(sentenceResumeRequested(resumed.searchParams), true);
  assert.equal(initialSentenceAdmissions(true, saved, 1), saved);
  assert.equal(
    sentenceResumeRequested(
      new URL(practiceDetailHref(5, "/news"), resumed).searchParams,
    ),
    false,
  );
});

test("metadata revalidation preserves the active run and cannot restore an unrelated old run", () => {
  const current = [{ sessionId: 11, recordingId: 21, analysisId: 31 }];
  assert.equal(initialSentenceAdmissions(false, saved, 1, current), current);
  assert.deepEqual(initialSentenceAdmissions(false, saved, 1, []), []);
  assert.throws(() => initialSentenceAdmissions(true, [{ analysisId: -1 }], 1));
});
