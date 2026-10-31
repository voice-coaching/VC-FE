"use client";

import Image from "next/image";
import type { DetailedOption } from "@/lib/onboarding-options";

type ChoiceProps = {
  selected: boolean;
  onClick: () => void;
  disabled?: boolean;
  assetSet?: "onboarding" | "mypage-plan";
};

function SelectionMark({
  assetSet = "onboarding",
}: Pick<ChoiceProps, "assetSet">) {
  return (
    <span className="onboarding-check-pop flex size-6 shrink-0 items-center justify-center rounded-full bg-[#2f6bff]">
      <Image
        src={`/figma/${assetSet}/check.svg`}
        alt=""
        width={14}
        height={14}
        aria-hidden="true"
      />
    </span>
  );
}

const choiceClass = (selected: boolean) =>
  `flex w-full touch-manipulation items-center gap-3.5 rounded-2xl border-2 px-[18px] py-3.5 text-left transition-[transform,background-color,border-color] duration-200 ease-out active:scale-[0.985] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2f6bff] disabled:opacity-60 ${selected ? "border-[#2f6bff] bg-[#f1f5ff]" : "border-transparent bg-[#f7f8fa]"}`;

export function DetailedCard<T extends string>({
  option,
  selected,
  onClick,
  disabled,
  assetSet = "onboarding",
}: ChoiceProps & { option: DetailedOption<T> }) {
  const icon = option.icon?.replace(
    "/figma/onboarding/",
    `/figma/${assetSet}/`,
  );
  const dimensions =
    option.value === "broadcast"
      ? [15, 35]
      : option.value === "interview"
        ? [27, 27]
        : option.value === "presentation"
          ? [31, 25]
          : [33, 25];
  return (
    <button
      type="button"
      aria-pressed={selected}
      disabled={disabled}
      onClick={onClick}
      className={`${choiceClass(selected)} min-h-[75px]`}
    >
      {icon && (
        <span className="flex size-[35px] shrink-0 items-center justify-center overflow-hidden rounded-xl">
          <Image
            src={icon}
            alt=""
            width={dimensions[0]}
            height={dimensions[1]}
            aria-hidden="true"
            className={option.iconClassName}
          />
        </span>
      )}
      <span className="flex min-w-0 flex-1 flex-col gap-[3px]">
        <span className="text-[15px] leading-[22px] font-medium tracking-[0.144px] text-[#191f28]">
          {option.title}
        </span>
        <span className="text-[13px] leading-[18px] tracking-[0.2522px] text-[#4e5968]">
          {option.description}
        </span>
      </span>
      {selected && <SelectionMark assetSet={assetSet} />}
    </button>
  );
}

export function CompactCard({
  title,
  selected,
  onClick,
  disabled,
  assetSet,
}: ChoiceProps & { title: string }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      disabled={disabled}
      onClick={onClick}
      className={`${choiceClass(selected)} min-h-[54px]`}
    >
      <span className="min-w-0 flex-1 text-[15px] leading-[22px] font-medium tracking-[0.144px] text-[#191f28]">
        {title}
      </span>
      {selected && <SelectionMark assetSet={assetSet} />}
    </button>
  );
}
