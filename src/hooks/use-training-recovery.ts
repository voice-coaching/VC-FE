"use client";
import { useEffect, useRef, useState } from "react";
import { TrainingRecoveryAttempt } from "@/lib/training-recovery-attempt";
import { practiceRecoveryStore } from "@/lib/practice-recovery-store";
import { getAuthenticatedUserId } from "@/lib/auth-session";
import { getAuthSessionVersion } from "@/lib/api/client";

/** The URL identifies the capture, while IndexedDB owns its bytes and request identities. */
export function useTrainingRecovery(
  context: string,
  suppliedScope?: string,
  disabled = false,
) {
  const attempt = useRef<TrainingRecoveryAttempt | null>(null);
  const scope = useRef("");
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [capture, setCapture] = useState<{
    blob: Blob;
    durationMs: number;
    previewUrl: string;
  } | null>(null);
  useEffect(() => {
    let active = true;
    let url: string | undefined;
    const epoch = getAuthSessionVersion();
    void (async () => {
      try {
        if (disabled) return;
        const userId = getAuthenticatedUserId();
        if (!userId)
          throw new Error("로그인 후 녹음 복구를 사용할 수 있습니다.");
        const location = new URL(window.location.href);
        let id = location.searchParams.get("recordingAttempt");
        if (!id) {
          id = crypto.randomUUID();
          location.searchParams.set("recordingAttempt", id);
          window.history.replaceState(window.history.state, "", location);
        }
        scope.current = suppliedScope ?? `recording:${id}`;
        const restored = await TrainingRecoveryAttempt.restore(
          String(userId),
          scope.current,
          context,
        );
        if (!active || epoch !== getAuthSessionVersion()) return;
        attempt.current = restored;
        if (restored?.record.source) {
          const source = restored.record.source;
          url = URL.createObjectURL(source.original);
          setCapture({
            blob: source.original,
            durationMs: source.durationMs,
            previewUrl: url,
          });
        }
      } catch (reason) {
        if (active) setError(reason);
      } finally {
        if (active && epoch === getAuthSessionVersion()) setReady(true);
      }
    })();
    return () => {
      active = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [context, suppliedScope, disabled]);
  async function restoreSessionKey() {
    const userId = getAuthenticatedUserId();
    if (!userId || !scope.current)
      throw new Error("복구 정보를 먼저 확인해 주세요.");
    const keyScope = `${scope.current}:session-restore`;
    const key =
      (await practiceRecoveryStore.read<string>(userId, keyScope)) ??
      crypto.randomUUID();
    await practiceRecoveryStore.write(userId, keyScope, key);
    return key;
  }
  async function finishSessionRestore() {
    const userId = getAuthenticatedUserId();
    if (userId)
      await practiceRecoveryStore.remove(
        userId,
        `${scope.current}:session-restore`,
      );
  }
  async function clear() {
    const userId = getAuthenticatedUserId();
    if (userId && scope.current)
      await practiceRecoveryStore.remove(String(userId), scope.current);
    attempt.current = null;
    setCapture(null);
  }
  return {
    attempt,
    scope,
    ready,
    error,
    capture,
    clear,
    restoreSessionKey,
    finishSessionRestore,
  };
}
