import assert from "node:assert/strict";
import test from "node:test";
import {
  selectRecipients,
  MAX_CAMPAIGN_RECIPIENTS,
} from "./recipient-selection";
const member = (id: number, status = "ACTIVE") => ({
  id,
  nickname: `member ${id}`,
  status,
});

test("page/search selections merge without duplicates or inactive accounts", () => {
  const selected = selectRecipients(
    [{ id: 99 }],
    [member(1), member(2), member(1), member(3, "SUSPENDED")],
  );
  assert.deepEqual(
    selected.map((item) => item.id),
    [99, 1, 2],
  );
  assert.deepEqual(
    selectRecipients(selected, [member(2), member(4)]).map((item) => item.id),
    [99, 1, 2, 4],
  );
  assert.equal(
    selectRecipients(selected, [member(99)])[0].nickname,
    "member 99",
  );
});
test("selection is bounded at the existing 500-member contract limit", () => {
  const current = Array.from(
    { length: MAX_CAMPAIGN_RECIPIENTS - 1 },
    (_, i) => ({ id: i + 1 }),
  );
  const selected = selectRecipients(current, [
    member(500),
    member(501),
    member(1),
  ]);
  assert.equal(selected.length, 500);
  assert.equal(
    selected.some((item) => item.id === 501),
    false,
  );
  assert.equal(current.length, 499, "does not mutate existing form selection");
});
