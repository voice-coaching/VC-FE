"use client";

import Link from "next/link";
import { useEffect, useState, useSyncExternalStore } from "react";
import { getAuthenticatedUserId } from "@/lib/auth-session";
import { getAuthSessionVersion, subscribeAuthSession } from "@/lib/api/client";
import { loadActiveHomePopup, type ActiveHomePopup } from "@/lib/home-popup";
import {
  isHomePopupHidden,
  hideHomePopupForDays,
} from "@/lib/home-popup-preferences";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "./ui/dialog";

// Ordinary dismissals belong to this page visit/login; weekly choices use a separate preference.
const dismissed = new Set<string>();

/** Home-only notice overlay; loading/failure must not move or block the existing home content. */
export function HomePopup() {
  const epoch = useSyncExternalStore(
    subscribeAuthSession,
    getAuthSessionVersion,
    () => 0,
  );
  const userId = getAuthenticatedUserId();
  const scope = JSON.stringify([epoch, userId]);
  const [snapshot, setSnapshot] = useState<{
    scope: string;
    popup: ActiveHomePopup;
  } | null>(null);
  useEffect(() => {
    if (!userId) return;
    const owner = new AbortController();
    void loadActiveHomePopup(owner.signal)
      .then((popup) => {
        if (
          owner.signal.aborted ||
          epoch !== getAuthSessionVersion() ||
          !popup ||
          dismissed.has(`${scope}:${popup.id}`) ||
          isHomePopupHidden(userId, popup.id)
        )
          return;
        setSnapshot({ scope, popup });
      })
      .catch(() => {
        // Announcements are optional: never replace the home with a popup API error.
      });
    return () => owner.abort();
  }, [epoch, userId, scope]);

  const popup = snapshot?.scope === scope ? snapshot.popup : null;
  function close() {
    if (popup) dismissed.add(`${scope}:${popup.id}`);
    setSnapshot(null);
  }
  return (
    <Dialog
      open={popup !== null}
      onOpenChange={(open) => {
        if (!open) close();
      }}
    >
      {popup && (
        <DialogContent
          overlayClassName="bg-black/25"
          className="top-[max(72px,12dvh)] max-h-[calc(88dvh-24px)] w-[calc(100%-40px)] max-w-[400px] translate-y-0 gap-5 overflow-y-auto rounded-[28px] border-0 bg-white p-6 text-[#191f28] sm:rounded-[28px]"
        >
          <div className="pr-6">
            <p className="mb-3 text-xs font-semibold text-[#6346f6]">
              서비스 안내
            </p>
            <DialogTitle className="break-words text-xl font-bold leading-7">
              {popup.title}
            </DialogTitle>
          </div>
          <DialogDescription className="whitespace-pre-wrap break-words text-sm leading-6 text-[#4e5968]">
            {popup.body}
          </DialogDescription>
          {popup.href && (
            <Link
              href={popup.href}
              onClick={close}
              className="flex min-h-12 items-center justify-center rounded-full bg-[#6346f6] px-4 text-sm font-semibold text-white outline-none focus-visible:ring-2 focus-visible:ring-[#6346f6] focus-visible:ring-offset-2"
            >
              자세히 보기
            </Link>
          )}
          <div className="flex gap-2 border-t border-[#f2f4f6] pt-1">
            {([1, 7] as const).map((days) => (
              <button
                key={days}
                type="button"
                onClick={() => {
                  if (userId) hideHomePopupForDays(userId, popup.id, days);
                  close();
                }}
                className="min-h-11 flex-1 rounded-lg text-xs font-medium text-[#6b7684] outline-none focus-visible:ring-2 focus-visible:ring-[#6346f6]"
              >
                {days === 1 ? "하루 동안 보지 않기" : "일주일 동안 보지 않기"}
              </button>
            ))}
          </div>
        </DialogContent>
      )}
    </Dialog>
  );
}
