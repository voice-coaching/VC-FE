"use client";

import { Pencil } from "lucide-react";
import Image from "next/image";
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
import { useHistoryPanel } from "@/hooks/use-history-panel";
import { navigationEntryId } from "@/lib/navigation-history";

export function NicknameEditor({
  account,
  fallbackName,
  compact = false,
  row = false,
}: {
  account: UserAccount | null;
  fallbackName?: string;
  compact?: boolean;
  /** Renders the trigger as a settings list row. */
  row?: boolean;
}) {
  const inputId = useId();
  const [panel, setPanel] = useHistoryPanel("edit", ["nickname"] as const);
  const open = panel === "nickname";
  const setOpen = (next: boolean) => setPanel(next ? "nickname" : null);
  const [savedName, setSavedName] = useState<string | null>(null);
  const [editedDraft, setDraft] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const busy = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const displayName = savedName ?? account?.nickname ?? fallbackName;
  const draft = editedDraft ?? displayName ?? "";
  const nickname = draft.trim();

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy.current || !nickname || nickname.length > 10) return;
    busy.current = true;
    setSaving(true);
    setError(null);
    const entry = navigationEntryId(window.history.state);
    const href = window.location.href;
    try {
      const updated = await api.users.updateProfile({ nickname });
      const user = getCachedUser() ?? account;
      if (user) markAuthenticatedUser({ ...user, nickname: updated.nickname });
      updateMyPageOverviewCache({ nickname: updated.nickname });
      setSavedName(updated.nickname);
      // A completed request must not close a newer dialog or navigate elsewhere.
      if (
        href === window.location.href &&
        entry === navigationEntryId(window.history.state)
      ) {
        setOpen(false);
      }
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
      {row ? (
        <DialogTrigger asChild>
          <button
            type="button"
            disabled={!displayName}
            className="flex h-14 w-full items-center gap-3.5 px-5 py-2 text-left disabled:opacity-60"
          >
            <span className="flex size-9 shrink-0 items-center justify-center">
              <Image
                src="/figma/settings/user.svg"
                alt=""
                width={22}
                height={22}
              />
            </span>
            <span className="flex-1 text-[15px] leading-[22px] font-medium">
              닉네임
            </span>
            <span
              className="max-w-[45%] truncate text-[15px] leading-[22px] text-[#8b95a1]"
              aria-live="polite"
            >
              {displayName ?? "불러오는 중…"}
            </span>
            <Image
              src="/figma/settings/chevron-right.svg"
              alt=""
              width={18}
              height={18}
            />
          </button>
        </DialogTrigger>
      ) : compact ? (
        <DialogTrigger asChild>
          <button
            type="button"
            aria-label="닉네임 변경"
            disabled={!displayName}
            className="max-w-full break-all text-center text-[24px] leading-8 font-bold tracking-[-0.48px] text-[#191f28]"
          >
            {displayName ?? "불러오는 중…"}
          </button>
        </DialogTrigger>
      ) : (
        <div className="relative mt-5 flex max-w-full items-center justify-center px-11 text-[#191f28]">
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
              className="absolute right-0 top-1/2 -translate-y-1/2 flex size-11 shrink-0 items-center justify-center rounded-full text-[#4e5968] hover:bg-white/40 focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-40"
            >
              <Pencil className="size-4" aria-hidden="true" />
            </button>
          </DialogTrigger>
        </div>
      )}
      <DialogContent className="max-h-[calc(100dvh-40px-env(safe-area-inset-top,0px)-env(safe-area-inset-bottom,0px))] w-[calc(100%-40px)] max-w-[362px] overflow-y-auto rounded-[24px] border-0">
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
