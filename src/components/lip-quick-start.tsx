"use client";
import Image from "next/image";
import { useEffect, useState } from "react";
import { BackButton } from "./back-button";
import { scriptLibrary } from "@/lib/script-library";
import { splitSentences } from "@/lib/sentences";
import {
  LIP_PRACTICE_SETS,
  type LipPracticeSet,
} from "@/lib/lip-practice-sets";
import type { PracticeContent } from "@/lib/api";
import styles from "./lip-quick-start.module.css";
const asset = (name: string) => `/figma/lip-quick-start/${name}`;
export function LipQuickStart({
  selected,
  onSelect,
  onStart,
  onSettings,
}: {
  selected: LipPracticeSet;
  onSelect: (set: LipPracticeSet) => void;
  onStart: () => void;
  onSettings: () => void;
}) {
  const [screen, setScreen] = useState<"prepare" | "topics" | "library">(
    "prepare",
  );
  const [scripts, setScripts] = useState<PracticeContent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (screen !== "library") return;
    let active = true;
    setLoading(true);
    setError("");
    scriptLibrary
      .list()
      .then((result) => {
        if (active) setScripts(result.items);
      })
      .catch(() => {
        if (active)
          setError("내 문장을 불러오지 못했어요. 다시 시도해 주세요.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [screen, retry]);
  function choose(set: LipPracticeSet) {
    onSelect(set);
    setScreen("prepare");
  }
  return (
    <div
      className={`${styles.screen} ${screen !== "prepare" ? styles.selection : ""}`}
    >
      <header className={styles.header}>
        {screen === "prepare" ? (
          <BackButton fallback="/home" className={styles.iconButton}>
            <Image src={asset("back.svg")} width={24} height={24} alt="" />
          </BackButton>
        ) : (
          <button
            aria-label="이전 단계"
            className={styles.iconButton}
            onClick={() =>
              setScreen(screen === "library" ? "topics" : "prepare")
            }
          >
            <Image src={asset("back.svg")} width={24} height={24} alt="" />
          </button>
        )}
        <h1>입모양 따라 하기</h1>
        {screen === "prepare" ? (
          <button
            aria-label="연습 설정"
            className={styles.iconButton}
            onClick={onSettings}
          >
            <Image src={asset("settings.svg")} width={22} height={22} alt="" />
          </button>
        ) : (
          <span className={styles.iconButton} />
        )}
      </header>
      {screen === "prepare" ? (
        <>
          <main className={styles.content}>
            <div className={styles.head}>
              <span className={styles.badge}>
                <Image
                  src={asset("sparkle.svg")}
                  width={13}
                  height={13}
                  alt=""
                />
                영상 피드백
              </span>
              <div>
                <h2>입모양을 보며 따라 말해요</h2>
                <p>
                  카메라로 입모양을 함께 보면서
                  <br />
                  소리와 모양을 같이 교정해요
                </p>
              </div>
            </div>
            <div className={styles.preview}>
              <div className={styles.crop}>
                <Image
                  src={asset("mascot.png")}
                  alt=""
                  width={338}
                  height={224}
                  priority
                  className={styles.mascot}
                />
              </div>
            </div>
            <section className={styles.sentences}>
              <div className={styles.setHeading}>
                <div>
                  <h3>{selected.title}</h3>
                  <p>{selected.description}</p>
                </div>
                <button onClick={() => setScreen("topics")}>
                  문장 바꾸기
                  <Image
                    src={asset("change-chevron.svg")}
                    width={16}
                    height={16}
                    alt=""
                  />
                </button>
              </div>
              <ol className={styles.sentenceList}>
                {selected.sentences.map((text, index) => (
                  <li key={index}>
                    <span>{index + 1}</span>
                    <p>{text}</p>
                  </li>
                ))}
              </ol>
            </section>
          </main>
          <footer className={styles.footer}>
            <button onClick={onStart} disabled={!selected.sentences.length}>
              카메라 켜고 시작하기
            </button>
          </footer>
        </>
      ) : (
        <main className={styles.content}>
          <div className={styles.selectionHead}>
            <h2>
              {screen === "topics"
                ? "어떤 문장으로 연습할까요?"
                : "내 문장을 골라 주세요"}
            </h2>
            <p>
              {screen === "topics"
                ? "카메라로 입모양을 보며 따라 말해요"
                : "보관함에 저장한 원고로 연습해요"}
            </p>
          </div>
          {screen === "topics" ? (
            <div className={styles.cards}>
              {[
                ...LIP_PRACTICE_SETS,
                {
                  id: "custom",
                  title: "내 문장",
                  description: "보관함에 저장한 내 원고로 연습해요",
                  minutes: 0,
                  sentences: [],
                },
              ].map((set, index) => (
                <button
                  key={set.id}
                  className={styles.card}
                  onClick={() =>
                    set.id === "custom" ? setScreen("library") : choose(set)
                  }
                >
                  <span className={`${styles.tile} ${styles[set.id]}`}>
                    {set.id === "final" ? (
                      "ㄹ"
                    ) : (
                      <Image
                        src={asset(
                          ["voice.svg", "book.svg", "", "note.svg"][index],
                        )}
                        width={26}
                        height={26}
                        alt=""
                      />
                    )}
                  </span>
                  <span className={styles.cardText}>
                    <strong>{set.title}</strong>
                    <span>{set.description}</span>
                    <small>
                      {set.id === "custom"
                        ? "보관함에서 골라요"
                        : `${set.sentences.length}문장  |  약 ${set.minutes}분`}
                    </small>
                  </span>
                  <Image
                    src={asset("chevron.svg")}
                    width={18}
                    height={18}
                    alt=""
                  />
                </button>
              ))}
            </div>
          ) : loading ? (
            <p role="status">내 문장을 불러오고 있어요</p>
          ) : error ? (
            <div role="alert">
              <p>{error}</p>
              <button
                className={styles.retry}
                onClick={() => setRetry((n) => n + 1)}
              >
                다시 시도
              </button>
            </div>
          ) : scripts.length ? (
            <div className={styles.cards}>
              {scripts.map((script) => (
                <button
                  key={script.id}
                  className={styles.card}
                  onClick={() =>
                    choose({
                      id: `custom-${script.id}`,
                      title: script.title,
                      description: "내 문장",
                      minutes: 2,
                      sentences: script.sentences?.length
                        ? [...script.sentences]
                            .sort((a, b) => a.sequenceNo - b.sequenceNo)
                            .map((s) => s.text)
                        : splitSentences(script.scriptText),
                    })
                  }
                >
                  <span className={styles.cardText}>
                    <strong>{script.title}</strong>
                    <small>
                      {script.sentences?.length ??
                        splitSentences(script.scriptText).length}
                      문장
                    </small>
                  </span>
                  <Image
                    src={asset("chevron.svg")}
                    width={18}
                    height={18}
                    alt=""
                  />
                </button>
              ))}
            </div>
          ) : (
            <p className={styles.empty}>
              저장한 내 문장이 없어요.
              <br />내 문장 보관함에서 원고를 만든 뒤 선택해 주세요.
            </p>
          )}
        </main>
      )}
    </div>
  );
}
