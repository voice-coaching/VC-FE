"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Bell,
  Mic,
  UserRound,
  Star,
  Info,
  Pencil,
  ChevronRight,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { ProfileAvatar } from "@/components/profile-avatar";
import { TopBar } from "@/components/top-bar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { SERVICE_TERMS, PRIVACY_TERMS } from "@/lib/legal-terms";
import { api } from "@/lib/api";
import { getCachedUser } from "@/lib/auth-session";
export default function AccountSettings() {
  const router = useRouter();
  const [nickname, setNickname] = useState(getCachedUser()?.nickname ?? "");
  const [profileImageUrl, setProfileImageUrl] = useState(
    getCachedUser()?.profileImageUrl ?? null,
  );
  const [panel, setPanel] = useState<string | null>(null);
  const [reminders, setReminders] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [action, setAction] = useState<"logout" | "withdraw" | null>(null);
  useEffect(() => {
    api.users
      .getMe()
      .then((user) => {
        setNickname(user.nickname);
        setProfileImageUrl(user.profileImageUrl);
      })
      .catch(() => undefined);
    try {
      setReminders(localStorage.getItem("speakai:reminder-preview") !== "off");
    } catch {}
  }, []);
  async function accountAction(kind: "logout" | "withdraw") {
    if (
      kind === "withdraw" &&
      !window.confirm(
        "계정과 모든 학습 정보를 삭제할까요? 이 작업은 되돌릴 수 없습니다.",
      )
    )
      return;
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
    }
  }
  const legal =
    panel === "개인정보 처리방침"
      ? PRIVACY_TERMS
      : panel === "서비스 이용약관"
        ? SERVICE_TERMS
        : null;
  return (
    <AppShell nav={false} className="min-h-dvh !bg-white">
      <TopBar to="/mypage" title="설정" />
      <Link
        href="/mypage/settings/profile"
        className="flex items-center gap-3.5 px-5 pt-8 pb-6"
      >
        <ProfileAvatar src={profileImageUrl} size={60} />
        <div>
          <h1 className="text-xl font-bold">{nickname || "프로필"}</h1>
        </div>
      </Link>
      <div className="px-5">
        <div className="flex min-h-20 items-center gap-3.5">
          <span className="rounded-xl bg-[#f2f4f6] p-2">
            <Bell className="size-5" />
          </span>
          <button
            onClick={() => setPanel("연습 알림")}
            className="flex-1 text-left"
          >
            <span className="text-base font-medium">연습 알림</span>
            <span className="mt-1 block text-[13px] text-[#8b95a1]">
              매일 오후 9:00 · 예시
            </span>
          </button>
          <button
            role="switch"
            aria-label="연습 알림 예시 설정"
            aria-checked={reminders}
            onClick={() => {
              const next = !reminders;
              setReminders(next);
              try {
                localStorage.setItem(
                  "speakai:reminder-preview",
                  next ? "on" : "off",
                );
              } catch {}
            }}
            className={`flex h-6 w-10 items-center rounded-full p-0.5 ${reminders ? "justify-end bg-primary" : "bg-[#d1d6db]"}`}
          >
            <span className="size-5 rounded-full bg-white" />
          </button>
        </div>
        {[
          ["마이크와 음성", Mic],
          ["계정 관리", UserRound],
          ["구독 관리", Star],
          ["공지사항", Info],
          ["1:1 문의하기", Pencil],
        ].map(([label, Icon]) => {
          const MenuIcon = Icon as typeof Mic;
          return (
            <button
              key={String(label)}
              onClick={() => setPanel(String(label))}
              className="flex min-h-16 w-full items-center gap-3.5 text-left"
            >
              <span className="rounded-xl bg-[#f2f4f6] p-2">
                <MenuIcon className="size-5" />
              </span>
              <span className="flex-1 text-base font-medium">
                {String(label)}
              </span>
              <ChevronRight className="size-4" />
            </button>
          );
        })}
      </div>
      <div className="mt-2 border-t-8 border-[#f2f4f6] px-5 pt-2">
        {["개인정보 처리방침", "서비스 이용약관"].map((label) => (
          <button
            key={label}
            onClick={() => setPanel(label)}
            className="block h-[50px] text-sm text-[#8b95a1]"
          >
            {label}
          </button>
        ))}
        <button
          disabled={action !== null}
          onClick={() => void accountAction("logout")}
          className="block h-[50px] text-sm text-[#8b95a1]"
        >
          {action === "logout" ? "로그아웃 중…" : "로그아웃"}
        </button>
        <button
          disabled={action !== null}
          onClick={() => void accountAction("withdraw")}
          className="block h-[50px] text-sm text-[#8b95a1]"
        >
          {action === "withdraw" ? "탈퇴 처리 중…" : "회원 탈퇴"}
        </button>
        {message && (
          <p role="alert" className="text-xs text-destructive">
            {message}
          </p>
        )}
      </div>
      <p className="pt-6 pb-10 text-center text-xs text-[#b0b8c1]">
        버전 1.0.0
      </p>
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
              {legal
                ? "서비스 문서"
                : panel === "계정 관리"
                  ? "가입 정보를 확인하고 수정할 수 있어요"
                  : "설정 안내"}
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
          ) : panel === "계정 관리" ? (
            <>
              <Link
                href="/mypage/settings/profile"
                className="rounded-xl bg-[#f2f4f6] p-4 text-sm"
              >
                프로필 수정하기
              </Link>
              <Link
                href="/mypage/plan"
                className="rounded-xl bg-[#f2f4f6] p-4 text-sm"
              >
                연습 계획 수정
              </Link>
            </>
          ) : (
            <p className="text-sm leading-6 text-[#6b7684]">
              {panel === "연습 알림"
                ? "매일 오후 9시에 연습하는 예시 설정입니다. 알림 발송 기능은 아직 연결되지 않았어요."
                : panel === "마이크와 음성"
                  ? "녹음 화면에서 마이크 사용을 허용해 주세요. 예시 음성과 내 녹음은 각 연습 화면에서 들을 수 있어요."
                  : panel === "구독 관리"
                    ? "현재 제공되는 구독 상품이 없습니다."
                    : panel === "공지사항"
                      ? "등록된 공지사항이 없습니다."
                      : "문의 접수 기능은 준비 중이에요."}
            </p>
          )}
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
