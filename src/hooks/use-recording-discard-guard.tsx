"use client";

import { useEffect, useRef, useState } from "react";
import { NAVIGATION_REQUEST_EVENT } from "@/lib/navigation";
import { navigationDepth } from "@/lib/navigation-history";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";

/** Only the confirmed action may reset media. Cancel never touches the recorder. */
export function useRecordingDiscardGuard(
  hasRecording: boolean,
  guardNavigation = false,
) {
  const [intent, setIntent] = useState<"exit" | "retry" | null>(null);
  const pending = useRef<(() => void) | null>(null);
  const navigationAllowed = useRef(false);
  useEffect(() => {
    if (!hasRecording || !guardNavigation) return;
    navigationAllowed.current = false;
    let leaving = false;
    let restoring = false;
    const depth = navigationDepth(window.history.state);
    const ask = (action: () => void) => {
      pending.current = () => {
        leaving = true;
        navigationAllowed.current = true;
        action();
      };
      setIntent("exit");
    };
    const navigate = (event: Event) => {
      if (leaving) return;
      event.preventDefault();
      ask((event as CustomEvent<() => void>).detail);
    };
    const click = (event: MouseEvent) => {
      if (
        leaving ||
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      )
        return;
      const link =
        event.target instanceof Element
          ? event.target.closest("a[href]")
          : null;
      if (
        !(link instanceof HTMLAnchorElement) ||
        link.target === "_blank" ||
        link.hasAttribute("download") ||
        link.href === window.location.href
      )
        return;
      event.preventDefault();
      event.stopPropagation();
      ask(() => link.click());
    };
    const pop = (event: PopStateEvent) => {
      if (leaving) return;
      const destination = navigationDepth(event.state);
      if (depth == null || destination == null) return;
      if (restoring) {
        event.stopImmediatePropagation();
        restoring = false;
        return;
      }
      const delta = depth - destination;
      if (!delta) return;
      event.stopImmediatePropagation();
      restoring = true;
      window.history.go(delta);
      ask(() => window.history.go(-delta));
    };
    window.addEventListener(NAVIGATION_REQUEST_EVENT, navigate);
    document.addEventListener("click", click, true);
    window.addEventListener("popstate", pop, true);
    return () => {
      window.removeEventListener(NAVIGATION_REQUEST_EVENT, navigate);
      document.removeEventListener("click", click, true);
      window.removeEventListener("popstate", pop, true);
    };
  }, [hasRecording, guardNavigation]);
  useEffect(() => {
    if (!hasRecording) return;
    const warn = (event: BeforeUnloadEvent) => {
      if (navigationAllowed.current) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [hasRecording]);
  const cancel = () => {
    pending.current = null;
    setIntent(null);
  };
  const request = (kind: "exit" | "retry", action: () => void) => {
    if (!hasRecording) {
      action();
      return;
    }
    pending.current = action;
    setIntent(kind);
  };
  const dialog = (
    <AlertDialog
      open={intent !== null}
      onOpenChange={(open) => {
        if (!open) cancel();
      }}
    >
      <AlertDialogContent
        overlayClassName="bg-black/40"
        className="w-[calc(100%-40px)] max-w-[342px] !rounded-[20px] border-0 bg-white px-5 pt-7 pb-5 gap-6 text-[#191f28] shadow-[0_8px_24px_rgba(0,0,0,0.12)] data-[state=open]:!animate-none data-[state=closed]:!animate-none"
      >
        <div className="space-y-2 text-center">
          <AlertDialogTitle className="text-[20px] leading-7 font-bold tracking-[-0.24px]">
            {intent === "retry" ? "다시 녹음할까요?" : "연습을 그만둘까요?"}
          </AlertDialogTitle>
          <AlertDialogDescription className="text-[14px] leading-5 font-medium text-[#6b7684]">
            {intent === "retry"
              ? "기존 녹음은 삭제되고 새로 녹음해요"
              : "지금까지 녹음한 내용은 저장되지 않아요"}
          </AlertDialogDescription>
        </div>
        <div className="flex gap-2">
          <AlertDialogAction
            className="h-14 w-[120px] max-w-[40%] min-w-0 flex-none rounded-full border border-[#e5e8eb] bg-white px-3 text-[16px] leading-6 font-bold text-[#191f28] shadow-none hover:bg-[#f2f4f6]"
            onClick={() => {
              const action = pending.current;
              pending.current = null;
              setIntent(null);
              action?.();
            }}
          >
            {intent === "retry" ? "다시 녹음" : "그만두기"}
          </AlertDialogAction>
          <AlertDialogCancel className="!mt-0 h-14 min-w-0 flex-1 rounded-full border-0 bg-[#2f6bff] px-3 text-[16px] leading-6 font-bold text-white shadow-none hover:bg-[#245be0] hover:text-white">
            계속 연습
          </AlertDialogCancel>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
  return { request, dialog };
}
