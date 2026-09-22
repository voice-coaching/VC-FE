"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AppShell } from "@/components/app-shell";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { api } from "@/lib/api";
import { PRIVACY_TERMS, SERVICE_TERMS } from "@/lib/legal-terms";

type Panel =
  | "마이크와 음성"
  | "공지사항"
  | "1:1 문의하기"
  | "개인정보 처리방침"
  | "서비스 이용약관";

const GROUPS: Array<{
  title: string;
  items: Array<{ label: Panel; icon: string }>;
}> = [
  {
    title: "연습 환경",
    items: [
      {
        label: "마이크와 음성",
        icon: "/figma/settings/microphone.svg",
      },
    ],
  },
  {
    title: "도움말",
    items: [
      { label: "공지사항", icon: "/figma/settings/info.svg" },
      { label: "1:1 문의하기", icon: "/figma/settings/pencil.svg" },
    ],
  },
];

export default function AccountSettings() {
  const router = useRouter();
  const [panel, setPanel] = useState<Panel | null>(null);
  const [withdrawConfirm, setWithdrawConfirm] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [action, setAction] = useState<"logout" | "withdraw" | null>(null);

  async function accountAction(kind: "logout" | "withdraw") {
    setAction(kind);
    setMessage(null);
    try {
      if (kind === "logout") await api.auth.signOut();
      else await api.users.withdraw();
      router.replace("/");
    } catch (reason) {
      setMessage(
        reason instanceof Error
          ? reason.message
          : "요청을 완료하지 못했습니다.",
      );
      setAction(null);
      setWithdrawConfirm(false);
    }
  }

  const legal =
    panel === "개인정보 처리방침"
      ? PRIVACY_TERMS
      : panel === "서비스 이용약관"
        ? SERVICE_TERMS
        : null;

  return (
    <AppShell
      nav={false}
      viewportLocked
      chromeColor="#ffffff"
      className="flex flex-col overflow-hidden bg-white"
    >
      <header className="relative flex h-12 shrink-0 items-center px-2 py-1">
        <Link
          href="/mypage"
          aria-label="마이로 돌아가기"
          className="flex size-10 items-center justify-center"
        >
          <Image src="/figma/settings/back.svg" alt="" width={24} height={24} />
        </Link>
        <h1 className="pointer-events-none absolute inset-x-12 text-center text-[17px] leading-6 font-bold">
          설정
        </h1>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto pb-6">
        <section className="bg-white">
          <h2 className="h-8 px-5 py-2 text-[12px] leading-4 font-bold text-[#333d4b]">
            연습 환경
          </h2>
          <div className="flex h-14 items-center gap-3.5 px-5 py-2">
            <span className="flex size-9 shrink-0 items-center justify-center">
              <Image
                src="/figma/settings/bell.svg"
                alt=""
                width={22}
                height={22}
              />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[15px] leading-[22px] font-medium">
                연습 알림
              </span>
              <span className="mt-[3px] block text-[13px] leading-[18px] text-[#8b95a1]">
                알림 기능 준비 중
              </span>
            </span>
            <span
              role="switch"
              aria-checked="false"
              aria-disabled="true"
              aria-label="연습 알림 기능 준비 중"
              className="relative h-6 w-10 shrink-0 rounded-full bg-[#dfe3e7]"
            >
              <span className="absolute top-0.5 left-0.5 size-5 rounded-full bg-white" />
            </span>
          </div>
          <SettingsItem
            label={GROUPS[0].items[0].label}
            icon={GROUPS[0].items[0].icon}
            onClick={() => setPanel(GROUPS[0].items[0].label)}
          />
        </section>

        {GROUPS.slice(1).map((group) => (
          <section key={group.title} className="bg-white">
            <h2 className="h-8 px-5 py-2 text-[12px] leading-4 font-bold text-[#333d4b]">
              {group.title}
            </h2>
            {group.items.map((item) => (
              <SettingsItem
                key={item.label}
                label={item.label}
                icon={item.icon}
                onClick={() => setPanel(item.label)}
              />
            ))}
          </section>
        ))}

        <div className="mt-1 h-2 bg-[#f2f4f6]" />
        <div className="bg-white pt-2">
          <FooterButton
            label="개인정보 처리방침"
            onClick={() => setPanel("개인정보 처리방침")}
          />
          <FooterButton
            label="서비스 이용약관"
            onClick={() => setPanel("서비스 이용약관")}
          />
          <FooterButton
            label={action === "logout" ? "로그아웃 중…" : "로그아웃"}
            disabled={action !== null}
            onClick={() => void accountAction("logout")}
          />
          <FooterButton
            label={action === "withdraw" ? "탈퇴 처리 중…" : "회원 탈퇴"}
            disabled={action !== null}
            onClick={() => setWithdrawConfirm(true)}
          />
          {message ? (
            <p role="alert" className="px-5 py-2 text-[12px] text-destructive">
              {message}
            </p>
          ) : null}
        </div>
        <p className="bg-white pt-5 pb-2 text-center text-[12px] leading-4 text-[#b0b8c1]">
          버전 1.0.0
        </p>
      </div>

      <Dialog
        open={panel !== null}
        onOpenChange={(open) => {
          if (!open) setPanel(null);
        }}
      >
        <DialogContent className="max-h-[80dvh] max-w-[370px] overflow-y-auto rounded-3xl border-[#e5e8eb] bg-white text-[#191f28]">
          <DialogHeader>
            <DialogTitle>{panel}</DialogTitle>
            <DialogDescription className="text-[#8b95a1]">
              {legal ? "서비스 문서" : "설정 안내"}
            </DialogDescription>
          </DialogHeader>
          {legal ? (
            legal.map((section) => (
              <section key={section.title}>
                <h2 className="mb-2 text-sm font-bold">{section.title}</h2>
                {section.paragraphs.map((text) => (
                  <p
                    key={text}
                    className="mb-3 text-sm leading-6 text-[#6b7684]"
                  >
                    {text}
                  </p>
                ))}
              </section>
            ))
          ) : (
            <p className="text-sm leading-6 text-[#6b7684]">
              {panel === "마이크와 음성"
                ? "녹음 화면에서 마이크 사용을 허용해 주세요."
                : panel === "공지사항"
                  ? "등록된 공지사항이 없습니다."
                  : "문의 접수 기능은 준비 중이에요."}
            </p>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={withdrawConfirm} onOpenChange={setWithdrawConfirm}>
        <DialogContent className="max-w-[350px] rounded-3xl border-0 bg-white p-6 text-[#191f28]">
          <DialogHeader>
            <DialogTitle>회원 탈퇴</DialogTitle>
            <DialogDescription className="text-[#6b7684]">
              계정과 모든 학습 정보를 삭제할까요? 이 작업은 되돌릴 수 없습니다.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <button
              type="button"
              disabled={action !== null}
              onClick={() => setWithdrawConfirm(false)}
              className="h-12 rounded-xl bg-[#f2f4f6] text-sm font-bold"
            >
              취소
            </button>
            <button
              type="button"
              disabled={action !== null}
              onClick={() => void accountAction("withdraw")}
              className="h-12 rounded-xl bg-[#f04452] text-sm font-bold text-white"
            >
              {action === "withdraw" ? "처리 중…" : "탈퇴하기"}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}

function SettingsItem({
  label,
  icon,
  onClick,
}: {
  label: string;
  icon: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-14 w-full items-center gap-3.5 px-5 py-2 text-left"
    >
      <span className="flex size-9 shrink-0 items-center justify-center">
        <Image src={icon} alt="" width={22} height={22} />
      </span>
      <span className="flex-1 text-[15px] leading-[22px] font-medium">
        {label}
      </span>
      <Image
        src="/figma/settings/chevron-right.svg"
        alt=""
        width={18}
        height={18}
      />
    </button>
  );
}

function FooterButton({
  label,
  onClick,
  disabled = false,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="block h-10 w-full px-5 py-2 text-left text-[15px] leading-[22px] text-[#8b95a1] disabled:opacity-60"
    >
      {label}
    </button>
  );
}
