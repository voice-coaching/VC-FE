"use client";

import { useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
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

export interface TermsAgreement {
  service: boolean;
  privacy: boolean;
}

export function TermsAgreementDialog({
  open,
  onOpenChange,
  value,
  onChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  value: TermsAgreement;
  onChange: (value: TermsAgreement) => void;
}) {
  const [document, setDocument] = useState<"service" | "privacy">("service");
  const allChecked = value.service && value.privacy;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] w-[calc(100%-2rem)] max-w-md gap-0 overflow-hidden rounded-3xl p-0">
        <DialogHeader className="border-b border-border px-6 py-5 text-left">
          <DialogTitle>약관 확인 및 동의</DialogTitle>
          <DialogDescription>
            가입 전 필수 약관을 확인해 주세요. 시행일 {TERMS_EFFECTIVE_DATE}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 px-6 py-4">
          <AgreementRow
            checked={allChecked}
            label="필수 약관 전체 동의"
            strong
            onCheckedChange={(checked) =>
              onChange({ service: checked, privacy: checked })
            }
          />
          <div className="h-px bg-border" />
          <AgreementRow
            checked={value.service}
            label="[필수] 서비스 이용약관"
            active={document === "service"}
            onCheckedChange={(checked) =>
              onChange({ ...value, service: checked })
            }
            onView={() => setDocument("service")}
          />
          <AgreementRow
            checked={value.privacy}
            label="[필수] 개인정보 처리방침"
            active={document === "privacy"}
            onCheckedChange={(checked) =>
              onChange({ ...value, privacy: checked })
            }
            onView={() => setDocument("privacy")}
          />
        </div>

        <LegalDocument
          title={
            document === "service" ? "서비스 이용약관" : "개인정보 처리방침"
          }
          sections={document === "service" ? SERVICE_TERMS : PRIVACY_TERMS}
        />

        <div className="border-t border-border p-4">
          <button
            type="button"
            disabled={!allChecked}
            onClick={() => onOpenChange(false)}
            className="w-full rounded-full bg-foreground py-3.5 text-sm font-semibold text-background disabled:opacity-30"
          >
            동의하고 닫기
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function AgreementRow({
  checked,
  label,
  onCheckedChange,
  onView,
  active = false,
  strong = false,
}: {
  checked: boolean;
  label: string;
  onCheckedChange: (checked: boolean) => void;
  onView?: () => void;
  active?: boolean;
  strong?: boolean;
}) {
  return (
    <div className="flex items-center gap-3">
      <Checkbox
        checked={checked}
        onCheckedChange={(next) => onCheckedChange(next === true)}
        aria-label={label}
      />
      <button
        type="button"
        onClick={() => onCheckedChange(!checked)}
        className={`min-w-0 flex-1 text-left text-xs ${strong ? "font-bold" : "font-medium"}`}
      >
        {label}
      </button>
      {onView && (
        <button
          type="button"
          onClick={onView}
          aria-pressed={active}
          className="shrink-0 text-[11px] text-muted-foreground underline"
        >
          내용 보기
        </button>
      )}
    </div>
  );
}

function LegalDocument({
  title,
  sections,
}: {
  title: string;
  sections: LegalSection[];
}) {
  return (
    <article className="mx-4 max-h-[42dvh] overflow-y-auto rounded-2xl bg-surface p-4">
      <h3 className="text-sm font-bold">{title}</h3>
      <p className="mt-1 text-[11px] text-muted-foreground">
        시행일 {TERMS_EFFECTIVE_DATE}
      </p>
      <div className="mt-4 space-y-4">
        {sections.map((section) => (
          <section key={section.title}>
            <h4 className="text-xs font-semibold">{section.title}</h4>
            {section.paragraphs.map((paragraph) => (
              <p
                key={paragraph}
                className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground"
              >
                {paragraph}
              </p>
            ))}
          </section>
        ))}
      </div>
    </article>
  );
}
