"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { TopBar } from "@/components/top-bar";
import { api } from "@/lib/api";
import { getCachedUser } from "@/lib/auth-session";
import { useProfile } from "@/lib/use-profile";

export default function AccountSettings() {
  const router = useRouter();
  const [nickname, setNickname] = useState("");
  const [email, setEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [goalDescription, setGoalDescription] = useState("");
  const [minutesPerDay, setMinutesPerDay] = useState(10);
  const [weeklySessions, setWeeklySessions] = useState(3);
  const [savingGoals, setSavingGoals] = useState(false);
  const [accountAction, setAccountAction] = useState<
    "logout" | "withdraw" | null
  >(null);
  const [message, setMessage] = useState<string | null>(null);
  const {
    profile,
    hydrated: profileHydrated,
    error: profileError,
    updateLearningGoals,
  } = useProfile();

  useEffect(() => {
    const cachedUser = getCachedUser();
    if (cachedUser) {
      setNickname(cachedUser.nickname);
      setEmail(cachedUser.email ?? "");
      return;
    }
    api.users
      .getMe()
      .then((account) => {
        setNickname(account.nickname);
        setEmail(account.email ?? "");
      })
      .catch(() => setMessage("프로필을 불러오지 못했습니다."));
  }, []);

  useEffect(() => {
    if (!profile) return;
    setGoalDescription(profile.goalDescription);
    setMinutesPerDay(profile.minutesPerDay);
    setWeeklySessions(profile.weeklySessions);
  }, [profile]);

  return (
    <AppShell nav={false}>
      <TopBar to="/mypage" title="계정 설정" />
      <div className="space-y-5 px-5 pb-10">
        <label className="block text-xs text-muted-foreground">
          이메일
          <input
            value={email}
            disabled
            className="mt-2 w-full rounded-2xl bg-surface px-4 py-3.5 text-sm opacity-60"
          />
        </label>
        <label className="block text-xs text-muted-foreground">
          닉네임
          <input
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            className="mt-2 w-full rounded-2xl bg-surface px-4 py-3.5 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
        </label>
        {message && (
          <p role="status" className="text-xs text-muted-foreground">
            {message}
          </p>
        )}
        <button
          disabled={saving || !nickname.trim()}
          onClick={async () => {
            setSaving(true);
            try {
              await api.users.updateProfile({ nickname: nickname.trim() });
              setMessage("프로필을 저장했습니다.");
            } catch (reason) {
              setMessage(
                reason instanceof Error
                  ? reason.message
                  : "저장하지 못했습니다.",
              );
            } finally {
              setSaving(false);
            }
          }}
          className="w-full rounded-full bg-foreground py-4 text-sm font-semibold text-background disabled:opacity-30"
        >
          {saving ? "저장 중…" : "프로필 저장"}
        </button>
        <section className="rounded-3xl bg-surface p-5">
          <h2 className="text-base font-semibold">학습 목표</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            온보딩에서 정한 목표를 현재 계획에 맞게 수정할 수 있습니다.
          </p>
          {!profileHydrated ? (
            <p className="mt-4 text-xs text-muted-foreground">
              학습 목표를 불러오는 중…
            </p>
          ) : (
            <div className="mt-4 space-y-4">
              <label className="block text-xs text-muted-foreground">
                목표 문구
                <textarea
                  value={goalDescription}
                  onChange={(event) => setGoalDescription(event.target.value)}
                  rows={3}
                  className="mt-2 w-full resize-none rounded-2xl bg-background px-4 py-3.5 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
                />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block text-xs text-muted-foreground">
                  하루 학습(분)
                  <input
                    type="number"
                    min={1}
                    max={180}
                    value={minutesPerDay}
                    onChange={(event) =>
                      setMinutesPerDay(Number(event.target.value))
                    }
                    className="mt-2 w-full rounded-2xl bg-background px-4 py-3.5 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
                  />
                </label>
                <label className="block text-xs text-muted-foreground">
                  주간 횟수
                  <input
                    type="number"
                    min={1}
                    max={7}
                    value={weeklySessions}
                    onChange={(event) =>
                      setWeeklySessions(Number(event.target.value))
                    }
                    className="mt-2 w-full rounded-2xl bg-background px-4 py-3.5 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
                  />
                </label>
              </div>
              {profileError && (
                <p role="alert" className="text-xs text-destructive">
                  {profileError}
                </p>
              )}
              <button
                type="button"
                disabled={
                  savingGoals ||
                  !profile ||
                  goalDescription.trim().length < 4 ||
                  minutesPerDay < 1 ||
                  minutesPerDay > 180 ||
                  weeklySessions < 1 ||
                  weeklySessions > 7
                }
                onClick={async () => {
                  setSavingGoals(true);
                  setMessage(null);
                  try {
                    await updateLearningGoals({
                      goalDescription: goalDescription.trim(),
                      minutesPerDay,
                      weeklySessions,
                    });
                    setMessage("학습 목표를 저장했습니다.");
                  } catch (reason) {
                    setMessage(
                      reason instanceof Error
                        ? reason.message
                        : "학습 목표를 저장하지 못했습니다.",
                    );
                  } finally {
                    setSavingGoals(false);
                  }
                }}
                className="w-full rounded-full border border-border py-3 text-sm font-semibold disabled:opacity-30"
              >
                {savingGoals ? "저장 중…" : "학습 목표 저장"}
              </button>
            </div>
          )}
        </section>
        <button
          disabled={accountAction != null}
          onClick={async () => {
            setAccountAction("logout");
            setMessage(null);
            try {
              await api.auth.signOut();
              router.replace("/auth?mode=login");
            } catch (reason) {
              setMessage(
                reason instanceof Error
                  ? reason.message
                  : "로그아웃하지 못했습니다.",
              );
              setAccountAction(null);
            }
          }}
          className="w-full rounded-full border border-border py-4 text-sm font-semibold disabled:opacity-50"
        >
          {accountAction === "logout" ? "로그아웃 중…" : "로그아웃"}
        </button>
        <button
          disabled={accountAction != null}
          onClick={async () => {
            if (
              !window.confirm(
                "계정과 모든 학습 정보를 삭제할까요? 이 작업은 되돌릴 수 없습니다.",
              )
            )
              return;
            setAccountAction("withdraw");
            setMessage(null);
            try {
              await api.users.withdraw();
              router.replace("/");
            } catch (reason) {
              setMessage(
                reason instanceof Error
                  ? reason.message
                  : "회원 탈퇴를 완료하지 못했습니다.",
              );
              setAccountAction(null);
            }
          }}
          className="w-full py-3 text-xs font-semibold text-destructive underline disabled:opacity-50"
        >
          {accountAction === "withdraw" ? "탈퇴 처리 중…" : "회원 탈퇴"}
        </button>
      </div>
    </AppShell>
  );
}
