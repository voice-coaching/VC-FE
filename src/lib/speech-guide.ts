import { referencePlayback } from "./audio-playback";

let stopPrevious: (() => void) | null = null;

/** Device TTS is a fallback only when the content has no recorded guide. */
export function createSpeechGuide(
  text: string,
  synthesis: SpeechSynthesis,
  utterance: (text: string) => SpeechSynthesisUtterance,
  change: (playing: boolean, error?: string) => void,
  id = Symbol("speech-guide"),
) {
  let current: SpeechSynthesisUtterance | null = null;
  let playing = false;
  let disposed = false;
  let generation = 0;
  const stop = () => {
    generation += 1;
    if (current) synthesis.cancel();
    current = null;
    playing = false;
    referencePlayback.release(id);
    if (stopPrevious === stop) stopPrevious = null;
    if (!disposed) change(false);
  };
  return {
    id,
    toggle() {
      if (disposed) return;
      if (playing) {
        synthesis.pause();
        playing = false;
        referencePlayback.release(id);
        change(false);
        return;
      }
      if (!referencePlayback.claim(id)) return;
      if (current && stopPrevious === stop) {
        synthesis.resume();
        playing = true;
        change(true);
        return;
      }
      stopPrevious?.();
      stopPrevious = stop;
      const attempt = ++generation;
      try {
        current = utterance(text);
        current.lang = /[가-힣]/u.test(text) ? "ko-KR" : "en-US";
        const voice = synthesis
          .getVoices()
          .find((voice) =>
            voice.lang.toLowerCase().startsWith(current!.lang.slice(0, 2)),
          );
        if (voice) current.voice = voice;
        current.onstart = () => {
          if (disposed || generation !== attempt) return;
          playing = true;
          change(true);
        };
        current.onend = () => {
          if (generation === attempt) stop();
        };
        current.onerror = () => {
          if (disposed || generation !== attempt) return;
          stop();
          change(false, "기기 음성을 재생하지 못했어요. 다시 시도해 주세요.");
        };
        if (synthesis.paused) synthesis.resume();
        synthesis.speak(current);
      } catch {
        stop();
        change(false, "이 기기에서 가이드 음성을 사용할 수 없어요.");
      }
    },
    dispose() {
      disposed = true;
      stop();
    },
  };
}
