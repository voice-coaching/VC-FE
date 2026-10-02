"use client";

import * as Dialog from "@radix-ui/react-dialog";
import Image from "next/image";
import { ChevronRight } from "lucide-react";
import { useRef, useState } from "react";
import { NavigationIcon } from "@/components/navigation-icon";
import {
  planFields,
  planKey,
  planOptions,
  selectedPlanOptions,
  type PracticePlan,
} from "@/lib/practice-plan";
import styles from "./practice-plan-editor.module.css";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const titles: Record<keyof PracticePlan, string> = {
  goal: "무엇을 위해 연습하고 싶나요?",
  focus: "어떤 점을 개선하고 싶나요?",
  schedule: "일주일에 며칠 정도 연습할까요?",
  method: "어떤 방식으로 연습하고 싶나요?",
};
const cta =
  "h-14 w-full shrink-0 rounded-full bg-[#2f6bff] text-base font-bold text-white disabled:bg-[#f2f4f6] disabled:text-[#b0b8c1]";

export function PracticePlanEditor({
  plan,
  onSave,
  onBack,
}: {
  plan: PracticePlan;
  onSave: (plan: PracticePlan) => void;
  onBack: () => void;
}) {
  const [draft, setDraft] = useState(plan);
  const [field, setField] = useState<keyof PracticePlan>("goal");
  const [open, setOpen] = useState(false);
  const [selection, setSelection] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [confirmLeave, setConfirmLeave] = useState(false);
  const activeTrigger = useRef<HTMLButtonElement | null>(null);
  const multiple = field === "focus" || field === "method";
  // Retain custom text entered with the previous free-text editor.
  const choices = [...planOptions[field]];
  for (const value of selectedPlanOptions(field, draft[field])) {
    if (!choices.some((option) => option.value === value)) {
      choices.push({ value, title: value });
    }
  }

  function save() {
    try {
      localStorage.setItem(planKey, JSON.stringify(draft));
      onSave(draft);
    } catch {
      setError("계획을 저장하지 못했어요. 다시 시도해 주세요.");
    }
  }

  return (
    <section className="relative flex h-full flex-col bg-white text-[#191f28]">
      <div className="h-11 shrink-0" aria-hidden="true" />
      <header className="flex h-12 shrink-0 items-center px-2">
        <button
          type="button"
          aria-label="연습 계획으로 돌아가기"
          className="flex size-11 items-center justify-center"
          onClick={() => {
            const changed = planFields.some(
              ([key]) => draft[key] !== plan[key],
            );
            if (!changed) onBack();
            else setConfirmLeave(true);
          }}
        >
          <NavigationIcon />
        </button>
        <h1 className="flex-1 text-center text-[17px] font-bold">
          연습 계획 수정
        </h1>
        <span className="size-11" aria-hidden="true" />
      </header>
      <Dialog.Root open={open} onOpenChange={setOpen}>
        <main className="min-h-0 flex-1 overflow-y-auto px-6 pt-[34px] pb-5">
          <h2 className="text-2xl leading-8 font-bold tracking-[-0.55px]">
            연습 계획을
            <br />
            바꿔볼까요?
          </h2>
          <div className="mt-[34px] divide-y divide-[#f2f4f6]">
            {planFields.map(([key, label]) => (
              <Dialog.Trigger key={key} asChild>
                <button
                  type="button"
                  className="flex min-h-16 w-full items-center gap-3 py-5 text-left"
                  onClick={(event) => {
                    activeTrigger.current = event.currentTarget;
                    setField(key);
                    setSelection(selectedPlanOptions(key, draft[key]));
                  }}
                >
                  <span className="w-[72px] shrink-0 text-sm text-[#4e5968]">
                    {label}
                  </span>
                  <span className="min-w-0 flex-1 text-right text-base leading-6 font-medium break-keep">
                    {draft[key]}
                  </span>
                  <ChevronRight
                    size={16}
                    className="shrink-0 text-[#8b95a1]"
                    aria-hidden="true"
                  />
                </button>
              </Dialog.Trigger>
            ))}
          </div>
        </main>
        <footer className="shrink-0 px-6 pt-3 pb-[58px]">
          {error && (
            <p role="alert" className="mb-3 text-sm text-red-600">
              {error}
            </p>
          )}
          <button type="button" onClick={save} className={cta}>
            저장하기
          </button>
        </footer>
        <Dialog.Overlay
          className={`absolute inset-0 z-30 bg-[#191f28]/45 ${styles.scrim}`}
        />
        <Dialog.Content
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            activeTrigger.current?.focus();
          }}
          aria-describedby={multiple ? "plan-choice-hint" : undefined}
          className={`absolute inset-x-0 bottom-0 z-40 flex max-h-[90%] flex-col rounded-t-3xl bg-white px-6 pt-3 pb-[34px] outline-none ${styles.sheet}`}
        >
          <div
            className="mx-auto mb-5 h-1 w-10 shrink-0 rounded-full bg-[#e5e8eb]"
            aria-hidden="true"
          />
          <Dialog.Title className="shrink-0 text-xl leading-7 font-bold">
            {titles[field]}
          </Dialog.Title>
          {multiple && (
            <Dialog.Description
              id="plan-choice-hint"
              className="mt-1 text-[13px] text-[#6b7684]"
            >
              {field === "focus"
                ? "최대 3개까지 고를 수 있어요"
                : "여러 개를 골라도 돼요"}
            </Dialog.Description>
          )}
          <div className="mt-5 min-h-0 space-y-2.5 overflow-y-auto overscroll-contain">
            {choices.map((option) => {
              const selected = selection.includes(option.value);
              const atLimit =
                field === "focus" && selection.length >= 3 && !selected;
              return (
                <label
                  key={option.value}
                  className={`relative flex min-h-[74px] cursor-pointer items-center gap-3.5 rounded-2xl border-2 px-4 py-3.5 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[#2f6bff] ${selected ? "border-[#2f6bff] bg-[#f1f5ff]" : "border-transparent bg-[#f7f8fa]"} ${atLimit ? "opacity-50" : ""}`}
                >
                  <input
                    className="sr-only"
                    type={multiple ? "checkbox" : "radio"}
                    name={`plan-${field}`}
                    value={option.value}
                    checked={selected}
                    disabled={atLimit}
                    onChange={() =>
                      setSelection((previous) =>
                        multiple
                          ? previous.includes(option.value)
                            ? previous.filter((value) => value !== option.value)
                            : [...previous, option.value]
                          : [option.value],
                      )
                    }
                  />
                  {option.icon && (
                    <span className="flex size-[35px] shrink-0 items-center justify-center">
                      <Image
                        src={option.icon}
                        alt=""
                        width={35}
                        height={35}
                        className={option.iconClassName}
                      />
                    </span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15px] leading-[22px] font-medium break-keep">
                      {option.title}
                    </span>
                    {option.description && (
                      <span className="mt-[3px] block text-[13px] leading-[18px] break-keep text-[#4e5968]">
                        {option.description}
                      </span>
                    )}
                  </span>
                  {selected && (
                    <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-[#2f6bff]">
                      <Image
                        src="/figma/onboarding/check.svg"
                        alt=""
                        width={14}
                        height={14}
                      />
                    </span>
                  )}
                </label>
              );
            })}
          </div>
          <button
            type="button"
            className={`mt-6 ${cta}`}
            disabled={selection.length === 0}
            onClick={() => {
              setDraft((previous) => ({
                ...previous,
                [field]: selection.join(", "),
              }));
              setOpen(false);
              setError("");
            }}
          >
            변경 저장
          </button>
        </Dialog.Content>
      </Dialog.Root>
      <AlertDialog open={confirmLeave} onOpenChange={setConfirmLeave}>
        <AlertDialogContent className="w-[calc(100%-40px)] max-w-[362px] rounded-[24px] border-0">
          <AlertDialogHeader>
            <AlertDialogTitle>수정을 그만할까요?</AlertDialogTitle>
            <AlertDialogDescription>
              변경한 연습 계획은 저장되지 않아요.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-2 grid grid-cols-2 gap-2 space-x-0">
            <AlertDialogCancel className="mt-0 min-h-12 rounded-full">
              계속 수정
            </AlertDialogCancel>
            <AlertDialogAction
              className="min-h-12 rounded-full bg-[#2f6bff] text-white"
              onClick={onBack}
            >
              나가기
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
