"use client";
import { useRef, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Folder, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { AppShell } from "./app-shell";
import { TopBar } from "./top-bar";
import { ScriptConfirmDialog } from "./script-confirm-dialog";
import { scriptLibrary, type ScriptTopic } from "@/lib/script-library";
import styles from "./script-topic-picker.module.css";
export function ScriptTopicManager({
  topics,
  counts,
  onBack,
  onCreated,
  onRenamed,
  onDeleted,
}: {
  topics: ScriptTopic[];
  counts: Record<string, number>;
  onBack: () => void;
  onCreated: (topic: ScriptTopic) => void;
  onRenamed: (old: ScriptTopic, next: ScriptTopic) => void;
  onDeleted: (topic: ScriptTopic) => void;
}) {
  const [panel, setPanel] = useState<
    "menu" | "create" | "rename" | "delete" | null
  >(null);
  const [selected, setSelected] = useState<ScriptTopic | null>(null);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  async function submit() {
    if (inFlight.current) return;
    const value = name.trim().normalize("NFC");
    if (panel !== "delete") {
      if (!value || Array.from(value).length > 10) return;
      if (
        value === "미분류" ||
        topics.some(
          (t) =>
            t.id !== (panel === "rename" ? selected?.id : null) &&
            t.name.toLocaleLowerCase() === value.toLocaleLowerCase(),
        )
      ) {
        setError("이미 있는 이름이에요");
        return;
      }
    }
    inFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      if (panel === "delete" && selected) {
        await scriptLibrary.removeTopic(selected.id);
        onDeleted(selected);
      } else if (panel === "rename" && selected)
        onRenamed(
          selected,
          await scriptLibrary.renameTopic(selected.id, value),
        );
      else onCreated(await scriptLibrary.createTopic(value));
      setPanel(null);
    } catch {
      setError("변경하지 못했어요. 다시 시도해 주세요.");
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }
  return (
    <AppShell
      nav={false}
      viewportLocked
      chromeColor="#f2f4f6"
      className="flex flex-col !bg-[#f2f4f6]"
    >
      <TopBar
        to="/my-script"
        title="주제 관리"
        onBack={() => {
          if (!busy) onBack();
        }}
      />
      <main className="min-h-0 flex-1 overflow-y-auto px-5 pt-2 pb-5">
        <div className="divide-y divide-[#f2f4f6] rounded-[20px] bg-white px-4">
          {topics.map((t) => (
            <div key={t.id} className="flex items-center gap-3 py-4">
              <Folder size={22} className="text-[#4e5968]" />
              <div className="flex-1">
                <p className="text-[15px] font-bold">{t.name}</p>
                <p className="text-[13px] text-[#8b95a1]">
                  {counts[t.name] ?? 0}개 문장
                </p>
              </div>
              <button
                aria-label={`${t.name} 주제 더보기`}
                className="flex size-10 items-center justify-center text-[#b0b8c1]"
                onClick={() => {
                  setSelected(t);
                  setError(null);
                  setPanel("menu");
                }}
              >
                <MoreHorizontal size={20} />
              </button>
            </div>
          ))}
        </div>
        {!topics.length && (
          <p className="py-12 text-center text-sm text-[#8b95a1]">
            새 주제를 만들어 문장을 분류해 보세요
          </p>
        )}
      </main>
      <footer className="bg-white px-5 pt-3 pb-9">
        <button
          className="h-14 w-full rounded-full border border-[#e5e8eb] font-bold"
          onClick={() => {
            setName("");
            setError(null);
            setPanel("create");
          }}
        >
          새 주제 만들기
        </button>
      </footer>
      <Dialog.Root
        open={panel !== null && panel !== "delete"}
        onOpenChange={(v) => {
          if (!v && !busy) setPanel(null);
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className={styles.overlay} />
          <Dialog.Content
            className={panel === "menu" ? styles.sheet : styles.modal}
            aria-describedby={panel === "create" ? "new-topic-help" : undefined}
          >
            {panel === "menu" ? (
              <>
                <div className={styles.handle} />
                <Dialog.Title className="sr-only">
                  {selected?.name} 주제 관리
                </Dialog.Title>
                <button
                  className={styles.option}
                  onClick={() => {
                    setName(selected?.name ?? "");
                    setPanel("rename");
                  }}
                >
                  <Pencil size={18} />
                  이름 변경
                </button>
                <button
                  className={`${styles.option} text-[#f04452]`}
                  onClick={() => setPanel("delete")}
                >
                  <Trash2 size={18} />
                  주제 삭제
                </button>
              </>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void submit();
                }}
              >
                <Dialog.Title className={styles.modalTitle}>
                  {panel === "rename" ? "주제 이름 변경" : "새 주제 만들기"}
                </Dialog.Title>
                {panel === "create" && (
                  <Dialog.Description
                    id="new-topic-help"
                    className={styles.description}
                  >
                    문장을 묶어서 관리할 이름을 정해 주세요
                  </Dialog.Description>
                )}
                <div className={styles.inputWrap}>
                  <input
                    aria-label="주제 이름"
                    aria-invalid={!!error}
                    autoFocus
                    maxLength={10}
                    disabled={busy}
                    placeholder="예) 발표, 면접"
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value);
                      setError(null);
                    }}
                  />
                  <span>{Array.from(name).length}/10</span>
                </div>
                {error && (
                  <p className={styles.error} role="alert">
                    {error}
                  </p>
                )}
                <div className={styles.actions}>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => setPanel(null)}
                  >
                    취소
                  </button>
                  <button type="submit" disabled={busy || !name.trim()}>
                    {busy ? "저장 중…" : panel === "rename" ? "저장" : "만들기"}
                  </button>
                </div>
              </form>
            )}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
      <ScriptConfirmDialog
        open={panel === "delete"}
        title={`${selected?.name ?? ""} 주제를 삭제할까요?`}
        description={`주제 안 문장 ${counts[selected?.name ?? ""] ?? 0}개와 연습 기록도 함께 삭제돼요`}
        busy={busy}
        error={error}
        onClose={() => setPanel(null)}
        onConfirm={() => void submit()}
      />
    </AppShell>
  );
}
