"use client";

import Image from "next/image";
import { Suspense, useEffect, useRef } from "react";
import { Check, ChevronDown, X } from "lucide-react";
import type { Difficulty } from "@/lib/api";
import { useHistoryPanel } from "@/hooks/use-history-panel";

type Props = {
  variant?: "default" | "news";
  value: Difficulty | "";
  options: Array<{ value: Difficulty | ""; label: string }>;
  onChange: (value: Difficulty | "") => void;
};

const newsTriggerClass =
  "flex min-h-[30px] shrink-0 items-center gap-0.5 text-[13px] leading-[18px] font-medium text-[#4e5968]";

function triggerLabel(
  value: Difficulty | "",
  options: Props["options"],
  variant: Props["variant"],
) {
  if (variant === "news" && !value) return "모든 난이도";
  return options.find((option) => option.value === value)?.label;
}

const triggerClass =
  "flex min-h-11 items-center gap-1 rounded-full border border-[#e5e8eb] bg-white px-3 text-[13px] font-medium text-[#6b7684]";

export function CatalogDifficultyPicker(props: Props) {
  return (
    <Suspense
      fallback={
        <button
          type="button"
          disabled
          className={props.variant === "news" ? newsTriggerClass : triggerClass}
        >
          {triggerLabel(props.value, props.options, props.variant)}
          <ChevronDown className="size-4" />
        </button>
      }
    >
      <DifficultyPicker {...props} />
    </Suspense>
  );
}

function DifficultyPicker({ value, options, onChange, variant }: Props) {
  const [panel, setPanel] = useHistoryPanel("panel", ["difficulty"] as const);
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const open = panel === "difficulty";

  // Shared sheet motion: slide up on open, play the exit before closing.
  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (open) {
      element.removeAttribute("data-closing");
      if (!element.open) element.showModal();
      return;
    }
    if (!element.open) return;
    const finish = () => {
      element.removeAttribute("data-closing");
      element.close();
      trigger.current?.focus({ preventScroll: true });
    };
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      finish();
      return;
    }
    element.setAttribute("data-closing", "");
    const timer = window.setTimeout(finish, 260);
    return () => window.clearTimeout(timer);
  }, [open]);

  return (
    <>
      <button
        ref={trigger}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={
          variant === "news" && !value ? "모든 난이도 선택" : undefined
        }
        onClick={() => setPanel("difficulty")}
        className={variant === "news" ? newsTriggerClass : triggerClass}
      >
        {triggerLabel(value, options, variant)}
        {variant === "news" ? (
          <Image
            src="/figma/news-screen7/down.svg"
            alt=""
            width={16}
            height={16}
          />
        ) : (
          <ChevronDown className="size-4" />
        )}
      </button>
      <dialog
        ref={dialog}
        aria-labelledby="difficulty-title"
        onCancel={(event) => {
          event.preventDefault();
          setPanel(null);
        }}
        onClick={(event) => {
          if (event.target !== event.currentTarget) return;
          const bounds = event.currentTarget.getBoundingClientRect();
          if (
            event.clientX < bounds.left ||
            event.clientX > bounds.right ||
            event.clientY < bounds.top ||
            event.clientY > bounds.bottom
          )
            setPanel(null);
        }}
        className={`app-sheet fixed inset-x-0 top-auto bottom-0 m-0 mx-auto max-h-[85dvh] w-full max-w-[402px] overflow-y-auto overscroll-contain bg-white text-[#191f28] backdrop:bg-black/40 ${variant === "news" ? "rounded-t-[20px] px-4 pt-3 pb-[max(34px,env(safe-area-inset-bottom,0px))]" : "rounded-t-[28px] px-5 pt-5 pb-[max(28px,env(safe-area-inset-bottom,0px))]"}`}
      >
        {variant === "news" ? (
          <>
            <span className="mx-auto block h-1 w-9 rounded-full bg-[#d1d6db]" />
            <h2
              id="difficulty-title"
              className="mt-4 mb-3 px-1 text-lg leading-[26px] font-bold"
            >
              난이도 선택
            </h2>
            <div className="flex flex-col gap-1">
              {options.map((option) => (
                <button
                  key={option.value || "all"}
                  type="button"
                  aria-pressed={value === option.value}
                  onClick={() => {
                    onChange(option.value);
                    setPanel(null);
                  }}
                  className={`flex w-full items-center gap-3 rounded-xl px-4 py-3.5 text-left ${value === option.value ? "bg-[#f2f4f6]" : "bg-white"}`}
                >
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span
                      className={`text-[15px] leading-[22px] ${value === option.value ? "font-bold" : "font-medium"}`}
                    >
                      {option.label}
                    </span>
                    <span className="text-[13px] leading-[18px] font-medium text-[#8b95a1]">
                      {
                        {
                          "": "모든 뉴스를 보여줘요",
                          BEGINNER: "짧고 쉬운 문장",
                          INTERMEDIATE: "일상 뉴스 길이의 문장",
                          ADVANCED: "전문 용어가 섞인 긴 문장",
                        }[option.value]
                      }
                    </span>
                  </span>
                  <span
                    className={`flex size-[26px] shrink-0 items-center justify-center rounded-full ${value === option.value ? "bg-[#6346f6]" : "border-[1.5px] border-[#d1d6db]"}`}
                  >
                    {value === option.value && (
                      <Image
                        src="/figma/news-screen7/check.svg"
                        alt=""
                        width={18}
                        height={18}
                      />
                    )}
                  </span>
                </button>
              ))}
            </div>
          </>
        ) : (
          <>
            {" "}
            <div className="flex items-center justify-between">
              <h2 id="difficulty-title" className="text-lg font-bold">
                난이도
              </h2>
              <button
                type="button"
                onClick={() => setPanel(null)}
                aria-label="닫기"
                className="flex size-11 items-center justify-center"
              >
                <X className="size-5" />
              </button>
            </div>
            <div className="mt-2">
              {options.map((option) => (
                <button
                  key={option.value || "all"}
                  type="button"
                  aria-pressed={value === option.value}
                  onClick={() => {
                    onChange(option.value);
                    setPanel(null);
                  }}
                  className="flex min-h-14 w-full items-center justify-between gap-2 border-b border-[#f2f4f6] text-left text-[15px] font-medium [overflow-wrap:anywhere]"
                >
                  {option.label}
                  {value === option.value ? (
                    <Check className="size-5 shrink-0 text-primary" />
                  ) : null}
                </button>
              ))}
            </div>
          </>
        )}
      </dialog>
    </>
  );
}
