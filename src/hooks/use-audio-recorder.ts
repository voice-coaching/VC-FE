"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { createPcmRecording, playRecordingCue } from "@/lib/recording-audio";

export type RecorderStatus =
  | "idle"
  | "requesting"
  | "recording"
  | "stopping"
  | "recorded"
  | "denied"
  | "unsupported"
  | "error";

const MAX_RECORDING_MS = 60_000;
const RECORDING_TAIL_PADDING_MS = 250;
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

    return {
      blob: new Blob([buffer], { type: "audio/wav" }),
      durationMs: Math.round(decoded.duration * 1_000),
    };
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
    const converted = await convertToMonoWav(source);
    return {
      blob: converted.blob,
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
  const [previewBlob, setPreviewBlob] = useState<Blob | null>(null);
  const [durationMs, setDurationMs] = useState(0);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stopDelayRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recordingGenerationRef = useRef(0);
  const contextRef = useRef<AudioContext | null>(null);
  const pcmRef = useRef<Awaited<ReturnType<typeof createPcmRecording>> | null>(
    null,
  );
  const startingRef = useRef(false);

  const clearTimers = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (stopDelayRef.current) clearTimeout(stopDelayRef.current);
    intervalRef.current = null;
    timeoutRef.current = null;
    stopDelayRef.current = null;
  }, []);

  const stopTracks = useCallback(() => {
    pcmRef.current?.dispose();
    pcmRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    const context = contextRef.current;
    contextRef.current = null;
    if (context && context.state !== "closed")
      void context.close().catch(() => undefined);
  }, []);

  const stop = useCallback(() => {
    const recorder = recorderRef.current;
    const pcm = pcmRef.current;
    if ((!pcm && recorder?.state !== "recording") || stopDelayRef.current)
      return;
    const generation = recordingGenerationRef.current;

    if (intervalRef.current) clearInterval(intervalRef.current);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    intervalRef.current = null;
    timeoutRef.current = null;
    setElapsedMs(Date.now() - startedAtRef.current);
    setStatus("stopping");

    // Preserve the final syllable while the recorder flushes its encoder.
    stopDelayRef.current = setTimeout(() => {
      if (pcm) {
        void pcm
          .stop()
          .then((recorded) => {
            if (generation !== recordingGenerationRef.current) return;
            setBlob(recorded.blob);
            setPreviewBlob(recorded.blob);
            setDurationMs(recorded.durationMs);
            setElapsedMs(recorded.durationMs);
            setStatus("recorded");
          })
          .catch((reason: unknown) => {
            if (generation !== recordingGenerationRef.current) return;
            setStatus("error");
            setError(
              reason instanceof Error
                ? reason.message
                : "녹음된 음성을 확인하지 못했습니다.",
            );
          })
          .finally(() => {
            if (generation !== recordingGenerationRef.current) return;
            clearTimers();
            stopTracks();
          });
      } else {
        stopDelayRef.current = null;
        if (recorder?.state === "recording") recorder.stop();
      }
    }, RECORDING_TAIL_PADDING_MS);
  }, [clearTimers, stopTracks]);

  const getStream = useCallback(() => streamRef.current, []);

  const start = useCallback(async () => {
    if (startingRef.current || pcmRef.current || recorderRef.current)
      return false;
    startingRef.current = true;
    clearTimers();
    const recordingGeneration = ++recordingGenerationRef.current;
    setError(null);
    setBlob(null);
    setPreviewBlob(null);
    setElapsedMs(0);
    setDurationMs(0);
    const native = Capacitor.isNativePlatform();
    if (
      typeof navigator === "undefined" ||
      !navigator.mediaDevices?.getUserMedia ||
      (!native && typeof MediaRecorder === "undefined") ||
      !window.AudioContext
    ) {
      setStatus("unsupported");
      setError("이 브라우저에서는 음성 녹음을 지원하지 않습니다.");
      startingRef.current = false;
      return false;
    }
    setStatus("requesting");
    try {
      // Create/resume during the tap, before the asynchronous permission prompt.
      const context = new AudioContext();
      contextRef.current = context;
      void context.resume().catch(() => undefined);
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      if (recordingGeneration !== recordingGenerationRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return false;
      }
      streamRef.current = stream;
      if (native) {
        const pcm = await createPcmRecording(context, stream);
        if (recordingGeneration !== recordingGenerationRef.current) {
          pcm.dispose();
          return false;
        }
        pcmRef.current = pcm;
      }
      await playRecordingCue(context);
      if (recordingGeneration !== recordingGenerationRef.current) return false;
      if (native) {
        pcmRef.current!.start();
        startedAtRef.current = Date.now();
        setStatus("recording");
        intervalRef.current = setInterval(
          () => setElapsedMs(Date.now() - startedAtRef.current),
          200,
        );
        timeoutRef.current = setTimeout(
          stop,
          MAX_RECORDING_MS - RECORDING_TAIL_PADDING_MS,
        );
        return true;
      }
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
        if (recordingGeneration !== recordingGenerationRef.current) return;
        const measuredDuration = Date.now() - startedAtRef.current;
        const recorded = new Blob(chunksRef.current, {
          type: recorder.mimeType || "audio/webm",
        });
        clearTimers();
        stopTracks();
        recorderRef.current = null;

        if (!recorded.size) {
          setStatus("error");
          setError("녹음된 음성이 없습니다. 다시 시도해 주세요.");
          return;
        }

        // MediaRecorder WebM/MP4 blobs can expose a zero or truncated duration
        // in embedded WebViews. Decode once and use a WAV copy for local
        // playback; keep the original blob for the server upload.
        void (async () => {
          let playable = recorded;
          let playableDuration = measuredDuration;
          try {
            const converted = await convertToMonoWav(recorded);
            // Do not replace a multi-second recording with a decoded fragment.
            if (converted.durationMs >= Math.max(1, measuredDuration * 0.8)) {
              playable = converted.blob;
              playableDuration = converted.durationMs;
            }
          } catch {
            // The original recording remains uploadable and is a safe fallback
            // on browsers that cannot decode their own MediaRecorder output.
          }

          if (recordingGeneration !== recordingGenerationRef.current) return;
          setDurationMs(playableDuration);
          setElapsedMs(playableDuration);
          setBlob(recorded);
          setPreviewBlob(playable);
          setStatus("recorded");
        })();
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
      timeoutRef.current = setTimeout(
        stop,
        MAX_RECORDING_MS - RECORDING_TAIL_PADDING_MS,
      );
      return true;
    } catch (reason) {
      if (recordingGeneration !== recordingGenerationRef.current) return false;
      stopTracks();
      const denied =
        reason instanceof DOMException &&
        (reason.name === "NotAllowedError" || reason.name === "SecurityError");
      setStatus(denied ? "denied" : "error");
      setError(
        denied
          ? "마이크 권한이 거부되었습니다. 브라우저 설정에서 권한을 허용해 주세요."
          : reason instanceof Error
            ? reason.message
            : "마이크를 시작하지 못했습니다.",
      );
      return false;
    } finally {
      if (recordingGeneration === recordingGenerationRef.current)
        startingRef.current = false;
    }
  }, [clearTimers, stop, stopTracks]);

  const reset = useCallback(() => {
    recordingGenerationRef.current += 1;
    startingRef.current = false;
    clearTimers();
    const recorder = recorderRef.current;
    if (recorder?.state === "recording") {
      recorder.ondataavailable = null;
      recorder.onerror = null;
      recorder.onstop = null;
      recorder.stop();
    }
    recorderRef.current = null;
    chunksRef.current = [];
    stopTracks();
    setBlob(null);
    setPreviewBlob(null);
    setDurationMs(0);
    setElapsedMs(0);
    setError(null);
    setStatus("idle");
  }, [clearTimers, stopTracks]);

  useEffect(
    () => () => {
      recordingGenerationRef.current += 1;
      clearTimers();
      const recorder = recorderRef.current;
      if (recorder?.state === "recording") {
        recorder.ondataavailable = null;
        recorder.onerror = null;
        recorder.onstop = null;
        recorder.stop();
      }
      stopTracks();
    },
    [clearTimers, stopTracks],
  );

  const previewUrl = useMemo(
    () => (previewBlob ? URL.createObjectURL(previewBlob) : null),
    [previewBlob],
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
