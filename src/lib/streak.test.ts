import assert from "node:assert/strict";
import test from "node:test";
import { buildMonthCalendar, completedDays, monthRange } from "./streak";

test("month range and monthly completed days are derived from sessions", () => {
  assert.deepEqual(monthRange(2026, 8), {
    from: "2026-09-01",
    to: "2026-09-30",
  });
  const calendar = buildMonthCalendar(
    2026,
    8,
    [
      { completedAt: "2026-09-01T09:00:00+09:00" },
      { completedAt: "2026-09-01T10:00:00+09:00" },
      { completedAt: "2026-09-03T10:00:00+09:00" },
    ],
    new Date("2026-09-03T12:00:00+09:00"),
  );
  assert.equal(completedDays(calendar), 2);
  assert.equal(calendar.find((day) => day.day === 1)?.completedCount, 2);
  assert.equal(calendar.find((day) => day.day === 3)?.isToday, true);
});
