"use client";
import { Crown } from "lucide-react";
import { AdminHomePopup } from "./admin-home-popup";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { toast } from "sonner";
import { api } from "@/lib/api";
import {
  ApiError,
  getAuthSessionVersion,
  subscribeAuthSession,
} from "@/lib/api/client";
import { getAuthenticatedUserId } from "@/lib/auth-session";
import { clearUserClientCache } from "@/lib/client-cache";
import { notifyCoachingUsageChanged } from "@/lib/coaching-usage";
import { activatePremiumTrial, loadPremiumTrial } from "@/lib/premium-trial";
import styles from "./home-popup.module.css";
import { Toaster } from "@/components/ui/sonner";

/** Only server eligibility opens the offer; viewing never grants membership. */
export function HomePopup() {
  const epoch = useSyncExternalStore(
    subscribeAuthSession,
    getAuthSessionVersion,
    () => 0,
  );
  const userId = getAuthenticatedUserId();
  const scope = JSON.stringify([epoch, userId]);
  const [openScope, setOpenScope] = useState<string | null>(null);
  const [checkedScope, setCheckedScope] = useState<string | null>(null);
  const [busyScope, setBusyScope] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const activation = useRef<AbortController | null>(null);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const busy = busyScope === scope;

  useEffect(() => {
    if (!userId) return;
    const owner = new AbortController();
    void loadPremiumTrial(owner.signal)
      .then((trial) => {
        if (
          !owner.signal.aborted &&
          epoch === getAuthSessionVersion() &&
          trial.eligible
        )
          setOpenScope(scope);
      })
      .catch(() => {
        // Do not invent eligibility or block home when the service is unavailable.
      })
      .finally(() => {
        if (!owner.signal.aborted && epoch === getAuthSessionVersion())
          setCheckedScope(scope);
      });
    return () => {
      owner.abort();
      activation.current?.abort();
      activation.current = null;
    };
  }, [epoch, userId, scope]);

  function close() {
    if (!busy) {
      setOpenScope(null);
      setError(null);
    }
  }

  async function startTrial() {
    if (activation.current || !userId) return;
    const owner = new AbortController();
    activation.current = owner;
    setBusyScope(scope);
    setError(null);
    try {
      await activatePremiumTrial(owner.signal);
      if (owner.signal.aborted || epoch !== getAuthSessionVersion()) return;
      clearUserClientCache(userId);
      notifyCoachingUsageChanged();
      await api.users.getMe().catch(() => null);
      if (owner.signal.aborted || epoch !== getAuthSessionVersion()) return;
      setOpenScope(null);
      toast.success("72시간 프리미엄 체험이 시작됐어요.");
    } catch (reason) {
      if (owner.signal.aborted || epoch !== getAuthSessionVersion()) return;
      if (
        reason instanceof ApiError &&
        ["PREMIUM_TRIAL_ALREADY_USED", "PREMIUM_TRIAL_NOT_ELIGIBLE"].includes(
          reason.code,
        )
      ) {
        setOpenScope(null);
        notifyCoachingUsageChanged();
        toast.error(reason.message);
      } else {
        setError("체험을 시작하지 못했어요. 다시 눌러 주세요.");
      }
    } finally {
      if (activation.current === owner) activation.current = null;
      setBusyScope((current) => (current === scope ? null : current));
    }
  }

  return (
    <>
      <Toaster />
      <AdminHomePopup enabled={checkedScope === scope && openScope !== scope} />
      <Dialog.Root
        open={openScope === scope && Boolean(userId)}
        onOpenChange={(open) => {
          if (!open) close();
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className={styles.overlay} />
          <Dialog.Content
            ref={dialogRef}
            className={styles.modal}
            onOpenAutoFocus={(event) => {
              event.preventDefault();
              dialogRef.current?.focus();
            }}
            onInteractOutside={(event) => event.preventDefault()}
            onEscapeKeyDown={(event) => {
              if (busy) event.preventDefault();
            }}
          >
            <div className={styles.viewport}>
              <div className={styles.screen}>
                <div className={styles.safeTop} />
                <header className={styles.header}>
                  <button
                    type="button"
                    aria-label="닫기"
                    className={styles.close}
                    onClick={close}
                    disabled={busy}
                  >
                    <Image
                      src="/figma/premium-trial/close.svg"
                      alt=""
                      width={24}
                      height={24}
                    />
                  </button>
                </header>
                <div className={styles.body}>
                  <div className={styles.headline}>
                    <p className={styles.eyebrow}>
                      <span>신규 가입 혜택</span>
                    </p>
                    <Dialog.Title className={styles.title}>
                      <span>가입 선물로</span>
                      <span>
                        <strong>프리미엄 3일</strong>을 드려요
                      </span>
                    </Dialog.Title>
                    <Dialog.Description className={styles.description}>
                      코칭 횟수 제한 없이 마음껏 연습해 보세요
                    </Dialog.Description>
                  </div>
                  <div className={styles.illustration} aria-hidden="true">
                    <Image
                      src="/figma/premium-trial/glow.svg"
                      alt=""
                      width={400}
                      height={400}
                      className={styles.glow}
                    />
                    {/* Brand badge in place of character art. */}
                    <div className={styles.badge}>
                      <Crown size={56} strokeWidth={1.75} />
                    </div>
                  </div>
                  <div className={styles.cardWrap}>
                    <section
                      className={styles.card}
                      aria-label="프리미엄 체험 혜택"
                    >
                      <div className={styles.cardHead}>
                        <Image
                          src="/figma/premium-trial/crown.svg"
                          alt=""
                          width={22.4069}
                          height={18}
                        />
                        <strong>프리미엄</strong>
                        <p className={styles.count}>
                          코칭 <b>무제한</b>
                        </p>
                      </div>
                      <div className={styles.divider} />
                      <dl className={styles.facts}>
                        <div>
                          <dt>이용 기간</dt>
                          <dd>3일</dd>
                        </div>
                        <div>
                          <dt>체험 종료 후</dt>
                          <dd>자동 결제 없음</dd>
                        </div>
                        <div>
                          <dt>이용 요금</dt>
                          <dd>0원</dd>
                        </div>
                      </dl>
                    </section>
                    <div
                      className={styles.note}
                      role={error ? "alert" : undefined}
                    >
                      {error}
                    </div>
                  </div>
                </div>
                <footer className={styles.footer}>
                  <button
                    type="button"
                    onClick={() => void startTrial()}
                    className={styles.start}
                    disabled={busy}
                    aria-busy={busy}
                  >
                    <Image
                      src="/figma/premium-trial/sparkle.svg"
                      alt=""
                      width={20}
                      height={20}
                    />
                    <span>
                      {busy
                        ? "프리미엄 시작 중…"
                        : "프리미엄으로 연습 시작하기"}
                    </span>
                  </button>
                  <Link
                    href="/mypage/payments?view=purchase"
                    className={styles.details}
                    aria-disabled={busy}
                    onClick={(event) => {
                      if (busy) event.preventDefault();
                      else close();
                    }}
                  >
                    프리미엄 혜택 자세히 보기
                  </Link>
                </footer>
              </div>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}
