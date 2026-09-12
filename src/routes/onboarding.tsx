"use client";
import { NavigationIcon } from "@/components/navigation-icon";

import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { IPhoneFrame } from "@/components/iphone-frame";
import { api } from "@/lib/api";
import type { Goal } from "@/lib/app-data";
import { useProfile } from "@/lib/use-profile";

import {
  PURPOSE_OPTIONS,
  IMPROVEMENT_OPTIONS,
  SCHEDULE_OPTIONS,
  METHOD_OPTIONS,
  type ScheduleId,
  type EditSection,
  type DetailedOption,
} from "@/lib/onboarding-options";

export default function Onboarding() {
  const router = useRouter();
  const { save } = useProfile({ loadExisting: false });
  const [step, setStep] = useState(1);
  const [transitionDirection, setTransitionDirection] = useState<
    "forward" | "back"
  >("forward");
  const [purpose, setPurpose] = useState<Goal | null>(null);
  const [improvements, setImprovements] = useState<string[]>([]);
  const [schedule, setSchedule] = useState<ScheduleId | null>(null);
  const [methods, setMethods] = useState<string[]>([]);
  const [name, setName] = useState("사용자");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editSection, setEditSection] = useState<EditSection | null>(null);
  const [sheetClosing, setSheetClosing] = useState(false);
  const sheetCloseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [draftPurpose, setDraftPurpose] = useState<Goal | null>(null);
  const [draftImprovements, setDraftImprovements] = useState<string[]>([]);
  const [draftSchedule, setDraftSchedule] = useState<ScheduleId | null>(null);
  const [draftMethods, setDraftMethods] = useState<string[]>([]);

  useEffect(() => {
    let active = true;
    api.users
      .getMe()
      .then((user) => {
        if (active && user.nickname.trim()) setName(user.nickname);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  useEffect(
    () => () => {
      if (sheetCloseTimer.current) clearTimeout(sheetCloseTimer.current);
    },
    [],
  );

  const toggleImprovement = (
    value: string,
    current: string[],
    update: (next: string[]) => void,
  ) => {
    if (current.includes(value)) {
      update(current.filter((item) => item !== value));
      return;
    }
    if (current.length < 3) update([...current, value]);
  };

  const toggleMethod = (
    value: string,
    current: string[],
    update: (next: string[]) => void,
  ) =>
    update(
      current.includes(value)
        ? current.filter((item) => item !== value)
        : [...current, value],
    );

  const goBack = () => {
    if (step === 1) router.replace("/terms/complete");
    else {
      setTransitionDirection("back");
      setStep((current) => current - 1);
    }
  };

  const openEditor = (section: EditSection) => {
    if (sheetCloseTimer.current) clearTimeout(sheetCloseTimer.current);
    setDraftPurpose(purpose);
    setDraftImprovements(improvements);
    setDraftSchedule(schedule);
    setDraftMethods(methods);
    setSheetClosing(false);
    setEditSection(section);
  };

  const closeEditor = () => {
    if (sheetClosing) return;
    setSheetClosing(true);
    sheetCloseTimer.current = setTimeout(() => {
      setEditSection(null);
      setSheetClosing(false);
      sheetCloseTimer.current = null;
    }, 240);
  };

  const saveEditor = () => {
    if (editSection === "purpose" && draftPurpose) setPurpose(draftPurpose);
    if (editSection === "improvements" && draftImprovements.length)
      setImprovements(draftImprovements);
    if (editSection === "schedule" && draftSchedule) setSchedule(draftSchedule);
    if (editSection === "methods" && draftMethods.length)
      setMethods(draftMethods);
    closeEditor();
  };

  const goNext = () => {
    setTransitionDirection("forward");
    setStep((current) => current + 1);
  };

  const finishOnboarding = async () => {
    if (!purpose || !schedule || !improvements.length || !methods.length)
      return;

    setSaving(true);
    setError(null);
    try {
      const scheduleOption = SCHEDULE_OPTIONS.find(
        (option) => option.value === schedule,
      )!;
      const purposeOption = PURPOSE_OPTIONS.find(
        (option) => option.value === purpose,
      )!;

      await save({
        name: name.trim() || "사용자",
        goals: [purpose],
        improvementAreas: improvements,
        pronunciationConcerns: improvements,
        learningSituations: methods,
        audioAccessPreference: null,
        level: "beginner",
        minutesPerDay: 5,
        weeklySessions: scheduleOption.weeklySessions,
        goalDescription: purposeOption.title,
      });
      router.replace("/home");
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "온보딩 정보를 저장하지 못했습니다.",
      );
    } finally {
      setSaving(false);
    }
  };

  const isNextEnabled =
    (step === 1 && purpose !== null) ||
    (step === 2 && improvements.length > 0) ||
    (step === 3 && schedule !== null) ||
    (step === 4 && methods.length > 0) ||
    step === 5;

  return (
    <IPhoneFrame>
      <section
        className="relative flex h-full flex-col bg-white"
        aria-label="온보딩"
      >
        <div className="h-11 shrink-0" aria-hidden="true" />
        <ProgressHeader step={step} onBack={goBack} />

        {step === 1 && (
          <QuestionScreen
            title="무엇을 위해 연습하고 싶나요?"
            subtitle="지금 가장 중요한 목적 하나를 골라주세요"
            direction={transitionDirection}
          >
            {PURPOSE_OPTIONS.map((option) => (
              <DetailedCard
                key={option.value}
                option={option}
                selected={purpose === option.value}
                onClick={() => setPurpose(option.value)}
              />
            ))}
          </QuestionScreen>
        )}

        {step === 2 && (
          <QuestionScreen
            title="어떤 점을 개선하고 싶나요?"
            subtitle="가장 신경 쓰이는 항목을 최대 3개 골라주세요"
            direction={transitionDirection}
          >
            {IMPROVEMENT_OPTIONS.map((option) => (
              <CompactCard
                key={option.value}
                title={option.value}
                selected={improvements.includes(option.value)}
                onClick={() =>
                  toggleImprovement(option.value, improvements, setImprovements)
                }
              />
            ))}
          </QuestionScreen>
        )}

        {step === 3 && (
          <QuestionScreen
            title="일주일에 며칠 정도 연습할까요?"
            subtitle="부담 없이 지킬 수 있는 횟수를 골라주세요"
            direction={transitionDirection}
          >
            {SCHEDULE_OPTIONS.map((option) => (
              <DetailedCard
                key={option.value}
                option={option}
                selected={schedule === option.value}
                onClick={() => setSchedule(option.value)}
              />
            ))}
          </QuestionScreen>
        )}

        {step === 4 && (
          <QuestionScreen
            title="어떤 방식으로 연습하고 싶나요?"
            subtitle="관심 있는 방식을 모두 골라주세요"
            direction={transitionDirection}
          >
            {METHOD_OPTIONS.map((option) => (
              <DetailedCard
                key={option.value}
                option={option}
                selected={methods.includes(option.value)}
                onClick={() => toggleMethod(option.value, methods, setMethods)}
              />
            ))}
          </QuestionScreen>
        )}

        {step === 5 && purpose && schedule && (
          <PlanScreen
            purpose={purpose}
            improvements={improvements}
            schedule={schedule}
            methods={methods}
            onEdit={openEditor}
            direction={transitionDirection}
          />
        )}

        <footer className="shrink-0 bg-white px-6 pt-3 pb-6">
          <button
            type="button"
            disabled={!isNextEnabled || saving}
            onClick={() => {
              if (step < 5) goNext();
              else void finishOnboarding();
            }}
            className="flex h-14 w-full touch-manipulation items-center justify-center rounded-full bg-[#2f6bff] px-7 text-[16px] leading-6 font-bold tracking-[0.0912px] text-white transition-[transform,background-color,color,filter] duration-150 ease-out active:scale-[0.985] active:brightness-[0.97] disabled:bg-[#f2f4f6] disabled:text-[#b0b8c1] disabled:active:scale-100 disabled:active:brightness-100"
          >
            {saving ? "저장 중…" : step === 5 ? "이대로 시작하기" : "다음"}
          </button>
          {error && (
            <p role="alert" className="mt-2 text-center text-xs text-[#ed2939]">
              {error}
            </p>
          )}
        </footer>
        <div className="h-[34px] shrink-0 bg-white" aria-hidden="true" />

        {editSection && (
          <EditBottomSheet
            section={editSection}
            closing={sheetClosing}
            purpose={draftPurpose}
            improvements={draftImprovements}
            schedule={draftSchedule}
            methods={draftMethods}
            onPurpose={setDraftPurpose}
            onImprovement={(value) =>
              toggleImprovement(value, draftImprovements, setDraftImprovements)
            }
            onSchedule={setDraftSchedule}
            onMethod={(value) =>
              toggleMethod(value, draftMethods, setDraftMethods)
            }
            onClose={closeEditor}
            onSave={saveEditor}
          />
        )}
      </section>
    </IPhoneFrame>
  );
}

function ProgressHeader({
  step,
  onBack,
}: {
  step: number;
  onBack: () => void;
}) {
  return (
    <header className="flex shrink-0 items-center gap-3 py-3 pr-5 pl-4">
      <button
        type="button"
        onClick={onBack}
        aria-label="이전 화면으로 돌아가기"
        className="flex size-6 shrink-0 touch-manipulation items-center justify-center rounded transition-transform duration-150 ease-out active:scale-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2f6bff]"
      >
        <NavigationIcon />
      </button>
      <div
        className="flex h-2 w-[282px] shrink-0 gap-[5px]"
        aria-label={`${step}/5 단계`}
      >
        {Array.from({ length: 5 }).map((_, index) => (
          <span
            key={index}
            className={`h-2 w-[52.4px] rounded transition-[background-color,transform] duration-300 ease-out ${
              index < step ? "bg-[#2f6bff]" : "bg-[#e6e9ed]"
            }`}
          />
        ))}
      </div>
      <p className="h-5 w-9 shrink-0 text-right text-[13px] leading-[18px] font-bold tracking-[0.2522px] text-[#2f6bff]">
        {step}
        <span className="text-[12px] leading-4 font-medium tracking-[0.3024px] text-[#8b95a1]">
          /5
        </span>
      </p>
    </header>
  );
}

function QuestionScreen({
  title,
  subtitle,
  children,
  direction,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
  direction: "forward" | "back";
}) {
  return (
    <div
      className={`min-h-0 flex-1 overflow-hidden ${
        direction === "forward"
          ? "onboarding-step-enter-forward"
          : "onboarding-step-enter-back"
      }`}
    >
      <div className="flex flex-col px-6 pb-6">
        <div className="h-[34px] shrink-0" aria-hidden="true" />
        <h1 className="text-[24px] leading-8 font-bold tracking-[-0.552px] text-[#191f28]">
          {title}
        </h1>
        <p className="mt-2 text-[14px] leading-5 tracking-[0.203px] text-[#4e5968]">
          {subtitle}
        </p>
        <div className="mt-[26px] flex flex-col gap-2.5">{children}</div>
      </div>
    </div>
  );
}

function SelectionMark() {
  return (
    <span className="onboarding-check-pop flex size-6 shrink-0 items-center justify-center rounded-full bg-[#2f6bff]">
      <Image
        src="/figma/onboarding/check.svg"
        alt=""
        width={14}
        height={14}
        aria-hidden="true"
      />
    </span>
  );
}

function DetailedCard<T extends string>({
  option,
  selected,
  onClick,
}: {
  option: DetailedOption<T>;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={`flex min-h-[75px] w-full touch-manipulation items-center gap-3.5 rounded-2xl border-2 px-[18px] py-3.5 text-left transition-[transform,background-color,border-color] duration-200 ease-out active:scale-[0.985] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2f6bff] ${
        selected
          ? "border-[#2f6bff] bg-[#f1f5ff]"
          : "border-transparent bg-[#f7f8fa]"
      }`}
    >
      {option.icon && (
        <span className="flex size-[35px] shrink-0 items-center justify-center overflow-hidden rounded-xl">
          <Image
            src={option.icon}
            alt=""
            width={35}
            height={35}
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
      {selected && <SelectionMark />}
    </button>
  );
}

function CompactCard({
  title,
  selected,
  onClick,
}: {
  title: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={`flex min-h-[54px] w-full touch-manipulation items-center gap-3.5 rounded-2xl border-2 px-[18px] py-3.5 text-left transition-[transform,background-color,border-color] duration-200 ease-out active:scale-[0.985] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2f6bff] ${
        selected
          ? "border-[#2f6bff] bg-[#f1f5ff]"
          : "border-transparent bg-[#f7f8fa]"
      }`}
    >
      <span className="min-w-0 flex-1 text-[15px] leading-[22px] font-medium tracking-[0.144px] text-[#191f28]">
        {title}
      </span>
      {selected && <SelectionMark />}
    </button>
  );
}

function PlanScreen({
  purpose,
  improvements,
  schedule,
  methods,
  onEdit,
  direction,
}: {
  purpose: Goal;
  improvements: string[];
  schedule: ScheduleId;
  methods: string[];
  onEdit: (section: EditSection) => void;
  direction: "forward" | "back";
}) {
  const purposeTitle = PURPOSE_OPTIONS.find(
    (option) => option.value === purpose,
  )!.title;
  const scheduleTitle = SCHEDULE_OPTIONS.find(
    (option) => option.value === schedule,
  )!.title;
  const improvementSummary = improvements
    .map(
      (value) =>
        IMPROVEMENT_OPTIONS.find((option) => option.value === value)?.summary ??
        value,
    )
    .join(", ");
  const methodSummary = methods
    .map(
      (value) =>
        METHOD_OPTIONS.find((option) => option.value === value)?.summary ??
        value,
    )
    .join(", ");

  const rows: Array<[string, string, EditSection]> = [
    ["목표", purposeTitle, "purpose"],
    ["집중할 부분", improvementSummary, "improvements"],
    ["연습 일정", scheduleTitle, "schedule"],
    ["연습 방식", methodSummary, "methods"],
  ];

  return (
    <div
      className={`min-h-0 flex-1 overflow-hidden px-6 ${
        direction === "forward"
          ? "onboarding-step-enter-forward"
          : "onboarding-step-enter-back"
      }`}
    >
      <div className="h-10" aria-hidden="true" />
      <h1 className="text-[28px] leading-[38px] font-bold tracking-[-0.6608px] text-[#191f28]">
        이렇게
        <br />
        시작해 볼까요?
      </h1>
      <p className="mt-3 text-[16px] leading-6 tracking-[0.0912px] text-[#4e5968]">
        선택한 내용으로 첫 연습 계획을 만들었어요
      </p>
      <div className="mt-11 flex flex-col">
        {rows.map(([label, value, section], index) => (
          <div key={section}>
            <button
              type="button"
              onClick={() => onEdit(section)}
              className="group flex w-full touch-manipulation items-center gap-3 rounded-xl py-5 text-left transition-[transform,background-color] duration-150 ease-out active:scale-[0.985] active:bg-[#f7f8fa] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2f6bff]"
            >
              <span className="w-[84px] shrink-0 text-[14px] leading-5 tracking-[0.203px] text-[#4e5968]">
                {label}
              </span>
              <span className="min-w-0 flex-1 truncate text-right text-[16px] leading-6 font-medium tracking-[0.0912px] text-[#191f28]">
                {value}
              </span>
              <Image
                src="/figma/auth/chevron-right.svg"
                alt=""
                width={16}
                height={16}
                aria-hidden="true"
                className="size-4 transition-transform duration-150 ease-out group-active:translate-x-0.5"
              />
            </button>
            {index < rows.length - 1 && <div className="h-px bg-[#f9fafb]" />}
          </div>
        ))}
      </div>
    </div>
  );
}

function EditBottomSheet({
  section,
  closing,
  purpose,
  improvements,
  schedule,
  methods,
  onPurpose,
  onImprovement,
  onSchedule,
  onMethod,
  onClose,
  onSave,
}: {
  section: EditSection;
  closing: boolean;
  purpose: Goal | null;
  improvements: string[];
  schedule: ScheduleId | null;
  methods: string[];
  onPurpose: (value: Goal) => void;
  onImprovement: (value: string) => void;
  onSchedule: (value: ScheduleId) => void;
  onMethod: (value: string) => void;
  onClose: () => void;
  onSave: () => void;
}) {
  const [dragY, setDragY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const dragging = useRef(false);
  const dragStartY = useRef(0);
  const dragOffset = useRef(0);

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  const handleDragStart = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (closing) return;
    dragging.current = true;
    setIsDragging(true);
    dragStartY.current = event.clientY;
    dragOffset.current = 0;
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handleDragMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragging.current) return;
    const nextOffset = Math.max(0, event.clientY - dragStartY.current);
    dragOffset.current = nextOffset;
    setDragY(nextOffset);
  };

  const handleDragEnd = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragging.current) return;
    dragging.current = false;
    setIsDragging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (dragOffset.current > 84) {
      onClose();
      return;
    }
    dragOffset.current = 0;
    setDragY(0);
  };

  const details = {
    purpose: {
      title: "무엇을 위해 연습하고 싶나요?",
      subtitle: null,
    },
    improvements: {
      title: "어떤 점을 개선하고 싶나요?",
      subtitle: "최대 3개까지 고를 수 있어요",
    },
    schedule: {
      title: "일주일에 며칠 정도 연습할까요?",
      subtitle: null,
    },
    methods: {
      title: "어떤 방식으로 연습하고 싶나요?",
      subtitle: "여러 개를 골라도 돼요",
    },
  }[section];
  const canSave =
    (section === "purpose" && purpose !== null) ||
    (section === "improvements" && improvements.length > 0) ||
    (section === "schedule" && schedule !== null) ||
    (section === "methods" && methods.length > 0);

  return (
    <div
      className={`absolute inset-0 z-20 ${closing ? "pointer-events-none" : ""}`}
      role="dialog"
      aria-modal="true"
      aria-label={details.title}
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="수정 창 닫기"
        style={
          dragY > 0 ? { opacity: Math.max(0, 1 - dragY / 320) } : undefined
        }
        className={`absolute inset-0 bg-[rgba(25,31,40,0.45)] ${
          closing ? "onboarding-scrim-exit" : "onboarding-scrim-enter"
        }`}
      />
      <div
        className={`absolute bottom-0 left-0 w-full ${
          closing ? "onboarding-sheet-exit" : "onboarding-sheet-enter"
        }`}
      >
        <div
          className="flex w-full flex-col items-center overflow-hidden rounded-t-3xl bg-white px-6 shadow-[0_-12px_36px_rgba(25,31,40,0.08)]"
          style={{
            transform: `translateY(${dragY}px)`,
            transition: isDragging
              ? "none"
              : "transform 320ms cubic-bezier(0.22, 1, 0.36, 1)",
          }}
        >
          <div
            className="flex h-7 w-[calc(100%+48px)] shrink-0 touch-none cursor-grab items-center justify-center active:cursor-grabbing"
            onPointerDown={handleDragStart}
            onPointerMove={handleDragMove}
            onPointerUp={handleDragEnd}
            onPointerCancel={handleDragEnd}
            aria-label="아래로 밀어 닫기"
          >
            <div className="h-1 w-10 rounded-sm bg-[#e5e8eb]" />
          </div>
          <div className="h-2 shrink-0" />
          <div className="flex w-full flex-col gap-1.5">
            <h2 className="text-[20px] leading-7 font-bold tracking-[-0.24px] text-[#191f28]">
              {details.title}
            </h2>
            {details.subtitle && (
              <p className="text-[13px] leading-[18px] tracking-[0.2522px] text-[#8b95a1]">
                {details.subtitle}
              </p>
            )}
          </div>
          <div className="h-5 shrink-0" />
          <div className="flex w-full flex-col gap-2.5">
            {section === "purpose" &&
              PURPOSE_OPTIONS.map((option) => (
                <DetailedCard
                  key={option.value}
                  option={option}
                  selected={purpose === option.value}
                  onClick={() => onPurpose(option.value)}
                />
              ))}
            {section === "improvements" &&
              IMPROVEMENT_OPTIONS.map((option) => (
                <CompactCard
                  key={option.value}
                  title={option.value}
                  selected={improvements.includes(option.value)}
                  onClick={() => onImprovement(option.value)}
                />
              ))}
            {section === "schedule" &&
              SCHEDULE_OPTIONS.map((option) => (
                <DetailedCard
                  key={option.value}
                  option={option}
                  selected={schedule === option.value}
                  onClick={() => onSchedule(option.value)}
                />
              ))}
            {section === "methods" &&
              METHOD_OPTIONS.map((option) => (
                <DetailedCard
                  key={option.value}
                  option={option}
                  selected={methods.includes(option.value)}
                  onClick={() => onMethod(option.value)}
                />
              ))}
          </div>
          <div className="h-6 shrink-0" />
          <button
            type="button"
            disabled={!canSave}
            onClick={onSave}
            className="flex h-14 w-full shrink-0 touch-manipulation items-center justify-center rounded-full bg-[#2f6bff] px-7 text-[16px] leading-6 font-bold tracking-[0.0912px] text-white transition-[transform,filter,background-color,color] duration-150 ease-out active:scale-[0.985] active:brightness-[0.97] disabled:bg-[#f2f4f6] disabled:text-[#b0b8c1] disabled:active:scale-100"
          >
            변경 저장
          </button>
          <div className="h-[34px] shrink-0" aria-hidden="true" />
        </div>
      </div>
    </div>
  );
}
