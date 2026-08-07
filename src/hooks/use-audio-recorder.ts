"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export type RecorderStatus =
  "idle" | "requesting" | "recording" | "recorded" | "denied" | "unsupported" | "error";

const MAX_RECORDING_MS = 60_000;

export function useAudioRecorder() {
  const [status, setStatus] = useState<RecorderStatus>("idle");
  const [blob, setBlob] = useState<Blob | null>(null);
  const [durationMs, setDurationMs] = useState(0);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimers = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    intervalRef.current = null;
    timeoutRef.current = null;
  }, []);

  const stopTracks = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  const stop = useCallback(() => {
    const recorder = recorderRef.current;
    if (recorder?.state === "recording") recorder.stop();
  }, []);

  const start = useCallback(async () => {
    setError(null);
    setBlob(null);
    setElapsedMs(0);
    if (
      typeof navigator === "undefined" ||
      !navigator.mediaDevices?.getUserMedia ||
      typeof MediaRecorder === "undefined"
    ) {
      setStatus("unsupported");
      setError("이 브라우저에서는 음성 녹음을 지원하지 않습니다.");
      return false;
    }
    setStatus("requesting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      streamRef.current = stream;
      chunksRef.current = [];
      const recorder = new MediaRecorder(stream);
      recorderRef.current = recorder;
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onerror = () => {
        clearTimers();
        stopTracks();
        setStatus("error");
        setError("녹음 중 오류가 발생했습니다.");
      };
      recorder.onstop = () => {
        const duration = Date.now() - startedAtRef.current;
        const recorded = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        clearTimers();
        stopTracks();
        setDurationMs(duration);
        setElapsedMs(duration);
        setBlob(recorded);
        setStatus(recorded.size > 0 ? "recorded" : "error");
        if (!recorded.size) setError("녹음된 음성이 없습니다. 다시 시도해 주세요.");
      };
      recorder.start(250);
      startedAtRef.current = Date.now();
      setStatus("recording");
      intervalRef.current = setInterval(() => setElapsedMs(Date.now() - startedAtRef.current), 200);
      timeoutRef.current = setTimeout(stop, MAX_RECORDING_MS);
      return true;
    } catch (reason) {
      stopTracks();
      const denied =
        reason instanceof DOMException &&
        (reason.name === "NotAllowedError" || reason.name === "SecurityError");
      setStatus(denied ? "denied" : "error");
      setError(
        denied
          ? "마이크 권한이 거부되었습니다. 브라우저 설정에서 권한을 허용해 주세요."
          : "마이크를 시작하지 못했습니다.",
      );
      return false;
    }
  }, [clearTimers, stop, stopTracks]);

  const reset = useCallback(() => {
    stop();
    clearTimers();
    stopTracks();
    setBlob(null);
    setDurationMs(0);
    setElapsedMs(0);
    setError(null);
    setStatus("idle");
  }, [clearTimers, stop, stopTracks]);

  useEffect(
    () => () => {
      stop();
      clearTimers();
      stopTracks();
    },
    [clearTimers, stop, stopTracks],
  );

  const previewUrl = useMemo(() => (blob ? URL.createObjectURL(blob) : null), [blob]);
  useEffect(
    () => () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    },
    [previewUrl],
  );

  return { status, blob, durationMs, elapsedMs, previewUrl, error, start, stop, reset };
}
