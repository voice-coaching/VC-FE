"use client";

import PortOne from "@portone/browser-sdk/v2";
import { Capacitor } from "@capacitor/core";
import {
  ChevronLeft,
  CreditCard,
  ReceiptText,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { BackButton } from "@/components/back-button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  api,
  type PaymentActionResult,
  type PaymentHistoryItem,
  type UserAccount,
} from "@/lib/api";
import { getAuthenticatedUserId, getCachedUser } from "@/lib/auth-session";
import { cacheResources } from "@/lib/cache-resources";
import { readUserClientCache, writeUserClientCache } from "@/lib/client-cache";
import { paymentErrorMessage, runPaymentRequest } from "@/lib/payment";

type PaymentDialog = {
  kind: "cancel" | "refund";
  order: PaymentHistoryItem;
};

const WON = new Intl.NumberFormat("ko-KR");

function formatWon(value: number) {
  return `${WON.format(value)}원`;
}

function formatDate(value: string | null, includeTime = false) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "long",
    day: "numeric",
    ...(includeTime
      ? { hour: "2-digit", minute: "2-digit", hour12: false }
      : {}),
  }).format(date);
}

const membershipCopy = {
  free: {
    label: "무료 이용 중",
    description:
      "월간 이용권을 결제하면 30일 동안 유료 기능을 이용할 수 있어요.",
  },
  paid: {
    label: "월간 이용권 이용 중",
    description: "자동 갱신되지 않으며 만료 후 무료 이용권으로 전환돼요.",
  },
  admin: {
    label: "테스트 이용등급 이용 중",
    description:
      "테스트용 이용등급이며 관리자 권한과는 별개예요. 자동 결제되지 않아요.",
  },
} as const;

const orderStatusCopy = {
  PENDING: { label: "결제 확인 중", className: "bg-[#fff4e5] text-[#b54708]" },
  PAID: { label: "결제 완료", className: "bg-[#e8f7ef] text-[#087443]" },
  FAILED: { label: "결제 실패", className: "bg-[#fff0f1] text-[#c4323f]" },
  CANCELLED: { label: "취소 완료", className: "bg-[#f2f4f6] text-[#6b7684]" },
} as const;

export default function PaymentsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const userId = getAuthenticatedUserId();
  const redirectPaymentId = searchParams.get("paymentId");
  const redirectCode = searchParams.get("code");
  const redirectMessage = searchParams.get("message");
  const [account, setAccount] = useState<UserAccount | null>(getCachedUser);
  const [orders, setOrders] = useState<PaymentHistoryItem[]>([]);
  const [page, setPage] = useState(0);
  const [hasNext, setHasNext] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [rateLimitSeconds, setRateLimitSeconds] = useState<number | null>(null);
  const [retry, setRetry] = useState(0);
  const [dialog, setDialog] = useState<PaymentDialog | null>(null);
  const [reason, setReason] = useState("");
  const [actionResults, setActionResults] = useState<
    Record<string, PaymentActionResult>
  >(
    () =>
      readUserClientCache<Record<string, PaymentActionResult>>(
        userId,
        cacheResources.paymentActions,
      ) ?? {},
  );
  const createKey = useRef<string | null>(null);
  const handledRedirect = useRef<string | null>(null);
  const skipCleanNavigation = useRef(false);

  function rememberAction(orderId: string, result: PaymentActionResult) {
    setActionResults((current) => {
      const updated = { ...current, [orderId]: result };
      writeUserClientCache(userId, cacheResources.paymentActions, updated);
      return updated;
    });
  }

  const rateLimitMessage = useCallback((seconds: number) => {
    setRateLimitSeconds(seconds);
    setNotice(`${seconds}초 후 자동으로 다시 시도할게요.`);
  }, []);

  const readFirstPage = useCallback(
    async (active: () => boolean) => {
      const freshAccount = await api.users.getMe();
      if (active()) setAccount(freshAccount);
      const history = await runPaymentRequest(
        () => api.payments.listOrders({ page: 0, size: 20 }),
        { onRateLimit: rateLimitMessage },
      );
      if (!active()) return;
      setOrders(history.items);
      setPage(history.page);
      setHasNext(Boolean(history.hasNext));
      setRateLimitSeconds(null);
    },
    [rateLimitMessage],
  );

  useEffect(() => {
    if (skipCleanNavigation.current && !redirectPaymentId && !redirectCode) {
      skipCleanNavigation.current = false;
      return;
    }
    let active = true;
    const isActive = () => active;
    setLoading(true);
    setError(null);

    void (async () => {
      const redirectKey = `${redirectPaymentId ?? ""}:${redirectCode ?? ""}`;
      const hasRedirectResult = Boolean(redirectPaymentId || redirectCode);
      try {
        if (hasRedirectResult && handledRedirect.current !== redirectKey) {
          handledRedirect.current = redirectKey;
          if (redirectCode) {
            setError(redirectMessage || "결제가 완료되지 않았습니다.");
          } else if (redirectPaymentId) {
            setBusy(`verify:${redirectPaymentId}`);
            const verified = await runPaymentRequest(
              () => api.payments.verifyOrder(redirectPaymentId),
              { onRateLimit: rateLimitMessage },
            );
            if (!active) return;
            if (verified.status === "PAID") {
              createKey.current = null;
              setNotice("결제가 확인되어 월간 이용권이 적용됐어요.");
            } else {
              setNotice(
                "결제 결과를 확인 중이에요. 잠시 후 내역에서 다시 확인해 주세요.",
              );
            }
          }
        }
        await readFirstPage(isActive);
      } catch (reason) {
        if (active) setError(paymentErrorMessage(reason));
      } finally {
        if (active) {
          setBusy(null);
          setLoading(false);
          if (hasRedirectResult) {
            skipCleanNavigation.current = true;
            router.replace("/mypage/payments", { scroll: false });
          }
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [
    readFirstPage,
    rateLimitMessage,
    redirectCode,
    redirectMessage,
    redirectPaymentId,
    retry,
    router,
  ]);

  async function refreshPage(successMessage?: string) {
    setBusy("refresh");
    setError(null);
    try {
      await readFirstPage(() => true);
      if (successMessage) setNotice(successMessage);
    } catch (reason) {
      setError(paymentErrorMessage(reason));
    } finally {
      setBusy(null);
    }
  }

  async function startPayment() {
    if (busy) return;
    createKey.current ??= crypto.randomUUID();
    setBusy("purchase");
    setError(null);
    setNotice(null);
    try {
      const order = await runPaymentRequest(
        () => api.payments.createOrder(createKey.current as string),
        { onRateLimit: rateLimitMessage },
      );
      const response = await PortOne.requestPayment({
        storeId: order.storeId,
        channelKey: order.channelKey,
        paymentId: order.orderId,
        orderName: order.orderName,
        totalAmount: order.totalAmount,
        currency: order.currency,
        payMethod: "CARD",
        redirectUrl: new URL("/mypage/payments", window.location.origin).href,
        appScheme: Capacitor.isNativePlatform() ? "speakai" : undefined,
        customer: account
          ? {
              customerId: String(account.id),
              fullName: account.nickname,
              email: account.email ?? undefined,
            }
          : undefined,
      });
      if (!response) throw new Error("결제창 응답을 확인하지 못했습니다.");
      if (response.code)
        throw new Error(response.message || "결제가 완료되지 않았습니다.");
      if (response.paymentId !== order.orderId)
        throw new Error("결제 주문 정보가 일치하지 않습니다.");

      const verified = await runPaymentRequest(
        () => api.payments.verifyOrder(order.orderId),
        { onRateLimit: rateLimitMessage },
      );
      if (verified.status !== "PAID") {
        setNotice(
          "결제 결과를 확인 중이에요. 내역의 ‘결제 상태 확인’을 눌러 주세요.",
        );
      } else {
        createKey.current = null;
        await refreshPage("결제가 확인되어 월간 이용권이 적용됐어요.");
      }
    } catch (reason) {
      setError(paymentErrorMessage(reason));
    } finally {
      setBusy(null);
      setRateLimitSeconds(null);
    }
  }

  async function verifyPending(orderId: string) {
    if (busy) return;
    setBusy(`verify:${orderId}`);
    setError(null);
    try {
      const verified = await runPaymentRequest(
        () => api.payments.verifyOrder(orderId),
        { onRateLimit: rateLimitMessage },
      );
      if (verified.status === "PAID") {
        await refreshPage("결제 완료 상태를 확인했어요.");
      } else {
        setNotice("아직 결제 완료가 확인되지 않았어요.");
      }
    } catch (reason) {
      setError(paymentErrorMessage(reason));
    } finally {
      setBusy(null);
      setRateLimitSeconds(null);
    }
  }

  function openAction(kind: PaymentDialog["kind"], order: PaymentHistoryItem) {
    setReason("");
    setError(null);
    setDialog({ kind, order });
  }

  async function submitAction() {
    if (!dialog || !reason.trim() || busy) return;
    const { kind, order } = dialog;
    setBusy(`${kind}:${order.orderId}`);
    setError(null);
    try {
      const result = await runPaymentRequest(
        () =>
          kind === "cancel"
            ? api.payments.cancel(order.orderId, reason.trim())
            : api.payments.requestRefund(order.orderId, reason.trim()),
        { onRateLimit: rateLimitMessage },
      );
      rememberAction(order.orderId, result);
      setDialog(null);
      setReason("");
      if (result.status === "SUCCEEDED") {
        await refreshPage(
          kind === "cancel" ? "결제 취소가 완료됐어요." : "환불이 완료됐어요.",
        );
      } else {
        setNotice(
          `${kind === "cancel" ? "취소" : "환불"} 요청을 접수했어요. 처리 상태를 다시 확인해 주세요.`,
        );
      }
    } catch (reason) {
      setError(paymentErrorMessage(reason));
    } finally {
      setBusy(null);
      setRateLimitSeconds(null);
    }
  }

  async function readActionStatus(orderId: string) {
    const current = actionResults[orderId];
    if (!current || busy) return;
    setBusy(`status:${orderId}`);
    setError(null);
    try {
      const result = await runPaymentRequest(
        () => api.payments.getRefundRequest(current.requestId),
        { onRateLimit: rateLimitMessage },
      );
      rememberAction(orderId, result);
      if (result.status === "SUCCEEDED") {
        await refreshPage("취소·환불 완료 상태를 확인했어요.");
      } else {
        setNotice(`현재 처리 상태는 ${result.status}입니다.`);
      }
    } catch (reason) {
      setError(paymentErrorMessage(reason));
    } finally {
      setBusy(null);
      setRateLimitSeconds(null);
    }
  }

  async function loadMore() {
    if (!hasNext || loadingMore || busy) return;
    setLoadingMore(true);
    setError(null);
    try {
      const next = await runPaymentRequest(
        () => api.payments.listOrders({ page: page + 1, size: 20 }),
        { onRateLimit: rateLimitMessage },
      );
      setOrders((current) => [...current, ...next.items]);
      setPage(next.page);
      setHasNext(Boolean(next.hasNext));
    } catch (reason) {
      setError(paymentErrorMessage(reason));
    } finally {
      setLoadingMore(false);
      setRateLimitSeconds(null);
    }
  }

  const membership = account
    ? membershipCopy[account.membershipType]
    : membershipCopy.free;

  return (
    <AppShell
      nav={false}
      viewportLocked
      chromeColor="#f2f4f6"
      className="flex flex-col overflow-hidden bg-[#f2f4f6] text-[#191f28]"
    >
      <header className="relative flex h-12 shrink-0 items-center bg-white px-2 py-1">
        <BackButton
          fallback="/mypage/settings"
          className="flex size-10 items-center justify-center"
        >
          <ChevronLeft aria-hidden className="size-6" />
        </BackButton>
        <h1 className="pointer-events-none absolute inset-x-12 text-center text-[17px] leading-6 font-bold">
          이용권 · 결제
        </h1>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 pt-4 pb-8">
        <section className="overflow-hidden rounded-[24px] bg-[linear-gradient(145deg,#2f6bff,#6c8fff)] p-5 text-white shadow-[0_12px_30px_rgba(47,107,255,0.18)]">
          <div className="flex items-start justify-between gap-3">
            <div>
              <span className="inline-flex rounded-full bg-white/18 px-2.5 py-1 text-xs font-bold">
                {account?.membershipEnvironment === "TEST" ? "TEST" : "이용권"}
              </span>
              <h2 className="mt-3 text-xl leading-7 font-bold">
                {loading && !account ? "이용권 확인 중…" : membership.label}
              </h2>
            </div>
            <ShieldCheck aria-hidden className="size-9 text-white/90" />
          </div>
          <p className="mt-2 text-sm leading-6 text-white/82">
            {membership.description}
          </p>
          {account?.membershipType === "paid" ? (
            <p className="mt-4 text-sm font-bold">
              {account.membershipExpiresAt
                ? `${formatDate(account.membershipExpiresAt)}까지`
                : "만료일 확인 중"}
            </p>
          ) : null}
        </section>

        <section className="mt-3 rounded-[20px] bg-white p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[15px] font-bold">월간 이용권</p>
              <p className="mt-1 text-[13px] leading-5 text-[#6b7684]">
                30일 이용 · 자동 갱신 없음
              </p>
            </div>
            <p className="text-lg font-extrabold">15,000원</p>
          </div>
          <button
            type="button"
            disabled={Boolean(busy) || loading}
            onClick={() => void startPayment()}
            className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary text-[15px] font-bold text-white disabled:opacity-50"
          >
            <CreditCard aria-hidden className="size-5" />
            {busy === "purchase"
              ? rateLimitSeconds
                ? `${rateLimitSeconds}초 후 재시도 중`
                : "결제 준비 중…"
              : account?.membershipType === "paid"
                ? "이용권 추가 결제"
                : account?.membershipType === "admin"
                  ? "테스트 결제 체험"
                  : "월간 이용권 결제"}
          </button>
          <p className="mt-2 text-center text-[11px] leading-4 text-[#8b95a1]">
            포트원 V2 TEST 결제이며 실제 서비스 결제로 전환되지 않습니다.
          </p>
        </section>

        <div aria-live="polite" className="mt-3 space-y-2">
          {notice ? (
            <p className="rounded-2xl bg-[#edf2ff] px-4 py-3 text-[13px] leading-5 text-primary">
              {notice}
            </p>
          ) : null}
          {error ? (
            <div className="rounded-2xl bg-[#fff0f1] px-4 py-3 text-[13px] leading-5 text-destructive">
              <p role="alert">{error}</p>
              <button
                type="button"
                disabled={loading || Boolean(busy)}
                onClick={() => setRetry((value) => value + 1)}
                className="mt-1 min-h-10 font-bold text-primary disabled:opacity-50"
              >
                다시 불러오기
              </button>
            </div>
          ) : null}
        </div>

        <section className="mt-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-[17px] font-bold">
              <ReceiptText aria-hidden className="size-5 text-primary" />
              결제 내역
            </h2>
            <button
              type="button"
              aria-label="결제 내역 새로고침"
              disabled={loading || Boolean(busy)}
              onClick={() => void refreshPage()}
              className="flex size-10 items-center justify-center rounded-full bg-white text-[#6b7684] disabled:opacity-50"
            >
              <RefreshCw
                aria-hidden
                className={`size-[18px] ${busy === "refresh" ? "animate-spin" : ""}`}
              />
            </button>
          </div>

          {loading ? (
            <div
              role="status"
              className="rounded-[20px] bg-white p-5 text-sm text-[#8b95a1]"
            >
              결제 내역을 불러오는 중…
            </div>
          ) : orders.length === 0 ? (
            <div className="rounded-[20px] bg-white px-5 py-10 text-center">
              <CreditCard
                aria-hidden
                className="mx-auto size-8 text-[#b0b8c1]"
              />
              <p className="mt-3 text-sm font-bold">아직 결제 내역이 없어요</p>
              <p className="mt-1 text-xs text-[#8b95a1]">
                월간 이용권을 결제하면 여기에 표시됩니다.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {orders.map((order) => {
                const status = orderStatusCopy[order.status];
                const action = actionResults[order.orderId];
                return (
                  <article
                    key={order.orderId}
                    className="rounded-[20px] bg-white p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-[15px] font-bold">
                          {order.orderName}
                        </p>
                        <p className="mt-1 text-xs text-[#8b95a1]">
                          {formatDate(order.createdAt, true)} · TEST
                        </p>
                      </div>
                      <span
                        className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${status.className}`}
                      >
                        {status.label}
                      </span>
                    </div>
                    <div className="mt-4 flex items-center justify-between border-t border-[#f2f4f6] pt-3">
                      <span className="text-xs text-[#6b7684]">
                        {order.expiresAt
                          ? `${formatDate(order.expiresAt)}까지`
                          : order.orderId}
                      </span>
                      <strong className="text-[15px]">
                        {formatWon(order.totalAmount)}
                      </strong>
                    </div>

                    {action ? (
                      <div className="mt-3 rounded-xl bg-[#f7f8fa] px-3 py-2.5 text-xs leading-5 text-[#6b7684]">
                        취소·환불 상태: <b>{action.status}</b>
                        {action.status === "PENDING" ||
                        action.status === "UNKNOWN" ? (
                          <button
                            type="button"
                            disabled={Boolean(busy)}
                            onClick={() => void readActionStatus(order.orderId)}
                            className="ml-2 min-h-8 font-bold text-primary disabled:opacity-50"
                          >
                            상태 확인
                          </button>
                        ) : null}
                      </div>
                    ) : null}

                    {order.status === "PENDING" ? (
                      <button
                        type="button"
                        disabled={Boolean(busy)}
                        onClick={() => void verifyPending(order.orderId)}
                        className="mt-3 h-10 w-full rounded-xl bg-[#edf2ff] text-sm font-bold text-primary disabled:opacity-50"
                      >
                        {busy === `verify:${order.orderId}`
                          ? "확인 중…"
                          : "결제 상태 확인"}
                      </button>
                    ) : order.status === "PAID" && !action ? (
                      <div className="mt-3 grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          disabled={Boolean(busy)}
                          onClick={() => openAction("cancel", order)}
                          className="h-10 rounded-xl bg-[#f2f4f6] text-sm font-bold text-[#4e5968] disabled:opacity-50"
                        >
                          결제 취소
                        </button>
                        <button
                          type="button"
                          disabled={Boolean(busy)}
                          onClick={() => openAction("refund", order)}
                          className="h-10 rounded-xl bg-[#edf2ff] text-sm font-bold text-primary disabled:opacity-50"
                        >
                          환불 신청
                        </button>
                      </div>
                    ) : null}
                  </article>
                );
              })}
              {hasNext ? (
                <button
                  type="button"
                  disabled={loadingMore || Boolean(busy)}
                  onClick={() => void loadMore()}
                  className="h-11 w-full rounded-xl bg-white text-sm font-bold text-primary disabled:opacity-50"
                >
                  {loadingMore ? "불러오는 중…" : "내역 더 보기"}
                </button>
              ) : null}
            </div>
          )}
        </section>
      </div>

      <Dialog
        open={dialog !== null}
        onOpenChange={(open) => {
          if (!open && !busy) setDialog(null);
        }}
      >
        <DialogContent className="max-w-[360px] rounded-3xl border-0 bg-white p-6 text-[#191f28]">
          <DialogHeader>
            <DialogTitle>
              {dialog?.kind === "cancel" ? "결제 취소" : "환불 신청"}
            </DialogTitle>
            <DialogDescription className="text-left leading-5 text-[#6b7684]">
              전액 15,000원을 요청합니다. 완료되면 paid 이용등급은 free로 전환될
              수 있어요.
            </DialogDescription>
          </DialogHeader>
          <label className="text-sm font-bold" htmlFor="payment-action-reason">
            사유
          </label>
          <textarea
            id="payment-action-reason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            maxLength={200}
            placeholder="취소 또는 환불 사유를 입력해 주세요."
            className="min-h-24 resize-none rounded-xl border border-[#e5e8eb] p-3 text-sm leading-5 outline-none focus:border-primary"
          />
          <div className="flex items-center justify-between text-xs text-[#8b95a1]">
            <span>1~200자</span>
            <span>{reason.length}/200</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              disabled={Boolean(busy)}
              onClick={() => setDialog(null)}
              className="h-12 rounded-xl bg-[#f2f4f6] text-sm font-bold disabled:opacity-50"
            >
              닫기
            </button>
            <button
              type="button"
              disabled={!reason.trim() || Boolean(busy)}
              onClick={() => void submitAction()}
              className="h-12 rounded-xl bg-primary text-sm font-bold text-white disabled:opacity-50"
            >
              {busy?.startsWith("cancel:") || busy?.startsWith("refund:")
                ? "요청 중…"
                : "전액 요청"}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
