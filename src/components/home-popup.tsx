"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState, useSyncExternalStore } from "react";
import { getAuthenticatedUserId } from "@/lib/auth-session";
import { getAuthSessionVersion, subscribeAuthSession } from "@/lib/api/client";
import { loadActiveHomePopup, type ActiveHomePopup } from "@/lib/home-popup";
import {
  isHomePopupHidden,
  hideHomePopupForWeek,
} from "@/lib/home-popup-preferences";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "./ui/dialog";

// Ordinary dismissals belong to this page visit/login; weekly choices use a separate preference.
const dismissed = new Set<string>();
const temporaryProPromotion: ActiveHomePopup = {
  id: 2026110903,
  title: "첫 3일은 프로로 시작하세요",
  body: "신규 가입 회원에게 모든 프로 기능을 3일간 무료로 제공해요.",
  href: null,
};

/** Home-only promotion overlay; the temporary offer is the fallback until a server notice is published. */
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
    const openPopup = (popup: ActiveHomePopup) => {
      if (
        owner.signal.aborted ||
        epoch !== getAuthSessionVersion() ||
        dismissed.has(`${scope}:${popup.id}`) ||
        isHomePopupHidden(userId, popup.id)
      )
        return;
      setSnapshot({ scope, popup });
    };
    void loadActiveHomePopup(owner.signal)
      .then((popup) => {
        openPopup(popup ?? temporaryProPromotion);
      })
      .catch(() => {
        openPopup(temporaryProPromotion);
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
          showCloseButton={false}
          overlayClassName="bg-[#321b95]"
          className="inset-0 left-0 top-0 block h-dvh max-h-none w-screen max-w-none translate-x-0 translate-y-0 overflow-hidden rounded-none border-0 bg-[#321b95] p-0 text-white shadow-none data-[state=closed]:animate-none data-[state=open]:animate-none sm:rounded-none"
        >
          <Image
            src="/images/home-pro-trial.png"
            alt=""
            fill
            priority
            sizes="100vw"
            className="object-cover object-center"
            aria-hidden="true"
          />
          <div
            className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(31,13,114,0.48)_0%,rgba(51,24,143,0.08)_38%,rgba(28,11,83,0.24)_64%,rgba(20,8,66,0.8)_100%)]"
            aria-hidden="true"
          />

          <div className="relative z-10 mx-auto flex h-full w-full max-w-[560px] flex-col overflow-y-auto px-[max(24px,env(safe-area-inset-left,0px))] pt-[max(44px,env(safe-area-inset-top,0px))] pb-[max(24px,env(safe-area-inset-bottom,0px))]">
            <div className="flex flex-col items-start">
              <span className="inline-flex h-8 items-center rounded-full border border-white/35 bg-white/15 px-3 text-xs font-bold tracking-[0.12em] text-white backdrop-blur-md">
                신규 가입 특별 혜택
              </span>
              <p className="mt-5 text-[clamp(3.2rem,14vw,5.5rem)] leading-[0.82] font-black tracking-[-0.08em] text-white drop-shadow-[0_4px_18px_rgba(27,8,92,0.35)]">
                PRO
                <br />3 DAYS
              </p>
              <p className="mt-5 text-lg leading-7 font-semibold text-white/90">
                신규 가입 시 3일간 프로 요금제를 제공해요
              </p>
            </div>

            <div className="mt-auto rounded-[28px] border border-white/20 bg-[rgba(28,13,83,0.58)] p-5 shadow-[0_20px_60px_rgba(18,7,60,0.28)] backdrop-blur-xl">
              <DialogTitle className="break-words text-xl leading-7 font-bold text-white">
                {popup.title}
              </DialogTitle>
              <DialogDescription className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-white/75">
                {popup.body}
              </DialogDescription>
              <div className="mt-5 flex gap-2">
                <button
                  type="button"
                  onClick={close}
                  className="min-h-12 flex-1 rounded-full bg-white/14 px-4 text-sm font-semibold text-white outline-none ring-1 ring-inset ring-white/20 transition-colors hover:bg-white/20 focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#321b95]"
                >
                  확인
                </button>
                {popup.href && (
                  <Link
                    href={popup.href}
                    onClick={close}
                    className="flex min-h-12 flex-1 items-center justify-center rounded-full bg-white px-4 text-sm font-bold text-[#4b32c3] outline-none transition-colors hover:bg-[#f4f1ff] focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#321b95]"
                  >
                    자세히 보기
                  </Link>
                )}
              </div>
              <button
                type="button"
                onClick={() => {
                  if (userId) hideHomePopupForWeek(userId, popup.id);
                  close();
                }}
                className="mt-2 min-h-11 w-full rounded-lg text-xs font-medium text-white/65 underline underline-offset-4 outline-none focus-visible:ring-2 focus-visible:ring-white"
              >
                일주일간 보지 않기
              </button>
            </div>
          </div>
        </DialogContent>
      )}
    </Dialog>
  );
}
