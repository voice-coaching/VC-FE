"use client";
import Image from "next/image";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { TopBar } from "@/components/top-bar";
import { api } from "@/lib/api";
import { getCachedUser, markAuthenticatedUser } from "@/lib/auth-session";
export default function ProfileSettings() {
  const [nickname, setNickname] = useState("");
  const [email, setEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  useEffect(() => {
    const cached = getCachedUser();
    (cached ? Promise.resolve(cached) : api.users.getMe())
      .then((user) => {
        setNickname(user.nickname);
        setEmail(user.email ?? "");
      })
      .catch(() => setMessage("프로필을 불러오지 못했습니다."));
  }, []);
  return (
    <AppShell nav={false} className="flex min-h-dvh flex-col !bg-white">
      <TopBar to="/mypage/settings" title="프로필 수정" />
      <div className="flex-1 space-y-6 px-6 pt-8">
        <Image
          src="/figma/mypage/avatar.svg"
          width={80}
          height={80}
          alt="프로필"
          className="mx-auto mb-8"
        />
        <label className="block text-sm text-[#6b7684]">
          이메일
          <input
            value={email}
            disabled
            className="mt-2 h-14 w-full rounded-xl bg-[#f7f8fa] px-4 text-[#8b95a1]"
          />
        </label>
        <label className="block text-sm text-[#6b7684]">
          닉네임
          <input
            value={nickname}
            onChange={(event) => setNickname(event.target.value)}
            maxLength={10}
            className="mt-2 h-14 w-full rounded-xl bg-[#f7f8fa] px-4 text-[#191f28] outline-none focus:ring-2 focus:ring-primary"
          />
          <span className="mt-2 block text-right text-xs text-[#8b95a1]">
            {nickname.length}/10
          </span>
        </label>
        {message && (
          <p role="status" className="text-sm text-[#6b7684]">
            {message}
          </p>
        )}
      </div>
      <div className="p-6 pb-10">
        <button
          className="design-action"
          disabled={saving || !nickname.trim() || nickname.length > 10}
          onClick={async () => {
            setSaving(true);
            try {
              await api.users.updateProfile({ nickname: nickname.trim() });
              const cached = getCachedUser();
              if (cached)
                markAuthenticatedUser({ ...cached, nickname: nickname.trim() });
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
        >
          {saving ? "저장 중…" : "저장하기"}
        </button>
      </div>
    </AppShell>
  );
}
