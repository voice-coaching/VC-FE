"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// Silent local media lets the prototype exercise playback without a microphone.
function silentAudio(durationMs: number) {
  const samples = Math.ceil((durationMs / 1000) * 8000);
  const buffer = new ArrayBuffer(44 + samples * 2);
  const view = new DataView(buffer);
  const write = (offset: number, text: string) => {
    [...text].forEach((letter, index) =>
      view.setUint8(offset + index, letter.charCodeAt(0)),
    );
  };
  write(0, "RIFF");
  view.setUint32(4, 36 + samples * 2, true);
  write(8, "WAVEfmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, 8000, true);
  view.setUint32(28, 16000, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  write(36, "data");
  view.setUint32(40, samples * 2, true);
  return new Blob([buffer], { type: "audio/wav" });
}

export function usePrototypeRecorder(durationMs = 24_000) {
  const [status, setStatus] = useState<string>("idle");
  const [elapsedMs, setElapsedMs] = useState(0);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const startedAt = useRef(0);
  useEffect(() => {
    if (status !== "recording") return;
    const timer = setInterval(
      () => setElapsedMs(Date.now() - startedAt.current),
      100,
    );
    return () => clearInterval(timer);
  }, [status]);
  useEffect(() => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [blob]);
  const start = () => {
    startedAt.current = Date.now();
    setElapsedMs(0);
    setStatus("recording");
  };
  const stop = () => {
    setBlob(silentAudio(durationMs));
    setStatus("recorded");
  };
  const reset = () => {
    setStatus("idle");
    setElapsedMs(0);
    setBlob(null);
    setPreviewUrl(null);
  };
  const getStream = useCallback((): MediaStream | null => null, []);
  return {
    status,
    elapsedMs,
    durationMs,
    blob,
    previewUrl,
    error: null,
    start,
    stop,
    reset,
    getStream,
  };
}
