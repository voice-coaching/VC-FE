"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

export function LearningGoalSettings() {
  const [goalText, setGoalText] = useState("");
  const [dailyMinutes, setDailyMinutes] = useState("");
  const [weeklyCount, setWeeklyCount] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    api.onboarding
      .get()
      .then((profile) => {
        if (!active) return;
        setGoalText(profile.goalText ?? "");
        setDailyMinutes(profile.dailyGoalMinutes?.toString() ?? "");
        setWeeklyCount(profile.weeklyGoalCount?.toString() ?? "");
        setLoaded(true);
      })
      .catch((reason) => {
        if (active)
          setMessage(
            reason instanceof Error
              ? reason.message
              : "학습 목표를 불러오지 못했습니다.",
          );
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <form
      className="space-y-4 border-t border-border pt-5"
      onSubmit={async (event) => {
        event.preventDefault();
        if (!loaded || saving) return;
        setSaving(true);
        setMessage(null);
        try {
          await api.onboarding.update({
            goalText,
            dailyGoalMinutes: Number(dailyMinutes),
            weeklyGoalCount: Number(weeklyCount),
          });
          setMessage("학습 목표를 저장했습니다.");
        } catch (reason) {
          setMessage(
            reason instanceof Error
              ? reason.message
              : "학습 목표를 저장하지 못했습니다.",
          );
        } finally {
          setSaving(false);
        }
      }}
    >
      <h2 className="text-base font-semibold">학습 목표</h2>
      <fieldset
        disabled={!loaded || saving}
        className="space-y-4 disabled:opacity-50"
      >
        <label className="block text-xs text-muted-foreground">
          나의 목표
          <textarea
            value={goalText}
            onChange={(event) => setGoalText(event.target.value)}
            rows={3}
            className="mt-2 w-full rounded-2xl bg-surface px-4 py-3.5 text-sm"
          />
        </label>
        <label className="block text-xs text-muted-foreground">
          하루 학습 시간 (분)
          <input
            type="number"
            required
            min={1}
            step={1}
            value={dailyMinutes}
            onChange={(event) => setDailyMinutes(event.target.value)}
            className="mt-2 w-full rounded-2xl bg-surface px-4 py-3.5 text-sm"
          />
        </label>
        <label className="block text-xs text-muted-foreground">
          주간 학습 횟수
          <input
            type="number"
            required
            min={1}
            step={1}
            value={weeklyCount}
            onChange={(event) => setWeeklyCount(event.target.value)}
            className="mt-2 w-full rounded-2xl bg-surface px-4 py-3.5 text-sm"
          />
        </label>
        <button
          type="submit"
          className="w-full rounded-full bg-foreground py-4 text-sm font-semibold text-background"
        >
          {saving ? "저장 중…" : "학습 목표 저장"}
        </button>
      </fieldset>
      {message && (
        <p role="status" className="text-xs text-muted-foreground">
          {message}
        </p>
      )}
    </form>
  );
}
