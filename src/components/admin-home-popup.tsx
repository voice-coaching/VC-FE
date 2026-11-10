"use client";
import { useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { PopupPicture } from "./popup-picture";
import { loadActiveHomePopup, type ActiveHomePopup } from "@/lib/home-popup";
import {
  isHomePopupHidden,
  hideHomePopupForWeek,
} from "@/lib/home-popup-preferences";
import { getAuthSessionVersion, subscribeAuthSession } from "@/lib/api/client";
import { getAuthenticatedUserId } from "@/lib/auth-session";

const dismissed = new Set<string>();
export function AdminHomePopup({ enabled }: { enabled: boolean }) {
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
    if (!enabled || !userId) return;
    const request = new AbortController();
    void loadActiveHomePopup(request.signal)
      .then((popup) => {
        if (
          request.signal.aborted ||
          epoch !== getAuthSessionVersion() ||
          !popup
        )
          return;
        if (
          dismissed.has(`${scope}:${popup.id}`) ||
          isHomePopupHidden(userId, popup.id)
        )
          return;
        setSnapshot({ scope, popup });
      })
      .catch(() => {});
    return () => request.abort();
  }, [enabled, epoch, userId, scope]);
  const popup = enabled && snapshot?.scope === scope ? snapshot.popup : null;
  function close() {
    if (popup) dismissed.add(`${scope}:${popup.id}`);
    setSnapshot(null);
  }
  if (!popup) return null;
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) close();
      }}
    >
      <DialogContent
        overlayClassName="bg-black/25"
        className="max-h-[90dvh] w-[calc(100%_-_2rem)] max-w-md overflow-y-auto rounded-3xl bg-white text-gray-900"
      >
        <DialogTitle>{popup.title}</DialogTitle>
        {popup.image && (
          <PopupPicture
            key={popup.image.url}
            image={popup.image}
            title={popup.title}
          />
        )}
        <DialogDescription className="whitespace-pre-wrap break-words text-base">
          {popup.body}
        </DialogDescription>
        {popup.href && (
          <Link
            className="rounded-xl bg-violet-600 px-4 py-3 text-center text-white"
            href={popup.href}
            onClick={close}
          >
            자세히 보기
          </Link>
        )}
        <div className="flex items-center justify-between gap-4 text-sm text-gray-500">
          <button
            type="button"
            onClick={() => {
              if (userId) hideHomePopupForWeek(userId, popup.id);
              close();
            }}
          >
            일주일간 보지 않기
          </button>
          <button type="button" onClick={close}>
            닫기
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
