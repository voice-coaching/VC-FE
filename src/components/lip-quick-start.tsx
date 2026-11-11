"use client";
import Image from "next/image";
import { useEffect, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { BackButton } from "./back-button";
import { scriptLibrary, SCRIPT_LIBRARY_AVAILABLE } from "@/lib/script-library";
import { splitSentences } from "@/lib/sentences";
import {
  LIP_PRACTICE_SETS,
  type LipPracticeSet,
} from "@/lib/lip-practice-sets";
import { api } from "@/lib/api";
import styles from "./lip-quick-start.module.css";
const asset = (name: string) => `/figma/lip-quick-start/${name}`;
const criteria = [
  ["엄격하게", "작은 차이도 놓치지 않고 잡아 줘요"],
  ["보통", "일상 대화 수준으로 평가해요"],
  ["너그럽게", "발음이 어려운 분에게 맞춰 기준을 낮춰요"],
];
type Choice = { id: string; text: string; title: string };
export function LipQuickStart({
  selected,
  onSelect,
  onStart,
  preview = false,
}: {
  selected: LipPracticeSet;
  onSelect: (set: LipPracticeSet) => void;
  onStart: () => void;
  onSettings?: () => void;
  preview?: boolean;
}) {
  const [picking, setPicking] = useState(false);
  const [tab, setTab] = useState(0);
  const [choices, setChoices] = useState<Choice[]>([]);
  const [picked, setPicked] = useState<Choice[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [toast, setToast] = useState(false);
  const [settings, setSettings] = useState(false);
  const [criterion, setCriterion] = useState(1);
  const [draft, setDraft] = useState(1);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(false), 2200);
    return () => clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    if (!picking) return;
    let active = true;
    setError("");
    setLoading(true);
    async function load() {
      if (preview) {
        const set = LIP_PRACTICE_SETS[tab === 0 ? 1 : 2];
        const sentences =
          tab === 0
            ? [
                ...set.sentences,
                "물가 상승세가 둔화된 점이 반영됐습니다.",
                "다음 회의는 다음 달 중순에 열립니다.",
                "전문가들은 연내 인하 가능성을 낮게 봅니다.",
              ]
            : tab === 1
              ? set.sentences
              : [
                  "안녕하세요, 오늘 발표를 맡은 김하늘입니다.",
                  "지금부터 그 결과를 말씀드리겠습니다.",
                ];
        return sentences.map((text, i) => ({
          id: `${tab}-${i}`,
          text,
          title:
            tab === 0
              ? "한국은행 기준금리 동결"
              : tab === 1
                ? "받침 집중"
                : "발표 원고",
        }));
      }
      const result =
        tab === 2
          ? SCRIPT_LIBRARY_AVAILABLE
            ? await scriptLibrary.list()
            : { items: [] }
          : await api.content.list({
              type: tab === 0 ? "NEWS" : "SENTENCE",
              page: 0,
              size: 20,
            });
      const contents = await Promise.all(
        result.items.map((item) => api.content.get(item.id)),
      );
      return contents.flatMap((content) =>
        splitSentences(content.scriptText).map((text, i) => ({
          id: `${content.id}-${i}`,
          text,
          title: content.title,
        })),
      );
    }
    load()
      .then((items) => {
        if (active) setChoices(items);
      })
      .catch(() => {
        if (active) setError("문장을 불러오지 못했어요.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [picking, tab, preview, retry]);
  function toggle(choice: Choice) {
    if (picked.some((item) => item.id === choice.id))
      setPicked(picked.filter((item) => item.id !== choice.id));
    else if (picked.length === 3) setToast(true);
    else setPicked([...picked, choice]);
  }
  return (
    <div className={styles.screen}>
      <header className={styles.header}>
        {picking ? (
          <button
            aria-label="이전 단계"
            className={styles.iconButton}
            onClick={() => setPicking(false)}
          >
            <Image src={asset("back.svg")} width={24} height={24} alt="" />
          </button>
        ) : (
          <BackButton fallback="/home" className={styles.iconButton}>
            <Image src={asset("back.svg")} width={24} height={24} alt="" />
          </BackButton>
        )}
        <h1>{picking ? "문장 고르기" : "입모양 따라 하기"}</h1>
        {picking ? (
          <span className={styles.iconButton} />
        ) : (
          <button
            aria-label="연습 설정"
            className={styles.iconButton}
            onClick={() => {
              setDraft(criterion);
              setSettings(true);
            }}
          >
            <Image src={asset("settings.svg")} width={22} height={22} alt="" />
          </button>
        )}
      </header>
      {picking ? (
        <>
          <div className={styles.tabs} role="tablist" aria-label="문장 출처">
            {["오늘의 뉴스", "발음 코스", "내 문장"].map((label, index) => (
              <button
                key={label}
                role="tab"
                aria-selected={tab === index}
                onClick={() => setTab(index)}
              >
                {label}
              </button>
            ))}
          </div>
          <main className={styles.picker}>
            {loading ? (
              <p className={styles.empty}>문장을 불러오고 있어요</p>
            ) : error ? (
              <div className={styles.empty}>
                <p role="alert">{error}</p>
                <button onClick={() => setRetry(retry + 1)}>다시 시도</button>
              </div>
            ) : !choices.length ? (
              <p className={styles.empty}>아직 연습할 문장이 없어요</p>
            ) : (
              <>
                <h2>
                  {choices[0]?.title} <span>{choices.length}</span>
                </h2>
                <div className={styles.choiceList}>
                  {choices.map((choice, index) => {
                    const checked = picked.some(
                      (item) => item.id === choice.id,
                    );
                    return (
                      <button
                        key={choice.id}
                        className={styles.choice}
                        aria-pressed={checked}
                        onClick={() => toggle(choice)}
                      >
                        <span className={styles.number}>
                          {String(index + 1).padStart(2, "0")}
                        </span>
                        <span className={styles.choiceText}>{choice.text}</span>
                        <span className={styles.check}>
                          {checked && (
                            <Image
                              src={asset("check.svg")}
                              width={12}
                              height={12}
                              alt=""
                            />
                          )}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </main>
          <footer className={styles.pickFooter}>
            {toast && (
              <p role="status" className={styles.toast}>
                최대 3문장까지 고를 수 있어요
              </p>
            )}
            <p>
              고른 문장 <strong>{picked.length}/3</strong>
            </p>
            {picked.length ? (
              <div className={styles.chips}>
                {picked.map((choice) => (
                  <button
                    key={choice.id}
                    aria-label={`${choice.text} 선택 해제`}
                    onClick={() => toggle(choice)}
                  >
                    <span>{choice.text}</span> ×
                  </button>
                ))}
              </div>
            ) : (
              <p className={styles.hint}>
                연습할 문장을 최대 3개까지 골라 주세요
              </p>
            )}
            <button
              className={styles.action}
              disabled={!picked.length}
              onClick={() => {
                onSelect({
                  id: "selected",
                  title: `고른 ${picked.length}문장`,
                  description: "입모양과 소리를 함께 확인해요",
                  minutes: 2,
                  sentences: picked.map((item) => item.text),
                });
                setPicking(false);
              }}
            >
              {picked.length
                ? `${picked.length}문장으로 연습하기`
                : "문장을 골라 주세요"}
            </button>
          </footer>
        </>
      ) : (
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
              <Image
                src={asset("mascot-purple-v2.png")}
                alt=""
                width={185}
                height={224}
                priority
                className={styles.mascot}
              />
            </div>
            <section className={styles.sentences}>
              <div className={styles.setHeading}>
                <div>
                  <h3>
                    {selected.id === "news"
                      ? `오늘의 추천 ${selected.sentences.length}문장`
                      : selected.title}
                  </h3>
                </div>
                <button
                  onClick={() => {
                    setPicked([]);
                    setPicking(true);
                  }}
                >
                  문장 바꾸기
                  <Image
                    src={asset("change-chevron.svg")}
                    width={16}
                    height={16}
                    alt=""
                  />
                </button>
              </div>
              <p className={styles.setDescription}>
                {preview && selected.id === "news"
                  ? "최근 리포트에서 자주 틀린 받침이 들어 있어요"
                  : selected.description}
              </p>
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
      )}
      <Dialog.Root open={settings} onOpenChange={setSettings}>
        <Dialog.Portal>
          <Dialog.Overlay className={`app-scrim ${styles.overlay}`} />
          <Dialog.Content
            className={`app-sheet ${styles.sheet}`}
            aria-describedby={undefined}
          >
            <div className={styles.handle} />
            <div className={styles.sheetHeader}>
              <Dialog.Title>연습 설정</Dialog.Title>
              <Dialog.Close aria-label="설정 닫기">
                <Image src={asset("close.svg")} width={24} height={24} alt="" />
              </Dialog.Close>
            </div>
            <p className={styles.settingLabel}>AI 평가 기준</p>
            <div
              className={styles.options}
              role="radiogroup"
              aria-label="AI 평가 기준"
            >
              {criteria.map(([title, description], index) => (
                <button
                  key={title}
                  role="radio"
                  aria-checked={draft === index}
                  onClick={() => setDraft(index)}
                >
                  <span>
                    <strong>{title}</strong>
                    <small>{description}</small>
                  </span>
                  {draft === index && (
                    <span className={styles.check}>
                      <Image
                        src={asset("settings-check.svg")}
                        width={14}
                        height={14}
                        alt=""
                      />
                    </span>
                  )}
                </button>
              ))}
            </div>
            <button
              className={styles.action}
              onClick={() => {
                setCriterion(draft);
                setSettings(false);
              }}
            >
              적용하기
            </button>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
