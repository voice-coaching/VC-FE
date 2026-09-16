"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export type RecorderStatus =
  | "idle"
  | "requesting"
  | "recording"
  | "recorded"
  | "denied"
  | "unsupported"
  | "error";

const MAX_RECORDING_MS = 60_000;
const SUPPORTED_MIME_TYPES = [
  "audio/webm;codecs=opus",
  "audio/mp4",
  "audio/webm",
  "audio/ogg;codecs=opus",
] as const;

export function normalizeAudioMimeType(mimeType: string) {
  return mimeType.split(";", 1)[0]?.trim().toLowerCase() || "audio/webm";
}

function writeAscii(view: DataView, offset: number, value: string) {
  for (let index = 0; index < value.length; index += 1) {
    view.setUint8(offset + index, value.charCodeAt(index));
  }
}

async function convertToMonoWav(source: Blob) {
  const AudioContextClass = window.AudioContext;
  if (!AudioContextClass) {
    throw new Error("이 기기에서는 녹음 형식을 변환할 수 없습니다.");
  }

  const context = new AudioContextClass();
  try {
    const decoded = await context.decodeAudioData(await source.arrayBuffer());
    const samples = decoded.length;
    const dataLength = samples * 2;
    const buffer = new ArrayBuffer(44 + dataLength);
    const view = new DataView(buffer);

    writeAscii(view, 0, "RIFF");
    view.setUint32(4, 36 + dataLength, true);
    writeAscii(view, 8, "WAVE");
    writeAscii(view, 12, "fmt ");
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, decoded.sampleRate, true);
    view.setUint32(28, decoded.sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeAscii(view, 36, "data");
    view.setUint32(40, dataLength, true);

    const channels = Array.from(
      { length: decoded.numberOfChannels },
      (_, index) => decoded.getChannelData(index),
    );
    for (let sampleIndex = 0; sampleIndex < samples; sampleIndex += 1) {
      let sample = 0;
      for (const channel of channels) sample += channel[sampleIndex] ?? 0;
      sample = Math.max(-1, Math.min(1, sample / channels.length));
      view.setInt16(
        44 + sampleIndex * 2,
        sample < 0 ? sample * 0x8000 : sample * 0x7fff,
        true,
      );
    }

    return new Blob([buffer], { type: "audio/wav" });
  } catch {
    throw new Error("녹음 파일을 AI 분석용 형식으로 변환하지 못했습니다.");
  } finally {
    void context.close();
  }
}

export async function prepareAudioForAnalysis(
  source: Blob,
  acceptedMimeTypes: string[],
) {
  const accepted = acceptedMimeTypes.map((value) =>
    normalizeAudioMimeType(value),
  );
  const sourceMimeType = normalizeAudioMimeType(source.type);

  if (accepted.includes(sourceMimeType)) {
    const extensions: Record<string, string> = {
      "audio/mpeg": "mp3",
      "audio/wav": "wav",
      "audio/mp4": "m4a",
      "audio/ogg": "ogg",
      "audio/webm": "webm",
    };
    const extension = extensions[sourceMimeType] ?? "audio";
    return { blob: source, mimeType: sourceMimeType, extension };
  }

  if (accepted.includes("audio/wav")) {
    return {
      blob: await convertToMonoWav(source),
      mimeType: "audio/wav",
      extension: "wav",
    };
  }

  throw new Error(
    `이 기기의 녹음 형식(${sourceMimeType})을 서버가 지원하지 않습니다.`,
  );
}

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

  const getStream = useCallback(() => streamRef.current, []);

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
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      streamRef.current = stream;
      chunksRef.current = [];
      const mimeType = SUPPORTED_MIME_TYPES.find((type) =>
        MediaRecorder.isTypeSupported(type),
      );
      const recorder = new MediaRecorder(
        stream,
        mimeType ? { mimeType } : undefined,
      );
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
        const recorded = new Blob(chunksRef.current, {
          type: recorder.mimeType || "audio/webm",
        });
        clearTimers();
        stopTracks();
        setDurationMs(duration);
        setElapsedMs(duration);
        setBlob(recorded);
        setStatus(recorded.size > 0 ? "recorded" : "error");
        if (!recorded.size)
          setError("녹음된 음성이 없습니다. 다시 시도해 주세요.");
      };
      startedAtRef.current = Date.now();
      // A timeslice produces fragmented MP4 chunks in Safari/iOS. Joining those
      // chunks can leave the resulting recording playable only up to the first
      // fragment, so let MediaRecorder emit one finalized file when it stops.
      recorder.start();
      setStatus("recording");
      intervalRef.current = setInterval(
        () => setElapsedMs(Date.now() - startedAtRef.current),
        200,
      );
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

  const previewUrl = useMemo(
    () => (blob ? URL.createObjectURL(blob) : null),
    [blob],
  );
  useEffect(
    () => () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    },
    [previewUrl],
  );

  return {
    status,
    blob,
    durationMs,
    elapsedMs,
    previewUrl,
    error,
    start,
    stop,
    reset,
    getStream,
  };
}
