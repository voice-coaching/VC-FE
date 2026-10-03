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
      <AlertDialogContent className="max-w-[340px] rounded-2xl border-0 bg-white p-6 text-[#191f28]">
        <AlertDialogTitle>
          {intent === "retry"
            ? "기존 녹음을 지우고 다시 읽을까요?"
            : "녹음을 버리고 나갈까요?"}
        </AlertDialogTitle>
        <AlertDialogDescription className="leading-6 text-[#4e5968]">
          {intent === "retry"
            ? "기존 녹음은 복구할 수 없어요. 연습 문장은 그대로 유지됩니다."
            : "지금 녹음은 저장되지 않아요. 계속 연습하면 녹음을 유지할 수 있어요."}
        </AlertDialogDescription>
        <AlertDialogCancel className="mt-2 min-h-12 rounded-full border-0 bg-[#2f6bff] text-white hover:bg-[#245be0] hover:text-white">
          계속 연습
        </AlertDialogCancel>
        <AlertDialogAction
          className="min-h-11 rounded-full bg-[#f2f4f6] text-[#4e5968] hover:bg-[#e5e8eb]"
          onClick={() => {
            const action = pending.current;
            pending.current = null;
            setIntent(null);
            action?.();
          }}
        >
          {intent === "retry" ? "지우고 다시 녹음" : "녹음 버리고 나가기"}
        </AlertDialogAction>
      </AlertDialogContent>
    </AlertDialog>
  );
  return { request, dialog };
}
