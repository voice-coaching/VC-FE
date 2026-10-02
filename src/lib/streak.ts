import type { TrainingHistoryItem } from "@/lib/api";

export type CalendarDay = {
  key: string;
  day: number | null;
  completedCount: number;
  isToday: boolean;
};

function dateKey(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function monthRange(year: number, monthIndex: number) {
  const from = new Date(year, monthIndex, 1);
  const to = new Date(year, monthIndex + 1, 0);
  return { from: dateKey(from), to: dateKey(to) };
}

export function buildMonthCalendar(
  year: number,
  monthIndex: number,
  sessions: ReadonlyArray<Pick<TrainingHistoryItem, "completedAt">>,
  today = new Date(),
): CalendarDay[] {
  const lastDay = new Date(year, monthIndex + 1, 0).getDate();
  const leading = new Date(year, monthIndex, 1).getDay();
  const counts = new Map<string, number>();
  for (const session of sessions) {
    const completedAt = new Date(session.completedAt);
    if (Number.isNaN(completedAt.getTime())) continue;
    const key = dateKey(completedAt);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const cells: CalendarDay[] = Array.from({ length: leading }, (_, index) => ({
    key: `empty-${index}`,
    day: null,
    completedCount: 0,
    isToday: false,
  }));
  for (let day = 1; day <= lastDay; day += 1) {
    const date = new Date(year, monthIndex, day);
    const key = dateKey(date);
    cells.push({
      key,
      day,
      completedCount: counts.get(key) ?? 0,
      isToday: key === dateKey(today),
    });
  }
  while (cells.length % 7 !== 0) {
    cells.push({
      key: `tail-${cells.length}`,
      day: null,
      completedCount: 0,
      isToday: false,
    });
  }
  return cells;
}

export function completedDays(calendar: ReadonlyArray<CalendarDay>) {
  return calendar.filter((day) => day.completedCount > 0).length;
}
