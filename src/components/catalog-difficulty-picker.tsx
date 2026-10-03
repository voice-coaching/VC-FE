"use client";

import { Suspense, useEffect, useRef } from "react";
import { Check, ChevronDown, X } from "lucide-react";
import type { Difficulty } from "@/lib/api";
import { useHistoryPanel } from "@/hooks/use-history-panel";

type Props = {
  value: Difficulty | "";
  options: Array<{ value: Difficulty | ""; label: string }>;
  onChange: (value: Difficulty | "") => void;
};

const triggerClass =
  "flex min-h-11 items-center gap-1 rounded-full border border-[#e5e8eb] bg-white px-3 text-[13px] font-medium text-[#6b7684]";

export function CatalogDifficultyPicker(props: Props) {
  return (
    <Suspense
      fallback={
        <button type="button" disabled className={triggerClass}>
          {props.options.find((option) => option.value === props.value)?.label}
          <ChevronDown className="size-4" />
        </button>
      }
    >
      <DifficultyPicker {...props} />
    </Suspense>
  );
}

function DifficultyPicker({ value, options, onChange }: Props) {
  const [panel, setPanel] = useHistoryPanel("panel", ["difficulty"] as const);
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const open = panel === "difficulty";

  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (open) {
      if (!element.open) element.showModal();
    } else if (element.open) {
      element.close();
      trigger.current?.focus({ preventScroll: true });
    }
  }, [open]);

  return (
    <>
      <button
        ref={trigger}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setPanel("difficulty")}
        className={triggerClass}
      >
        {options.find((option) => option.value === value)?.label}
        <ChevronDown className="size-4" />
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
        className="fixed inset-x-0 top-auto bottom-0 m-0 mx-auto max-h-[85dvh] w-full max-w-[402px] overflow-y-auto overscroll-contain rounded-t-[28px] bg-white px-5 pt-5 pb-[max(28px,env(safe-area-inset-bottom,0px))] text-[#191f28] backdrop:bg-black/35"
      >
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
      </dialog>
    </>
  );
}
