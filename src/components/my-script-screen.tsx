"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import * as Dialog from "@radix-ui/react-dialog";
import topicStyles from "./script-topic-picker.module.css";
import { ScriptTextInput } from "@/components/script-text-input";
import { AppShell } from "@/components/app-shell";
import { PracticeSession } from "@/components/practice-session";
import { TopBar } from "@/components/top-bar";
import { ScriptSavedToast } from "@/components/script-saved-toast";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { SentenceReader } from "@/components/sentence-reader";
import {
  api,
  type PracticeContent,
  type PracticeContentSummary,
} from "@/lib/api";
import { splitSentences } from "@/lib/sentences";
import { ScriptTopicPicker } from "@/components/script-topic-picker";
import { DEFAULT_SCRIPT_TOPICS, type ScriptTopics } from "@/lib/script-topics";
import { Settings, Check } from "lucide-react";
import {
  scriptLibrary,
  type ScriptTopic,
  type ScriptLibrary,
} from "@/lib/script-library";
import { ScriptTopicManager } from "./script-topic-manager";
import { ScriptConfirmDialog } from "./script-confirm-dialog";
import { CUSTOM_SCRIPT_LIMIT } from "@/lib/custom-draft";

export function MyScriptScreen() {
  const [scriptTitle, setScriptTitle] = useState("");
  const [topic, setTopic] = useState("발표");
  const [topicData, setTopicData] = useState<ScriptTopics>({
    topics: [...DEFAULT_SCRIPT_TOPICS],
    assignments: {},
  });
  const [serverTopics, setServerTopics] = useState<ScriptTopic[]>([]);
  const [editMode, setEditMode] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [deleteIds, setDeleteIds] = useState<string[] | null>(null);
  const [editingId, setEditingId] = useState<string | number | null>(null);
  const [text, setText] = useState("");
  const [savedNotice, setSavedNotice] = useState<{
    content: PracticeContent;
    message: string;
  } | null>(null);
  const dismissSavedNotice = useCallback(() => setSavedNotice(null), []);
  const [libraryTopic, setLibraryTopic] = useState<string | null>(null);
  const [exitOpen, setExitOpen] = useState(false);
  const [stage, setStage] = useState<
    "library" | "input" | "confirm" | "detail" | "practice" | "topics"
  >("library");
  const [scripts, setScripts] = useState<
    (PracticeContentSummary & { createdAt?: string | null })[]
  >([]);
  const [libraryLoading, setLibraryLoading] = useState(true);
  const [libraryError, setLibraryError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [title, setTitle] = useState("연습하기");
  const [content, setContent] = useState<PracticeContent | null>(null);
  const [copyMessage, setCopyMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const request = useRef<{ text: string; key: string } | null>(null);
  const saveInFlight = useRef(false);
  const sentences = splitSentences(text);
  const characterCount = Array.from(text).length;
  const tooLong = characterCount > CUSTOM_SCRIPT_LIMIT;
  const hasDraft = !!(text.length || scriptTitle.length || topic !== "발표");
  const editing = stage === "input" || stage === "confirm";

  useEffect(() => {
    if (!editing || !hasDraft) return;
    function protectDraft(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = "";
    }
    window.addEventListener("beforeunload", protectDraft);
    return () => window.removeEventListener("beforeunload", protectDraft);
  }, [editing, hasDraft]);

  function discardDraft() {
    setExitOpen(false);
    setText("");
    setScriptTitle("");
    setTopic(topicData.topics[0] ?? "미분류");
    setEditingId(null);
    setSaveError(null);
    request.current = null;
    setStage(editingId && content ? "detail" : "library");
  }

  useEffect(() => {
    let active = true;
    async function loadLibrary() {
      setLibraryLoading(true);
      setLibraryError(null);
      try {
        const result = await scriptLibrary.list();
        if (!active) return;
        applyLibrary(result);
      } catch (reason) {
        if (active)
          setLibraryError(
            reason instanceof Error
              ? reason.message
              : "내 문장을 불러오지 못했어요.",
          );
      } finally {
        if (active) setLibraryLoading(false);
      }
    }
    void loadLibrary();
    return () => {
      active = false;
    };
  }, [reload]);

  function applyLibrary(result: ScriptLibrary) {
    setScripts(
      result.items.map((item) => ({
        ...item,
        sentenceCount:
          item.sentences?.length ?? splitSentences(item.scriptText).length,
      })),
    );
    setServerTopics(result.topics);
    setTopicData({
      topics: [...result.topics.map((t) => t.name), "미분류"],
      assignments: result.assignments,
    });
  }
  async function createTopic(name: string) {
    const created = await scriptLibrary.createTopic(name);
    setServerTopics((items) => [...items, created]);
    setTopicData((data) => ({
      ...data,
      topics: [...data.topics.filter((t) => t !== "미분류"), name, "미분류"],
    }));
    return true;
  }
  const visibleScripts = scripts.filter(
    (script) =>
      !libraryTopic ||
      (topicData.assignments[String(script.id)] ?? "미분류") === libraryTopic,
  );
  function finishEditing() {
    setEditMode(false);
    setSelected([]);
    setSaveError(null);
  }
  async function deleteScripts() {
    if (!deleteIds?.length || saveInFlight.current) return;
    saveInFlight.current = true;
    setSaving(true);
    setSaveError(null);
    try {
      await scriptLibrary.remove(deleteIds);
      setScripts((items) =>
        items.filter((item) => !deleteIds.includes(String(item.id))),
      );
      setSelected([]);
      setDeleteIds(null);
      setContent(null);
      setSavedNotice(null);
      setStage("library");
    } catch {
      setSaveError("삭제하지 못했어요. 다시 시도해 주세요.");
    } finally {
      saveInFlight.current = false;
      setSaving(false);
    }
  }
  const deleteDialog = (
    <ScriptConfirmDialog
      open={deleteIds !== null}
      title={`문장 ${deleteIds?.length ?? 0}개를 삭제할까요?`}
      description="연습 기록도 함께 삭제되며 되돌릴 수 없어요"
      busy={saving}
      error={saveError}
      onClose={() => {
        setDeleteIds(null);
        setSaveError(null);
      }}
      onConfirm={() => void deleteScripts()}
    />
  );
  const topicCounts = scripts.reduce<Record<string, number>>(
    (counts, script) => {
      const name = topicData.assignments[String(script.id)] ?? "미분류";
      counts[name] = (counts[name] ?? 0) + 1;
      return counts;
    },
    {},
  );

  async function openScript(id: PracticeContentSummary["id"]) {
    if (saveInFlight.current) return;
    saveInFlight.current = true;
    setSaving(true);
    setSaveError(null);
    try {
      setContent(await api.content.get(id));
      setCopyMessage("");
      setStage("detail");
    } catch {
      setSaveError("문장을 열지 못했어요. 다시 시도해 주세요.");
    } finally {
      saveInFlight.current = false;
      setSaving(false);
    }
  }

  async function saveScript(practiceImmediately = false) {
    if (saveInFlight.current || !scriptTitle.trim() || !text.trim() || tooLong)
      return;
    saveInFlight.current = true;
    setSaving(true);
    setSaveError(null);
    const script = text.trim().replace(/\s+/g, " ");
    const requestIdentity = JSON.stringify([
      scriptTitle.trim(),
      script,
      topic,
      editingId,
    ]);
    if (request.current?.text !== requestIdentity)
      request.current = { text: requestIdentity, key: crypto.randomUUID() };
    try {
      const created = await scriptLibrary.save(
        editingId,
        {
          title: scriptTitle.trim(),
          scriptText: script,
          topicId: serverTopics.find((t) => t.name === topic)?.id ?? null,
        },
        request.current.key,
      );
      const saved = created;
      setScripts((items) => [
        {
          ...saved,
          sentenceCount:
            saved.sentences?.length ?? splitSentences(saved.scriptText).length,
        },
        ...items.filter(
          (item) =>
            item.id !== saved.id && String(item.id) !== String(editingId),
        ),
      ]);
      setTopicData((data) => ({
        ...data,
        assignments: { ...data.assignments, [String(saved.id)]: topic },
      }));
      setSaveError(null);
      setSavedNotice({ content: saved, message: `${topic} 주제에 저장했어요` });
      setEditingId(null);
      setLibraryTopic(null);
      setText("");
      setScriptTitle("");
      request.current = null;
      if (practiceImmediately) {
        setSavedNotice(null);
        setContent(saved);
        setTitle("연습하기");
        setStage("practice");
      } else {
        setStage("library");
      }
    } catch (reason) {
      setSaveError(
        reason instanceof Error
          ? reason.message
          : "문장을 저장하지 못했습니다.",
      );
    } finally {
      saveInFlight.current = false;
      setSaving(false);
    }
  }

  if (stage === "topics")
    return (
      <ScriptTopicManager
        topics={serverTopics}
        counts={topicCounts}
        onBack={() => setStage("library")}
        onCreated={(created) => {
          setServerTopics((items) => [...items, created]);
          setTopicData((data) => ({
            ...data,
            topics: [
              ...data.topics.filter((t) => t !== "미분류"),
              created.name,
              "미분류",
            ],
          }));
        }}
        onRenamed={(old, next) => {
          setServerTopics((items) =>
            items.map((t) => (t.id === old.id ? next : t)),
          );
          setTopicData((data) => ({
            topics: data.topics.map((t) => (t === old.name ? next.name : t)),
            assignments: Object.fromEntries(
              Object.entries(data.assignments).map(([id, name]) => [
                id,
                name === old.name ? next.name : name,
              ]),
            ),
          }));
          if (libraryTopic === old.name) setLibraryTopic(next.name);
        }}
        onDeleted={(deleted) => {
          setServerTopics((items) => items.filter((t) => t.id !== deleted.id));
          setScripts((items) =>
            items.filter(
              (t) => topicData.assignments[String(t.id)] !== deleted.name,
            ),
          );
          setTopicData((data) => ({
            topics: data.topics.filter((t) => t !== deleted.name),
            assignments: Object.fromEntries(
              Object.entries(data.assignments).filter(
                ([, name]) => name !== deleted.name,
              ),
            ),
          }));
          if (libraryTopic === deleted.name) setLibraryTopic(null);
          setSavedNotice(null);
        }}
      />
    );

  if (stage === "library") {
    return (
      <AppShell
        nav={!editMode}
        viewportLocked
        chromeColor="#f2f4f6"
        className="relative flex flex-col !bg-[#f2f4f6]"
      >
        <TopBar
          to="/home"
          title="내 문장"
          onBack={editMode ? finishEditing : undefined}
          right={
            !libraryLoading &&
            !libraryError && (
              <button
                className={`px-3 py-2 text-[14px] font-bold ${editMode ? "text-[#2f6bff]" : "text-[#4e5968]"}`}
                onClick={() => {
                  if (editMode) finishEditing();
                  else {
                    setEditMode(true);
                    setSavedNotice(null);
                    setSaveError(null);
                  }
                }}
              >
                {editMode ? "완료" : "편집"}
              </button>
            )
          }
        />
        {libraryLoading ? (
          <div
            role="status"
            aria-label="내 문장 불러오는 중"
            className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4 px-5 pb-20"
          >
            <div className="size-[133px] rounded-full bg-[#e5e8eb] motion-safe:animate-pulse" />
            <div className="h-6 w-40 rounded bg-[#e5e8eb] motion-safe:animate-pulse" />
            <div className="h-10 w-52 rounded bg-[#e5e8eb] motion-safe:animate-pulse" />
          </div>
        ) : libraryError ? (
          <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4 px-5">
            <p role="alert" className="text-center text-sm text-[#4e5968]">
              {libraryError}
            </p>
            <button
              onClick={() => setReload((value) => value + 1)}
              className="rounded-full bg-white px-6 py-3 font-bold text-[#2f6bff]"
            >
              다시 시도
            </button>
          </div>
        ) : scripts.length === 0 && !editMode ? (
          <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4 overflow-y-auto px-5 pt-2 pb-20 text-center">
            <Image
              src="/figma/my-script/empty.png"
              alt=""
              width={133}
              height={133}
              priority
              className="shrink-0"
            />
            <div>
              <h2 className="text-[17px] leading-6 font-bold text-[#191f28]">
                아직 내 문장이 없어요
              </h2>
              <p className="mt-2 text-[14px] leading-5 font-medium tracking-[0.2px] text-[#8b95a1]">
                발표문이나 대본을 붙여넣고
                <br />
                나만의 연습 문장을 만들어요
              </p>
              <button
                className="mt-4 px-3 py-2 text-[13px] text-[#6b7684]"
                onClick={() => setStage("topics")}
              >
                주제 관리
              </button>
            </div>
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-5 pt-2 pb-24">
            <div
              className="mb-6 flex shrink-0 gap-2 overflow-x-auto"
              aria-label="주제 필터"
            >
              {[null, ...topicData.topics].map((name) => (
                <button
                  key={name ?? "all"}
                  type="button"
                  aria-pressed={libraryTopic === name}
                  onClick={() => {
                    setLibraryTopic(name);
                    setSelected([]);
                  }}
                  className={`shrink-0 rounded-full px-3.5 py-[7px] text-[13px] leading-[18px] ${libraryTopic === name ? "bg-[#2f6bff] text-white" : "bg-white text-[#4e5968]"}`}
                >
                  {name ?? "전체"}
                </button>
              ))}
              {!editMode && (
                <button
                  aria-label="주제 관리"
                  onClick={() => {
                    setSavedNotice(null);
                    setStage("topics");
                  }}
                  className="flex size-9 shrink-0 items-center justify-center rounded-full bg-white text-[#4e5968]"
                >
                  <Settings size={18} />
                </button>
              )}
            </div>
            {editMode && (
              <button
                disabled={!visibleScripts.length}
                role="checkbox"
                aria-checked={
                  visibleScripts.length > 0 &&
                  selected.length === visibleScripts.length
                }
                className="mb-4 flex w-full items-center gap-2 text-[13px] text-[#4e5968]"
                onClick={() =>
                  setSelected(
                    selected.length === visibleScripts.length
                      ? []
                      : visibleScripts.map((t) => String(t.id)),
                  )
                }
              >
                <span>전체 선택</span>
                <span className="ml-auto text-[#2f6bff]">
                  {selected.length > 0 ? `${selected.length}개 선택` : ""}
                </span>
                <span
                  className={`grid size-[22px] place-items-center rounded-full border ${visibleScripts.length > 0 && selected.length === visibleScripts.length ? "border-[#2f6bff] bg-[#2f6bff] text-white" : "border-[#d1d6db]"}`}
                >
                  {visibleScripts.length > 0 &&
                    selected.length === visibleScripts.length && (
                      <Check size={14} />
                    )}
                </span>
              </button>
            )}
            <div className="flex flex-1 flex-col gap-2.5">
              {visibleScripts.map((script) => (
                <button
                  key={script.id}
                  disabled={saving}
                  role={editMode ? "checkbox" : undefined}
                  aria-checked={
                    editMode ? selected.includes(String(script.id)) : undefined
                  }
                  onClick={() => {
                    if (editMode) {
                      const id = String(script.id);
                      setSelected((ids) =>
                        ids.includes(id)
                          ? ids.filter((x) => x !== id)
                          : [...ids, id],
                      );
                      return;
                    }
                    dismissSavedNotice();
                    void openScript(script.id);
                  }}
                  className="flex w-full items-center gap-3 rounded-[16px] bg-white py-4 pr-3.5 pl-[18px] text-left shadow-[0_2px_3px_rgba(26,33,48,0.05)] disabled:opacity-50"
                >
                  <span className="flex min-w-0 flex-1 flex-col items-start gap-1.5">
                    <span className="rounded-full bg-[#edf2ff] px-2 py-0.5 text-[11px] leading-[14px] font-bold text-[#2f6bff]">
                      {topicData.assignments[String(script.id)] ?? "미분류"}
                    </span>
                    <span className="break-words text-[15px] leading-[22px] font-bold text-[#191f28]">
                      {script.title}
                    </span>
                    <span className="text-[12px] leading-4 text-[#8b95a1]">
                      {script.sentenceCount != null
                        ? `${script.sentenceCount}문장`
                        : "문장 보기"}
                      {savedNotice?.content.id === script.id
                        ? " · 방금"
                        : script.createdAt
                          ? ` · ${new Date(script.createdAt).toLocaleDateString("ko-KR", { month: "long", day: "numeric" })}`
                          : ""}
                    </span>
                  </span>
                  {editMode ? (
                    <span
                      className={`grid size-[22px] shrink-0 place-items-center rounded-full border ${selected.includes(String(script.id)) ? "border-[#2f6bff] bg-[#2f6bff] text-white" : "border-[#d1d6db]"}`}
                    >
                      {selected.includes(String(script.id)) && (
                        <Check size={14} />
                      )}
                    </span>
                  ) : (
                    <Image
                      src="/figma/my-script/card-chevron.svg"
                      alt=""
                      width={20}
                      height={20}
                    />
                  )}
                </button>
              ))}
              {libraryTopic &&
                !scripts.some(
                  (script) =>
                    (topicData.assignments[String(script.id)] ?? "미분류") ===
                    libraryTopic,
                ) && (
                  <div className="flex flex-1 flex-col items-center justify-center gap-4 py-8 text-center">
                    <Image
                      src="/figma/my-script/empty.png"
                      alt=""
                      width={133}
                      height={133}
                      className="shrink-0"
                    />
                    <div>
                      <h2 className="text-[17px] leading-6 font-bold text-[#191f28]">
                        {libraryTopic} 주제에 문장이 없어요
                      </h2>
                      <p className="mt-2 text-[14px] leading-5 font-medium text-[#8b95a1]">
                        새 문장을 만들어 이 주제에 담아 보세요
                      </p>
                    </div>
                  </div>
                )}
            </div>
          </div>
        )}
        {editMode ? (
          <footer className="shrink-0 bg-white px-5 pt-3 pb-9">
            <button
              disabled={!selected.length || saving}
              className="h-14 w-full rounded-full bg-[#f04452] font-bold text-white disabled:bg-[#b8ccff]"
              onClick={() => {
                setSaveError(null);
                setDeleteIds([...selected]);
              }}
            >
              {selected.length ? `${selected.length}개 삭제하기` : "삭제하기"}
            </button>
          </footer>
        ) : (
          <footer className="pointer-events-none absolute right-5 bottom-4 left-5 z-20 flex flex-col items-end">
            {saveError && (
              <p role="alert" className="mb-3 text-sm text-red-600">
                {saveError}
              </p>
            )}
            <button
              type="button"
              disabled={libraryLoading || !!libraryError}
              onClick={() => {
                setSaveError(null);
                dismissSavedNotice();
                setTopic(libraryTopic ?? topicData.topics[0] ?? "미분류");
                setText("");
                setScriptTitle("");
                setEditingId(null);
                setStage("input");
              }}
              className="pointer-events-auto flex items-center gap-1.5 rounded-full bg-[#2f6bff] py-3.5 pr-5 pl-[18px] text-[15px] font-bold text-white shadow-[0_6px_8px_rgba(47,107,255,0.32)]"
            >
              <Image
                src="/figma/my-script/plus.svg"
                alt=""
                width={20}
                height={20}
              />
              내 문장 만들기
            </button>
          </footer>
        )}
        {deleteDialog}
        {savedNotice && (
          <ScriptSavedToast
            message={savedNotice.message}
            busy={saving}
            onDismiss={dismissSavedNotice}
            onPractice={() => {
              setContent(savedNotice.content);
              dismissSavedNotice();
              setStage("practice");
            }}
          />
        )}
      </AppShell>
    );
  }

  if (stage === "detail" && content) {
    const detailSentences = content.sentences?.length
      ? [...content.sentences]
          .sort((a, b) => a.sequenceNo - b.sequenceNo)
          .map((sentence) => sentence.text)
      : splitSentences(content.scriptText);
    return (
      <AppShell
        nav={false}
        viewportLocked
        chromeColor="#f2f4f6"
        bottomChromeColor="#ffffff"
        className="flex flex-col !bg-[#f2f4f6]"
      >
        <TopBar
          to="/my-script"
          title="연습하기"
          onBack={() => setStage("library")}
          right={
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label="더보기"
                  className="flex size-10 items-center justify-center"
                >
                  <Image
                    src="/figma/my-script/more.svg"
                    alt=""
                    width={24}
                    height={24}
                  />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onSelect={() => {
                    setEditingId(content.id);
                    setScriptTitle(content.title);
                    setText(content.scriptText);
                    setTopic(
                      topicData.assignments[String(content.id)] ?? "미분류",
                    );
                    setSaveError(null);
                    request.current = null;
                    setStage("input");
                  }}
                >
                  수정하기
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="text-[#f04452]"
                  onSelect={() => {
                    setSaveError(null);
                    setDeleteIds([String(content.id)]);
                  }}
                >
                  삭제하기
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={() => {
                    void navigator.clipboard.writeText(content.scriptText).then(
                      () => setCopyMessage("원고를 복사했어요"),
                      () =>
                        setCopyMessage(
                          "원고를 복사하지 못했어요. 다시 시도해 주세요.",
                        ),
                    );
                  }}
                >
                  원고 복사
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          }
        />
        <div className="flex min-h-0 flex-1 flex-col px-5 pt-3 pb-6">
          <h2 className="shrink-0 break-words text-[22px] leading-[30px] font-bold tracking-[-0.43px] text-[#191f28]">
            {content.title}
          </h2>
          <div className="mt-5 mb-2 flex shrink-0 items-center justify-between">
            <span className="text-[14px] leading-5 font-medium text-[#4e5968]">
              전체 문장
            </span>
            <p>
              <strong className="text-[16px] leading-6 text-[#2f6bff]">
                {detailSentences.length}
              </strong>
              <span className="text-[13px] text-[#4e5968]">문장</span>
            </p>
          </div>
          <SentenceReader
            variant="cards"
            sentences={detailSentences}
            className="flex-1"
          />
        </div>
        <footer className="shrink-0 border-t border-[#e5e8eb] bg-white px-5 pt-3 pb-9">
          {copyMessage && (
            <p
              role="status"
              className="mb-3 text-center text-sm text-[#4e5968]"
            >
              {copyMessage}
            </p>
          )}
          <button
            type="button"
            disabled={!detailSentences.length}
            onClick={() => {
              setTitle("연습하기");
              setStage("practice");
            }}
            className="h-14 w-full rounded-full bg-[#2f6bff] text-[16px] leading-6 font-bold text-white disabled:opacity-35"
          >
            연습 시작하기
          </button>
        </footer>
        {deleteDialog}
      </AppShell>
    );
  }

  if (stage === "practice" && content) {
    return (
      <AppShell
        nav={false}
        viewportLocked
        chromeColor="#f2f4f6"
        bottomChromeColor="#f2f4f6"
        className="flex flex-col !bg-[#f2f4f6]"
      >
        <TopBar to="/home" title={title} />
        <div className="min-h-0 flex-1 overflow-y-auto">
          <PracticeSession
            content={content}
            experienceLabel="내 문장"
            onTitleChange={setTitle}
          />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell
      nav={false}
      viewportLocked
      chromeColor="#f2f4f6"
      bottomChromeColor="#ffffff"
      className="flex flex-col !bg-[#f2f4f6]"
    >
      <TopBar
        to="/home"
        title={
          stage === "input"
            ? editingId
              ? "내 문장 수정"
              : "내 문장 만들기"
            : "내 문장"
        }
        onBack={() => {
          if (saving) return;
          if (stage === "confirm") setStage("input");
          else if (hasDraft) setExitOpen(true);
          else setStage("library");
        }}
      />

      {stage === "input" ? (
        <main className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 pt-2 pb-5">
          <div>
            <label
              htmlFor="script-title"
              className="mb-2 block text-[14px] leading-5 font-bold text-[#191f28]"
            >
              제목
            </label>
            <input
              id="script-title"
              maxLength={100}
              value={scriptTitle}
              onChange={(event) => setScriptTitle(event.target.value)}
              placeholder="예) 3분기 성과 발표 오프닝"
              className="w-full rounded-[12px] bg-white px-4 py-3.5 text-[15px] leading-[22px] text-[#191f28] outline-none placeholder:text-[#b0b8c1] focus:ring-2 focus:ring-[#2f6bff]"
            />
          </div>
          <ScriptTopicPicker
            value={topic}
            topics={topicData.topics}
            counts={topicCounts}
            onChange={setTopic}
            onCreate={createTopic}
          />
          <div>
            <div className="mb-2 flex items-center justify-between gap-1">
              <label
                htmlFor="custom-script"
                className="text-[14px] leading-5 font-bold text-[#191f28]"
              >
                원고
              </label>
              <span
                id="custom-script-count"
                className={`text-[12px] leading-4 ${tooLong ? "text-[#f04452]" : "text-[#8b95a1]"}`}
              >
                {characterCount}/{CUSTOM_SCRIPT_LIMIT}
              </span>
            </div>
            <ScriptTextInput
              value={text}
              onChange={setText}
              limit={CUSTOM_SCRIPT_LIMIT}
            />
            <p
              id="custom-script-help"
              role={tooLong ? "alert" : undefined}
              className={`mt-2 text-[12px] leading-4 ${tooLong ? "text-[#f04452]" : "text-[#6b7684]"}`}
            >
              {tooLong
                ? "300자까지 입력할 수 있어요"
                : "문장 단위로 나눠서 연습해요"}
            </p>
          </div>
        </main>
      ) : (
        <main className="flex min-h-0 flex-1 flex-col overflow-hidden px-5 pt-3 pb-4">
          <h2 className="text-[22px] leading-[30px] font-bold tracking-[-0.43px] text-[#191f28]">
            이렇게 나눠서 연습할게요
          </h2>
          <div className="mt-5 flex shrink-0 items-center">
            <p className="text-[14px] leading-5 font-medium text-[#4e5968]">
              전체 문장
            </p>
            <p className="ml-auto">
              <strong className="text-[16px] leading-6 text-[#2f6bff]">
                {sentences.length}
              </strong>
              <span className="ml-0.5 text-[13px] leading-[18px] font-medium text-[#4e5968]">
                문장
              </span>
            </p>
          </div>
          <SentenceReader
            variant="cards"
            sentences={sentences}
            className="mt-2 flex-1"
          />
        </main>
      )}

      <footer className="shrink-0 bg-white px-5 pt-3 pb-9">
        {saveError && (
          <p role="alert" className="mb-3 text-sm text-red-600">
            {saveError}
          </p>
        )}
        {stage === "input" ? (
          <button
            type="button"
            disabled={!scriptTitle.trim() || !text.trim() || tooLong || saving}
            onClick={() => setStage("confirm")}
            className="h-14 w-full rounded-full bg-[#2f6bff] text-[16px] leading-6 font-bold text-white disabled:opacity-35"
          >
            문장 나누기
          </button>
        ) : (
          <div className="flex gap-2" aria-busy={saving}>
            <button
              type="button"
              disabled={
                !scriptTitle.trim() || !text.trim() || tooLong || saving
              }
              onClick={() => void saveScript()}
              className="h-14 min-w-0 flex-[2] rounded-full border border-[#e5e8eb] bg-white text-[16px] leading-6 font-bold text-[#191f28] disabled:opacity-35"
            >
              {saving ? "저장 중…" : "저장하기"}
            </button>
            <button
              type="button"
              disabled={
                !scriptTitle.trim() || !text.trim() || tooLong || saving
              }
              onClick={() => void saveScript(true)}
              className="h-14 min-w-0 flex-[3] rounded-full bg-[#2f6bff] text-[16px] leading-6 font-bold text-white disabled:opacity-35"
            >
              바로 연습하기
            </button>
          </div>
        )}
      </footer>
      <Dialog.Root open={exitOpen} onOpenChange={setExitOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className={topicStyles.overlay} />
          <Dialog.Content
            className={topicStyles.modal}
            style={{ top: "50%" }}
            onCloseAutoFocus={(event) => {
              event.preventDefault();
              document.getElementById("custom-script")?.focus();
            }}
          >
            <Dialog.Title className={topicStyles.modalTitle}>
              작성을 그만둘까요?
            </Dialog.Title>
            <Dialog.Description className={topicStyles.description}>
              입력한 내용은 저장되지 않아요
            </Dialog.Description>
            <div className={topicStyles.actions}>
              <button type="button" onClick={discardDraft}>
                그만두기
              </button>
              <button
                type="submit"
                autoFocus
                onClick={() => setExitOpen(false)}
              >
                계속 작성
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </AppShell>
  );
}
