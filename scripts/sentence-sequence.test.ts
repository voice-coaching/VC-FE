import assert from "node:assert/strict";
import test from "node:test";
import {
  appendSentenceAdmission,
  readSentenceAdmissions,
  sentencePracticeItems,
  assertSentenceSession,
} from "../src/lib/sentence-sequence";
import type {
  PracticeContent,
  PracticeExamples,
  TrainingSession,
} from "../src/lib/api/types";

const content = {
  id: 5,
  scriptText: "첫 문장입니다. 둘째 문장입니다! 끝 문장입니다?",
} as PracticeContent;
const first = { sessionId: 10, recordingId: 20, analysisId: 30 };

test("restored sentence results must match content, transcript, sentence and selected recording", () => {
  const item = sentencePracticeItems(content)[0];
  const session = {
    id: 10,
    selectedRecordingId: 20,
    content: { id: 5, scriptText: item.text, sentenceIndex: 0 },
  } as TrainingSession;
  assert.doesNotThrow(() => assertSentenceSession(session, first, item));
  for (const changed of [
    { ...session, selectedRecordingId: 21 },
    { ...session, content: { ...session.content!, id: 6 } },
    { ...session, content: { ...session.content!, scriptText: "Changed." } },
    { ...session, content: { ...session.content!, sentenceIndex: 1 } },
  ])
    assert.throws(() => assertSentenceSession(changed, first, item));
});

test("each displayed sentence has a distinct server transcript index", () => {
  const items = sentencePracticeItems(content);
  assert.deepEqual(
    items.map((row) => [row.sentenceIndex, row.text]),
    [
      [0, "첫 문장입니다."],
      [1, "둘째 문장입니다!"],
      [2, "끝 문장입니다?"],
    ],
  );
  assert.equal(new Set(items.map((row) => row.key)).size, 3);
});

test("course sentences preserve example order and their own content identity", () => {
  const examples = {
    items: [
      { id: "a", practiceContentId: 100, text: "A. B." },
      { id: "b", practiceContentId: 101, text: "C." },
    ],
  } as PracticeExamples;
  assert.deepEqual(
    sentencePracticeItems(content, examples).map((row) => [
      row.contentId,
      row.courseExampleIndex,
      row.sentenceIndex,
      row.text,
    ]),
    [
      [100, 0, 0, "A."],
      [100, 0, 1, "B."],
      [101, 1, 0, "C."],
    ],
  );
  assert.deepEqual(
    sentencePracticeItems(content, examples, 1).map((row) => row.text),
    ["C."],
  );
});

test("duplicate callbacks and stale callbacks cannot skip or overwrite sentences", () => {
  const admitted = appendSentenceAdmission([], 0, first);
  assert.equal(appendSentenceAdmission(admitted, 0, first), admitted);
  assert.throws(() =>
    appendSentenceAdmission(admitted, 2, { ...first, sessionId: 11 }),
  );
  assert.throws(() =>
    appendSentenceAdmission(admitted, 0, { ...first, analysisId: 31 }),
  );
  assert.throws(() => appendSentenceAdmission(admitted, 1, first));
  assert.throws(() =>
    appendSentenceAdmission([], 0, {
      ...first,
      analysisId: undefined as never,
    }),
  );
});

test("reloading preserves only validated admitted identities and rejects a changed sequence", () => {
  assert.deepEqual(readSentenceAdmissions([first], 3), [first]);
  assert.deepEqual(readSentenceAdmissions(null, 3), []);
  assert.throws(() => readSentenceAdmissions([first, first], 3));
  assert.throws(() => readSentenceAdmissions([first], 0));
  assert.throws(() =>
    readSentenceAdmissions([{ ...first, recordingId: -1 }], 3),
  );
});
