"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import * as Dialog from "@radix-ui/react-dialog";
import styles from "./script-topic-picker.module.css";

export function ScriptTopicPicker({
  value,
  topics,
  counts,
  onChange,
  onCreate,
}: {
  value: string;
  topics: string[];
  counts: Record<string, number>;
  onChange: (value: string) => void;
  onCreate: (value: string) => boolean | Promise<boolean>;
}) {
  const [panel, setPanel] = useState<"select" | "create" | null>(null);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const [error, setError] = useState("");
  const trigger = useRef<HTMLButtonElement>(null);
  const normalized = name.trim().normalize("NFC");
  const duplicate = topics.some(
    (topic) =>
      topic.normalize("NFC").toLocaleLowerCase() ===
      normalized.toLocaleLowerCase(),
  );
  async function create() {
    if (!normalized || inFlight.current) return;
    if (duplicate) {
      setError("이미 있는 이름이에요");
      return;
    }
    inFlight.current = true;
    setBusy(true);
    try {
      if (!(await onCreate(normalized))) throw new Error();
      onChange(normalized);
      setPanel(null);
    } catch {
      setError("주제를 저장하지 못했어요. 다시 시도해 주세요.");
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  return (
    <>
      <button
        ref={trigger}
        type="button"
        className={styles.trigger}
        aria-haspopup="dialog"
        aria-expanded={panel !== null}
        onClick={() => setPanel("select")}
      >
        <strong>연습 주제</strong>
        <span>{value}</span>
        <Image
          src="/figma/my-script/chevron.svg"
          alt=""
          width={18}
          height={18}
        />
      </button>
      <Dialog.Root
        open={panel !== null}
        onOpenChange={(open) => {
          if (!open && !busy) setPanel(null);
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className={styles.overlay} />
          <Dialog.Content
            className={panel === "create" ? styles.modal : styles.sheet}
            onCloseAutoFocus={(event) => {
              event.preventDefault();
              trigger.current?.focus();
            }}
            aria-describedby={
              panel === "create" ? "topic-description" : undefined
            }
          >
            {panel === "select" ? (
              <>
                <div className={styles.handle} />
                <Dialog.Title className={styles.sheetTitle}>
                  연습 주제 선택
                </Dialog.Title>
                <div className={styles.options}>
                  {topics.map((topic) => (
                    <button
                      key={topic}
                      type="button"
                      aria-pressed={topic === value}
                      className={styles.option}
                      onClick={() => {
                        onChange(topic);
                        setPanel(null);
                      }}
                    >
                      <Image
                        src={`/figma/my-script/folder${topic === value ? "-active" : ""}.svg`}
                        alt=""
                        width={22}
                        height={22}
                      />
                      <span className={styles.optionLabel}>
                        <span>{topic}</span>
                        <small>{counts[topic] ?? 0}개 문장</small>
                      </span>
                      <span className={styles.check}>
                        {topic === value && (
                          <Image
                            src="/figma/my-script/check.svg"
                            alt=""
                            width={18}
                            height={18}
                          />
                        )}
                      </span>
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  className={styles.add}
                  onClick={() => {
                    setName("");
                    setError("");
                    setPanel("create");
                  }}
                >
                  <span className={styles.addIcon}>
                    <Image
                      src="/figma/my-script/topic-plus.svg"
                      alt=""
                      width={16}
                      height={16}
                    />
                  </span>
                  새 주제 만들기
                </button>
              </>
            ) : (
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  void create();
                }}
              >
                <Dialog.Title className={styles.modalTitle}>
                  새 주제 만들기
                </Dialog.Title>
                <Dialog.Description
                  id="topic-description"
                  className={styles.description}
                >
                  문장을 묶어서 관리할 이름을 정해 주세요
                </Dialog.Description>
                <div className={styles.inputWrap}>
                  <input
                    disabled={busy}
                    autoFocus
                    aria-label="주제 이름"
                    aria-invalid={!!error}
                    aria-describedby={error ? "topic-error" : undefined}
                    placeholder="예) 발표, 면접"
                    maxLength={10}
                    value={name}
                    onChange={(event) => {
                      setName(event.target.value);
                      setError("");
                    }}
                  />
                  <span>{name.length}/10</span>
                </div>
                {error && (
                  <p id="topic-error" role="alert" className={styles.error}>
                    {error}
                  </p>
                )}
                <div className={styles.actions}>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => setPanel("select")}
                  >
                    취소
                  </button>
                  <button type="submit" disabled={!normalized || busy}>
                    만들기
                  </button>
                </div>
              </form>
            )}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}
