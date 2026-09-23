"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  api,
  type NotificationPreferences,
  type NoticeSummary,
} from "@/lib/api";
import { getAuthenticatedUserId } from "@/lib/auth-session";
import { cacheResources } from "@/lib/cache-resources";
import {
  CLIENT_CACHE_DAY_MAX_AGE_MS,
  readUserClientCache,
  writeUserClientCache,
} from "@/lib/client-cache";
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
  const userId = getAuthenticatedUserId();
  const [initialPreferences] = useState(() =>
    readUserClientCache<NotificationPreferences>(
      userId,
      cacheResources.notificationPreferences,
      CLIENT_CACHE_DAY_MAX_AGE_MS,
    ),
  );
  const [panel, setPanel] = useState<Panel | null>(null);
  const [withdrawConfirm, setWithdrawConfirm] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [action, setAction] = useState<"logout" | "withdraw" | null>(null);
  const [notificationPreferences, setNotificationPreferences] =
    useState<NotificationPreferences | null>(initialPreferences);
  const [notificationSaving, setNotificationSaving] = useState(false);
  const [notificationMessage, setNotificationMessage] = useState<string | null>(
    null,
  );
  const [notices, setNotices] = useState<NoticeSummary[] | null>(null);
  const [panelError, setPanelError] = useState<string | null>(null);
  const [inquirySubject, setInquirySubject] = useState("");
  const [inquiryBody, setInquiryBody] = useState("");
  const [inquiryEmail, setInquiryEmail] = useState("");
  const [inquirySending, setInquirySending] = useState(false);
  const [inquirySent, setInquirySent] = useState(false);

  useEffect(() => {
    let active = true;
    const cached = readUserClientCache<NotificationPreferences>(
      userId,
      cacheResources.notificationPreferences,
      CLIENT_CACHE_DAY_MAX_AGE_MS,
    );
    if (cached) setNotificationPreferences(cached);
    api.notifications
      .getPreferences()
      .then((value) => {
        if (!active) return;
        setNotificationPreferences(value);
        writeUserClientCache(
          userId,
          cacheResources.notificationPreferences,
          value,
        );
      })
      .catch((reason: unknown) => {
        if (active && !cached)
          setNotificationMessage(
            reason instanceof Error
              ? reason.message
              : "알림 설정을 불러오지 못했습니다.",
          );
      });
    return () => {
      active = false;
    };
  }, [userId]);

  useEffect(() => {
    if (panel !== "공지사항") return;
    let active = true;
    const cached = readUserClientCache<NoticeSummary[]>(
      userId,
      cacheResources.notices,
      CLIENT_CACHE_DAY_MAX_AGE_MS,
    );
    setNotices(cached);
    setPanelError(null);
    api.support
      .listNotices({ page: 0, size: 20 })
      .then((result) => {
        if (!active) return;
        setNotices(result.items);
        writeUserClientCache(userId, cacheResources.notices, result.items);
      })
      .catch((reason: unknown) => {
        if (active && !cached)
          setPanelError(
            reason instanceof Error
              ? reason.message
              : "공지사항을 불러오지 못했습니다.",
          );
      });
    return () => {
      active = false;
    };
  }, [panel, userId]);

  function openPanel(nextPanel: Panel) {
    setPanelError(null);
    if (nextPanel === "1:1 문의하기") setInquirySent(false);
    setPanel(nextPanel);
  }

  async function togglePracticeReminder() {
    if (!notificationPreferences || notificationSaving) return;
    const previous = notificationPreferences;
    const enabled = !previous.practiceReminder.enabled;
    setNotificationSaving(true);
    setNotificationMessage(null);
    setNotificationPreferences({
      ...previous,
      practiceReminder: { ...previous.practiceReminder, enabled },
    });
    writeUserClientCache(userId, cacheResources.notificationPreferences, {
      ...previous,
      practiceReminder: { ...previous.practiceReminder, enabled },
    });
    try {
      const updated = await api.notifications.updatePreferences({
        practiceReminder: { enabled },
      });
      setNotificationPreferences(updated);
      writeUserClientCache(
        userId,
        cacheResources.notificationPreferences,
        updated,
      );
    } catch (reason) {
      setNotificationPreferences(previous);
      writeUserClientCache(
        userId,
        cacheResources.notificationPreferences,
        previous,
      );
      setNotificationMessage(
        reason instanceof Error
          ? reason.message
          : "알림 설정을 변경하지 못했습니다.",
      );
    } finally {
      setNotificationSaving(false);
    }
  }

  async function submitInquiry() {
    if (!inquirySubject.trim() || !inquiryBody.trim() || inquirySending) return;
    setInquirySending(true);
    setPanelError(null);
    try {
      await api.support.createInquiry({
        category: "SERVICE",
        subject: inquirySubject.trim(),
        body: inquiryBody.trim(),
        replyEmail: inquiryEmail.trim() || undefined,
      });
      setInquirySent(true);
      setInquirySubject("");
      setInquiryBody("");
      setInquiryEmail("");
    } catch (reason) {
      setPanelError(
        reason instanceof Error
          ? reason.message
          : "문의를 접수하지 못했습니다.",
      );
    } finally {
      setInquirySending(false);
    }
  }

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
                {notificationPreferences
                  ? `${notificationPreferences.practiceReminder.time} 알림`
                  : "알림 설정 불러오는 중"}
              </span>
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={
                notificationPreferences?.practiceReminder.enabled ?? false
              }
              aria-label="연습 알림"
              disabled={!notificationPreferences || notificationSaving}
              onClick={() => void togglePracticeReminder()}
              className={`relative h-6 w-10 shrink-0 rounded-full transition-colors disabled:opacity-60 ${
                notificationPreferences?.practiceReminder.enabled
                  ? "bg-primary"
                  : "bg-[#dfe3e7]"
              }`}
            >
              <span
                className={`absolute top-0.5 size-5 rounded-full bg-white transition-[left] ${
                  notificationPreferences?.practiceReminder.enabled
                    ? "left-[18px]"
                    : "left-0.5"
                }`}
              />
            </button>
          </div>
          {notificationMessage ? (
            <p role="alert" className="px-5 pb-2 text-xs text-destructive">
              {notificationMessage}
            </p>
          ) : null}
          <SettingsItem
            label={GROUPS[0].items[0].label}
            icon={GROUPS[0].items[0].icon}
            onClick={() => openPanel(GROUPS[0].items[0].label)}
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
                onClick={() => openPanel(item.label)}
              />
            ))}
          </section>
        ))}

        <div className="mt-1 h-2 bg-[#f2f4f6]" />
        <div className="bg-white pt-2">
          <FooterButton
            label="개인정보 처리방침"
            onClick={() => openPanel("개인정보 처리방침")}
          />
          <FooterButton
            label="서비스 이용약관"
            onClick={() => openPanel("서비스 이용약관")}
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
          ) : panel === "공지사항" ? (
            panelError ? (
              <p role="alert" className="text-sm text-destructive">
                {panelError}
              </p>
            ) : notices === null ? (
              <p className="text-sm text-[#8b95a1]">공지사항을 불러오는 중…</p>
            ) : notices.length ? (
              <div className="space-y-3">
                {notices.map((notice) => (
                  <article
                    key={String(notice.id)}
                    className="rounded-2xl bg-[#f7f8fa] p-4"
                  >
                    <div className="flex items-center gap-2">
                      {notice.pinned ? (
                        <span className="rounded-full bg-[#edf2ff] px-2 py-0.5 text-xs font-medium text-primary">
                          중요
                        </span>
                      ) : null}
                      <h2 className="text-sm font-bold">{notice.title}</h2>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-[#6b7684]">
                      {notice.summary}
                    </p>
                    <time className="mt-2 block text-xs text-[#8b95a1]">
                      {new Date(notice.publishedAt).toLocaleDateString("ko-KR")}
                    </time>
                  </article>
                ))}
              </div>
            ) : (
              <p className="text-sm leading-6 text-[#6b7684]">
                등록된 공지사항이 없습니다.
              </p>
            )
          ) : panel === "1:1 문의하기" ? (
            inquirySent ? (
              <div className="rounded-2xl bg-[#edf2ff] p-4 text-sm leading-6 text-primary">
                문의가 접수되었습니다. 답변이 등록되면 알려드릴게요.
              </div>
            ) : (
              <form
                className="space-y-3"
                onSubmit={(event) => {
                  event.preventDefault();
                  void submitInquiry();
                }}
              >
                <input
                  value={inquirySubject}
                  onChange={(event) => setInquirySubject(event.target.value)}
                  placeholder="문의 제목"
                  maxLength={100}
                  required
                  className="h-11 w-full rounded-xl border border-[#e5e8eb] px-3 text-sm outline-none focus:border-primary"
                />
                <textarea
                  value={inquiryBody}
                  onChange={(event) => setInquiryBody(event.target.value)}
                  placeholder="문의 내용을 입력해 주세요."
                  maxLength={2_000}
                  required
                  className="min-h-32 w-full resize-y rounded-xl border border-[#e5e8eb] p-3 text-sm leading-6 outline-none focus:border-primary"
                />
                <input
                  type="email"
                  value={inquiryEmail}
                  onChange={(event) => setInquiryEmail(event.target.value)}
                  placeholder="답변 받을 이메일 (선택)"
                  className="h-11 w-full rounded-xl border border-[#e5e8eb] px-3 text-sm outline-none focus:border-primary"
                />
                {panelError ? (
                  <p role="alert" className="text-xs text-destructive">
                    {panelError}
                  </p>
                ) : null}
                <button
                  type="submit"
                  disabled={
                    inquirySending ||
                    !inquirySubject.trim() ||
                    !inquiryBody.trim()
                  }
                  className="h-11 w-full rounded-xl bg-primary text-sm font-bold text-white disabled:opacity-50"
                >
                  {inquirySending ? "접수 중…" : "문의 접수"}
                </button>
              </form>
            )
          ) : (
            <p className="text-sm leading-6 text-[#6b7684]">
              {panel === "마이크와 음성"
                ? "녹음 화면에서 마이크 사용을 허용해 주세요."
                : "설정을 확인해 주세요."}
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
