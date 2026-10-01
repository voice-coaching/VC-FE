"use client";

import { Pencil } from "lucide-react";
import { useId, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { api, type UserAccount } from "@/lib/api";
import { getCachedUser, markAuthenticatedUser } from "@/lib/auth-session";
import { updateMyPageOverviewCache } from "@/lib/my-page-cache";

export function NicknameEditor({
  account,
  fallbackName,
}: {
  account: UserAccount | null;
  fallbackName?: string;
}) {
  const inputId = useId();
  const [open, setOpen] = useState(false);
  const [savedName, setSavedName] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const busy = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const displayName = savedName ?? account?.nickname ?? fallbackName;
  const nickname = draft.trim();

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy.current || !nickname || nickname.length > 10) return;
    busy.current = true;
    setSaving(true);
    setError(null);
    try {
      const updated = await api.users.updateProfile({ nickname });
      const user = getCachedUser() ?? account;
      if (user) markAuthenticatedUser({ ...user, nickname: updated.nickname });
      updateMyPageOverviewCache({ nickname: updated.nickname });
      setSavedName(updated.nickname);
      setOpen(false);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "닉네임을 저장하지 못했습니다.",
      );
    } finally {
      busy.current = false;
      setSaving(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (busy.current) return;
        if (nextOpen) {
          setDraft(displayName ?? "");
          setError(null);
        }
        setOpen(nextOpen);
      }}
    >
      <div className="mt-5 flex max-w-full items-center justify-center px-5 text-[#191f28]">
        <h2
          className="min-w-0 break-all text-[20px] leading-7 font-bold"
          aria-live="polite"
        >
          {displayName ?? "불러오는 중…"}
        </h2>
        <DialogTrigger asChild>
          <button
            type="button"
            aria-label="닉네임 변경"
            disabled={!displayName}
            className="-my-2 flex size-11 shrink-0 items-center justify-center rounded-full text-[#4e5968] hover:bg-white/40 focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-40"
          >
            <Pencil className="size-4" aria-hidden="true" />
          </button>
        </DialogTrigger>
      </div>
      <DialogContent className="w-[calc(100%-40px)] max-w-[362px] rounded-[24px] border-0">
        <DialogHeader>
          <DialogTitle>닉네임 변경</DialogTitle>
          <DialogDescription>
            사용할 닉네임을 10자 이내로 입력해 주세요.
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(event) => void save(event)}
          className="space-y-4"
          aria-busy={saving}
        >
          <div>
            <label htmlFor={inputId} className="text-sm text-[#6b7684]">
              닉네임
            </label>
            <input
              id={inputId}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              maxLength={10}
              disabled={saving}
              autoComplete="nickname"
              aria-describedby={`${inputId}-count`}
              className="mt-2 h-14 w-full rounded-xl bg-[#f7f8fa] px-4 text-[#191f28] outline-none focus:ring-2 focus:ring-primary"
            />
            <p
              id={`${inputId}-count`}
              className="mt-2 text-right text-xs text-[#8b95a1]"
            >
              {draft.length}/10
            </p>
          </div>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              disabled={saving}
              className="min-h-12 rounded-full bg-[#f2f4f6] font-semibold disabled:opacity-50"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={
                saving ||
                !nickname ||
                nickname.length > 10 ||
                nickname === displayName
              }
              className="min-h-12 rounded-full bg-primary font-semibold text-white disabled:opacity-50"
            >
              {saving ? "저장 중…" : "저장하기"}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
