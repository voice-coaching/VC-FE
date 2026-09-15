import assert from "node:assert/strict";
import test from "node:test";
import { getUserTitleProgress, USER_TITLE_LEVELS } from "./user-title";

test("user titles keep the requested order and do not auto-promote", () => {
  assert.deepEqual(
    USER_TITLE_LEVELS.map((level) => level.label),
    ["왕초보", "초보", "동네 아나운서", "아나운서 지망생", "아나운서"],
  );
  assert.equal(getUserTitleProgress("ABSOLUTE_BEGINNER", 60).label, "왕초보");
  assert.equal(getUserTitleProgress("BEGINNER", 60).label, "초보");
  assert.equal(
    getUserTitleProgress("LOCAL_ANNOUNCER", 60).label,
    "동네 아나운서",
  );
});

test("title progress unlocks an exam without awarding its title", () => {
  const progress = getUserTitleProgress(
    "BEGINNER",
    12,
    "2026-09-15T00:00:00.000Z",
  );
  assert.equal(progress.label, "초보");
  assert.equal(progress.next?.label, "동네 아나운서");
  assert.equal(progress.next?.remainingTrainingCount, 3);
  assert.equal(progress.next?.eligible, false);
  assert.equal(progress.next?.passingScore, 75);
  assert.equal(progress.updatedAt, "2026-09-15T00:00:00.000Z");

  const eligible = getUserTitleProgress("BEGINNER", 15);
  assert.equal(eligible.label, "초보");
  assert.equal(eligible.next?.eligible, true);
  assert.equal(eligible.next?.remainingTrainingCount, 0);
});
