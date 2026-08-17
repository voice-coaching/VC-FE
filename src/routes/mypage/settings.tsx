"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { TopBar } from "@/components/top-bar";
import { api } from "@/lib/api";

export default function AccountSettings() {
  const router = useRouter();
  const [nickname, setNickname] = useState("");
  const [email, setEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    api.users
      .getMe()
      .then((account) => {
        setNickname(account.nickname);
        setEmail(account.email ?? "");
      })
      .catch(() => setMessage("프로필을 불러오지 못했습니다."));
  }, []);

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
        <button
          onClick={async () => {
            await api.auth.signOut();
            router.push("/auth");
          }}
          className="w-full rounded-full border border-border py-4 text-sm font-semibold"
        >
          로그아웃
        </button>
        <button
          onClick={async () => {
            if (
              !window.confirm(
                "계정과 모든 학습 정보를 삭제할까요? 이 작업은 되돌릴 수 없습니다.",
              )
            )
              return;
            await api.users.withdraw();
            router.push("/");
          }}
          className="w-full py-3 text-xs font-semibold text-destructive underline"
        >
          회원 탈퇴
        </button>
      </div>
    </AppShell>
  );
}
