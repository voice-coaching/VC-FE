"use client";
import { NavigationIcon } from "@/components/navigation-icon";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { IPhoneFrame } from "@/components/iphone-frame";
import { api, disableDeveloperApi } from "@/lib/api";
import { getAuthSessionSnapshot } from "@/lib/auth-session";
import { markTermsAccepted, type SignupDraft } from "@/lib/terms-flow";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  PRIVACY_TERMS,
  SERVICE_TERMS,
  TERMS_EFFECTIVE_DATE,
  type LegalSection,
} from "@/lib/legal-terms";

type TermKey = "age" | "service" | "privacy" | "quality" | "marketing";

type TermItem = {
  key: TermKey;
  label: string;
  hasDetails: boolean;
};

const TERM_ITEMS: TermItem[] = [
  { key: "age", label: "[필수] 만 14세 이상입니다", hasDetails: false },
  { key: "service", label: "[필수] 이용약관", hasDetails: true },
  {
    key: "privacy",
    label: "[필수] 개인정보 수집 및 이용",
    hasDetails: true,
  },
  { key: "quality", label: "[선택] 서비스 품질 향상", hasDetails: true },
  {
    key: "marketing",
    label: "[선택] 이벤트 및 혜택 알림 수신",
    hasDetails: true,
  },
];

const INITIAL_TERMS: Record<TermKey, boolean> = {
  age: false,
  service: false,
  privacy: false,
  quality: false,
  marketing: false,
};

export function TermsScreen({
  signupDraft,
  onBack,
}: {
  signupDraft?: SignupDraft;
  onBack?: () => void;
} = {}) {
  const router = useRouter();
  const signupFlow = signupDraft !== undefined;
  const [terms, setTerms] = useState(INITIAL_TERMS);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detailKey, setDetailKey] = useState<TermKey | null>(null);

  const allChecked = TERM_ITEMS.every((item) => terms[item.key]);
  const requiredChecked = terms.age && terms.service && terms.privacy;

  function toggleAll() {
    const checked = !allChecked;
    setTerms({
      age: checked,
      service: checked,
      privacy: checked,
      quality: checked,
      marketing: checked,
    });
    setError(null);
  }

  function toggleTerm(key: TermKey) {
    setTerms((current) => ({ ...current, [key]: !current[key] }));
    setError(null);
  }

  async function handleNext() {
    if (!requiredChecked || submitting) return;
    setSubmitting(true);
    setError(null);

    try {
      const authSession = getAuthSessionSnapshot();
      let userId =
        authSession.status === "authenticated" ? authSession.userId : undefined;

      if (signupFlow) {
        disableDeveloperApi();
        const session = await api.auth.signUp({
          ...signupDraft,
          termsAgreed: terms.service,
          privacyAgreed: terms.privacy,
        });
        userId = session.user.id;
      }

      if (userId === undefined) {
        setError("로그인 정보를 확인할 수 없어요. 다시 로그인해 주세요.");
        return;
      }

      markTermsAccepted(userId, {
        qualityImprovement: terms.quality,
        marketing: terms.marketing,
      });
      router.replace("/onboarding");
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "회원가입을 완료하지 못했어요. 다시 시도해 주세요.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <IPhoneFrame>
      <section className="flex h-full flex-col bg-white" aria-label="약관 동의">
        <div className="h-11 shrink-0" aria-hidden="true" />

        <header className="flex h-12 shrink-0 items-center px-4 py-3">
          <button
            type="button"
            onClick={() =>
              signupFlow && onBack ? onBack() : router.replace("/")
            }
            aria-label="이전 화면으로 돌아가기"
            className="flex size-6 shrink-0 items-center justify-center rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2f6bff]"
          >
            <NavigationIcon />
          </button>
          <h1 className="flex-1 text-center text-[18px] leading-[26px] font-bold tracking-[-0.0036px]">
            약관 동의
          </h1>
          <span className="size-6 shrink-0" aria-hidden="true" />
        </header>

        <div className="flex min-h-0 flex-1 flex-col px-6">
          <div className="h-[34px] shrink-0" aria-hidden="true" />
          <h2 className="terms-content-reveal text-[24px] leading-8 font-bold tracking-[-0.552px] [animation-delay:80ms]">
            반가워요!
          </h2>
          <p className="terms-content-reveal mt-2 text-[14px] leading-5 tracking-[0.203px] text-[#4e5968] [animation-delay:140ms]">
            Speak AI를 사용하시려면 동의가 필요해요
          </p>

          <button
            type="button"
            onClick={toggleAll}
            aria-pressed={allChecked}
            className="terms-content-reveal mt-[26px] flex w-full touch-manipulation items-center gap-3 rounded-[14px] bg-[#fafbfc] p-4 text-left transition-transform duration-150 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2f6bff] [animation-delay:220ms]"
          >
            <span
              className={`flex size-6 shrink-0 items-center justify-center overflow-hidden rounded-lg ${
                allChecked ? "bg-[#2f6bff]" : "bg-[#f2f4f6]"
              }`}
            >
              <Image
                src="/figma/auth/terms-checkbox-check.svg"
                alt=""
                width={15}
                height={15}
                aria-hidden="true"
              />
            </span>
            <span className="text-[18px] leading-[26px] font-bold tracking-[-0.0036px]">
              모두 동의
            </span>
          </button>

          <div className="mt-1.5 flex flex-col">
            {TERM_ITEMS.map((item, index) => (
              <div
                key={item.key}
                className="terms-content-reveal flex w-full items-center"
                style={{ animationDelay: `${280 + index * 55}ms` }}
              >
                <button
                  type="button"
                  onClick={() => toggleTerm(item.key)}
                  aria-pressed={terms[item.key]}
                  className="flex min-h-[52px] min-w-0 flex-1 touch-manipulation items-center gap-3 px-1 text-left transition-transform duration-150 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2f6bff]"
                >
                  <Image
                    src={
                      terms[item.key]
                        ? "/figma/auth/terms-row-check-selected.svg"
                        : "/figma/auth/terms-row-check-unselected.svg"
                    }
                    alt=""
                    width={20}
                    height={20}
                    aria-hidden="true"
                    className="size-5 shrink-0"
                  />
                  <span className="min-w-0 flex-1 text-[15px] leading-[22px] font-medium tracking-[0.144px]">
                    {item.label}
                  </span>
                </button>
                {item.hasDetails ? (
                  <button
                    type="button"
                    onClick={() => setDetailKey(item.key)}
                    aria-label={`${item.label} 내용 보기`}
                    className="flex size-11 shrink-0 items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2f6bff]"
                  >
                    <Image
                      src="/figma/auth/chevron-right.svg"
                      alt=""
                      width={18}
                      height={18}
                      aria-hidden="true"
                    />
                  </button>
                ) : null}
              </div>
            ))}
          </div>

          {error && (
            <p
              role="alert"
              className="mt-2 text-center text-[12px] leading-[18px] text-[#d22030]"
            >
              {error}
            </p>
          )}

          <div className="min-h-0 flex-1" />
          <button
            type="button"
            onClick={() => void handleNext()}
            disabled={!requiredChecked || submitting}
            className="flex h-14 w-full shrink-0 items-center justify-center rounded-full bg-[#2f6bff] px-7 text-[17px] leading-6 font-bold text-white transition-colors disabled:bg-[#f2f4f6] disabled:text-[#b0b8c1]"
          >
            {submitting ? "처리 중…" : "다음"}
          </button>
          <div className="h-6 shrink-0" aria-hidden="true" />
        </div>

        <div className="h-[34px] shrink-0" aria-hidden="true" />
      </section>
      <TermDetailDialog value={detailKey} onClose={() => setDetailKey(null)} />
    </IPhoneFrame>
  );
}

function TermDetailDialog({
  value,
  onClose,
}: {
  value: TermKey | null;
  onClose: () => void;
}) {
  const details: Partial<
    Record<
      TermKey,
      { title: string; sections?: LegalSection[]; description?: string }
    >
  > = {
    service: { title: "이용약관", sections: SERVICE_TERMS },
    privacy: { title: "개인정보 수집 및 이용", sections: PRIVACY_TERMS },
    quality: {
      title: "서비스 품질 향상",
      description:
        "오류 진단과 사용성 개선을 위해 비식별 이용 정보를 활용하는 선택 동의입니다. 동의하지 않아도 서비스를 이용할 수 있습니다.",
    },
    marketing: {
      title: "이벤트 및 혜택 알림 수신",
      description:
        "새로운 학습 콘텐츠와 이벤트 안내를 받기 위한 선택 동의입니다. 설정에서 언제든 변경할 수 있습니다.",
    },
  };
  const detail = value ? details[value] : undefined;
  return (
    <Dialog open={Boolean(value)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[82dvh] w-[calc(100%-40px)] max-w-[362px] overflow-hidden rounded-[24px] border-0 p-0">
        <DialogHeader className="border-b border-border px-5 py-5 text-left">
          <DialogTitle>{detail?.title}</DialogTitle>
          <DialogDescription>시행일 {TERMS_EFFECTIVE_DATE}</DialogDescription>
        </DialogHeader>
        <article className="min-h-0 overflow-y-auto px-5 py-4">
          {detail?.sections ? (
            detail.sections.map((section) => (
              <section key={section.title} className="mb-5">
                <h3 className="text-sm font-bold">{section.title}</h3>
                {section.paragraphs.map((paragraph) => (
                  <p
                    key={paragraph}
                    className="mt-2 text-xs leading-6 text-muted-foreground"
                  >
                    {paragraph}
                  </p>
                ))}
              </section>
            ))
          ) : (
            <p className="text-sm leading-7 text-muted-foreground">
              {detail?.description}
            </p>
          )}
        </article>
        <div className="border-t border-border p-4">
          <button type="button" onClick={onClose} className="design-action">
            확인
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
