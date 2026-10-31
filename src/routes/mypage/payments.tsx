"use client";

import PortOne from "@portone/browser-sdk/v2";
import { Capacitor } from "@capacitor/core";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppShell } from "@/components/app-shell";
import {
  PaymentCheckoutSheet,
  PaymentViews,
  type DisplayPaymentOrder,
  type PaymentView,
} from "@/components/payment-views";
import styles from "@/components/membership.module.css";
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
  type PaymentOrder,
  type UserAccount,
} from "@/lib/api";
import { getAuthenticatedUserId, getCachedUser } from "@/lib/auth-session";
import { cacheResources } from "@/lib/cache-resources";
import { readUserClientCache, writeUserClientCache } from "@/lib/client-cache";
import {
  normalizePaymentReason,
  paymentActionStatusLabel,
  paymentErrorMessage,
  paymentVerificationMessage,
  runPaymentRequest,
} from "@/lib/payment";
import { paymentNavigation } from "@/lib/payment-navigation";

type PaymentDialog = {
  kind: "cancel" | "refund";
  order: DisplayPaymentOrder;
};

export default function PaymentsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const userId = getAuthenticatedUserId();
  const redirectPaymentId = searchParams.get("paymentId");
  const redirectCode = searchParams.get("code");
  const redirectMessage = searchParams.get("message");
  const selectedOrderId = searchParams.get("order");
  const requestedView = searchParams.get("view");
  const view: PaymentView =
    requestedView === "purchase" ||
    requestedView === "manage" ||
    requestedView === "detail" ||
    requestedView === "refund" ||
    requestedView === "success" ||
    requestedView === "error"
      ? requestedView
      : "history";
  const [detailOrder, setDetailOrder] = useState<PaymentOrder | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [account, setAccount] = useState<UserAccount | null>(getCachedUser);
  const [orders, setOrders] = useState<PaymentHistoryItem[]>([]);
  const [page, setPage] = useState(0);
  const [hasNext, setHasNext] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
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

  function navigatePayment(next: PaymentView, orderId?: string) {
    const navigation = paymentNavigation(view, next, orderId);
    if (view === "error" || view === "success") {
      setError(null);
      setNotice(null);
      if (next === "history") {
        skipCleanNavigation.current = false;
        setRetry((value) => value + 1);
      }
    }
    router[navigation.method](navigation.href);
  }

  useEffect(() => {
    setDetailLoading(false);
    if (!selectedOrderId) return;
    let active = true;
    setDetailLoading(true);
    void runPaymentRequest(() => api.payments.getOrder(selectedOrderId))
      .then((order) => {
        if (active) setDetailOrder(order);
      })
      .catch((reason) => {
        if (active) setError(paymentErrorMessage(reason));
      })
      .finally(() => {
        if (active) setDetailLoading(false);
      });
    return () => {
      active = false;
    };
  }, [selectedOrderId, retry]);

  function rememberAction(orderId: string, result: PaymentActionResult) {
    setActionResults((current) => {
      const updated = { ...current, [orderId]: result };
      writeUserClientCache(userId, cacheResources.paymentActions, updated);
      return updated;
    });
  }

  const rateLimitMessage = useCallback((seconds: number) => {
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
      await Promise.resolve();
      if (!active) return;
      let completedOrderId: string | null = null;
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
            setDetailOrder(verified);
            if (verified.status === "PAID") createKey.current = null;
            if (verified.status === "PAID") completedOrderId = verified.orderId;
            setNotice(paymentVerificationMessage(verified.status));
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
            router.replace(
              redirectCode
                ? "/mypage/payments?view=error"
                : completedOrderId
                  ? `/mypage/payments?view=success&order=${encodeURIComponent(completedOrderId)}`
                  : "/mypage/payments",
              { scroll: false },
            );
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
    let createdOrderId: string | undefined;
    try {
      const order = await runPaymentRequest(
        () => api.payments.createOrder(createKey.current as string),
        { onRateLimit: rateLimitMessage },
      );
      createdOrderId = order.orderId;
      setDetailOrder(order);
      // A repeated idempotency key returns the original order, including its
      // terminal status. Recover it without opening a second payment window.
      if (order.status !== "PENDING") {
        createKey.current = null;
        await refreshPage(paymentVerificationMessage(order.status));
        navigatePayment(
          order.status === "PAID" ? "success" : "detail",
          order.orderId,
        );
        return;
      }
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

      setBusy(`verify:${order.orderId}`);
      const verified = await runPaymentRequest(
        () => api.payments.verifyOrder(order.orderId),
        { onRateLimit: rateLimitMessage },
      );
      setDetailOrder(verified);
      if (verified.status !== "PENDING") createKey.current = null;
      await refreshPage(paymentVerificationMessage(verified.status));
      navigatePayment(
        verified.status === "PAID" ? "success" : "detail",
        verified.orderId,
      );
    } catch (reason) {
      setError(paymentErrorMessage(reason));
      navigatePayment("error", createdOrderId);
    } finally {
      setBusy(null);
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
      setDetailOrder(verified);
      if (verified.status !== "PENDING") createKey.current = null;
      await refreshPage(paymentVerificationMessage(verified.status));
      navigatePayment(
        verified.status === "PAID" ? "success" : "detail",
        verified.orderId,
      );
    } catch (reason) {
      setError(paymentErrorMessage(reason));
    } finally {
      setBusy(null);
    }
  }

  function openAction(kind: PaymentDialog["kind"], order: DisplayPaymentOrder) {
    setReason("");
    setError(null);
    setDialog({ kind, order });
  }

  async function submitAction() {
    if (!dialog || !reason.trim() || busy) return;
    const { kind, order } = dialog;
    let normalizedReason: string;
    try {
      normalizedReason = normalizePaymentReason(reason);
    } catch (reason) {
      setError(paymentErrorMessage(reason));
      return;
    }
    setBusy(`${kind}:${order.orderId}`);
    setError(null);
    try {
      const result = await runPaymentRequest(
        () =>
          kind === "cancel"
            ? api.payments.cancel(order.orderId, normalizedReason)
            : api.payments.requestRefund(order.orderId, normalizedReason),
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
      navigatePayment("refund", order.orderId);
    } catch (reason) {
      setError(paymentErrorMessage(reason));
    } finally {
      setBusy(null);
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
        setNotice(
          `현재 처리 상태는 ‘${paymentActionStatusLabel[result.status]}’입니다.`,
        );
      }
    } catch (reason) {
      setError(paymentErrorMessage(reason));
    } finally {
      setBusy(null);
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
    }
  }

  const activePass =
    account?.membershipType === "paid" ||
    orders.some(
      (order) =>
        order.status === "PAID" &&
        order.expiresAt !== null &&
        new Date(order.expiresAt).getTime() > Date.now(),
    );
  const historyOrder = orders.find(
    (order) => order.orderId === selectedOrderId,
  );
  const selected =
    detailOrder?.orderId === selectedOrderId
      ? { ...historyOrder, ...detailOrder }
      : (historyOrder ?? null);

  return (
    <AppShell
      nav={false}
      viewportLocked
      chromeColor={
        view === "purchase" || view === "success" ? "#dce7ff" : "#fff"
      }
      className="overflow-hidden bg-white text-[#191f28]"
    >
      <PaymentViews
        view={view}
        account={account}
        orders={orders}
        selected={selected}
        actions={actionResults}
        loading={loading || detailLoading}
        loadingMore={loadingMore}
        hasNext={hasNext}
        busy={busy}
        error={error}
        notice={notice}
        activePass={activePass}
        onNavigate={navigatePayment}
        onPurchase={() => setCheckoutOpen(true)}
        onRefresh={() => setRetry((value) => value + 1)}
        onMore={() => void loadMore()}
        onVerify={(orderId) => void verifyPending(orderId)}
        onAction={openAction}
        onReadAction={(orderId) => void readActionStatus(orderId)}
      />
      <PaymentCheckoutSheet
        open={checkoutOpen}
        onOpenChange={setCheckoutOpen}
        busy={Boolean(busy)}
        onConfirm={() => {
          setCheckoutOpen(false);
          void startPayment();
        }}
      />
      <Dialog
        open={dialog !== null}
        onOpenChange={(open) => {
          if (!open && !busy) setDialog(null);
        }}
      >
        <DialogContent className="max-w-[362px] rounded-3xl border-0 bg-white p-6 text-[#191f28]">
          <DialogHeader>
            <DialogTitle>
              {dialog?.kind === "cancel" ? "결제 취소" : "환불 신청"}
            </DialogTitle>
            <DialogDescription className="text-left leading-5 text-[#6b7684]">
              전액{" "}
              {dialog
                ? new Intl.NumberFormat("ko-KR").format(
                    dialog.order.totalAmount,
                  )
                : "15,000"}
              원을 요청합니다. 완료되면 월간 이용권이 종료될 수 있어요.
            </DialogDescription>
          </DialogHeader>
          <label className="text-sm font-bold" htmlFor="payment-action-reason">
            사유
          </label>
          <input
            id="payment-action-reason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            maxLength={200}
            placeholder="사유를 1~200자로 입력해 주세요."
            className="h-12 rounded-xl border border-[#e5e8eb] px-3 text-sm outline-none focus:border-primary"
          />
          {error ? (
            <p role="alert" className="text-xs text-destructive">
              {error}
            </p>
          ) : null}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              disabled={Boolean(busy)}
              className={styles.secondaryButton}
              onClick={() => setDialog(null)}
            >
              닫기
            </button>
            <button
              type="button"
              disabled={!reason.trim() || Boolean(busy)}
              className={styles.primaryButton}
              onClick={() => void submitAction()}
            >
              {busy ? "요청 중…" : "전액 요청"}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
