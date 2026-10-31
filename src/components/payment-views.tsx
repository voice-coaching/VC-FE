"use client";

import Image from "next/image";
import Link from "next/link";
import { Fragment, useState, type ReactNode } from "react";
import { BackButton } from "@/components/back-button";
import { MembershipCard } from "@/components/membership-card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type {
  PaymentActionResult,
  PaymentHistoryItem,
  PaymentOrder,
  UserAccount,
} from "@/lib/api";
import { paymentActionStatusLabel } from "@/lib/payment";
import styles from "./membership.module.css";

export type PaymentView =
  "history" | "purchase" | "manage" | "detail" | "refund" | "success" | "error";
export type DisplayPaymentOrder = PaymentOrder | PaymentHistoryItem;

const statusLabels = {
  PENDING: "결제 확인 중",
  PAID: "결제 완료",
  FAILED: "결제 실패",
  CANCELLED: "취소 완료",
};
export const formatPaymentAmount = (value: number) =>
  `${new Intl.NumberFormat("ko-KR").format(value)}원`;

function date(
  value: string | null | undefined,
  kind: "month" | "day" | "short" | "full" = "day",
) {
  if (!value || Number.isNaN(new Date(value).getTime())) return "—";
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    ...(kind === "month"
      ? { year: "numeric", month: "long" }
      : kind === "full"
        ? {
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
          }
        : { month: "numeric", day: "numeric" }),
  }).format(new Date(value));
}

function Icon({
  name,
  width,
  height = width,
  className,
}: {
  name: string;
  width: number;
  height?: number;
  className?: string;
}) {
  return (
    <Image
      src={`/figma/membership/${name}.svg`}
      alt=""
      width={width}
      height={height}
      className={className}
    />
  );
}

function Nav({
  title,
  fallback = "/mypage",
  close = false,
  large = false,
}: {
  title: string;
  fallback?: string;
  close?: boolean;
  large?: boolean;
}) {
  return (
    <header className={styles.nav}>
      <BackButton
        fallback={fallback}
        aria-label={close ? "닫기" : "뒤로"}
        className={styles.back}
      >
        <Icon
          name={close ? "close" : large ? "nav-back" : "back"}
          width={close ? 18 : large ? 24 : 22}
        />
      </BackButton>
      <h1>{title}</h1>
      <span />
    </header>
  );
}

function Info({ rows }: { rows: Array<[string, ReactNode]> }) {
  return (
    <dl className={styles.info}>
      {rows.map(([label, value]) => (
        <div key={label} className={styles.infoRow}>
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

type Props = {
  view: PaymentView;
  account: UserAccount | null;
  orders: PaymentHistoryItem[];
  selected: DisplayPaymentOrder | null;
  actions: Record<string, PaymentActionResult>;
  loading: boolean;
  loadingMore: boolean;
  hasNext: boolean;
  busy: string | null;
  error: string | null;
  notice: string | null;
  activePass: boolean;
  onNavigate: (view: PaymentView, orderId?: string) => void;
  onPurchase: () => void;
  onRefresh: () => void;
  onMore: () => void;
  onVerify: (orderId: string) => void;
  onAction: (kind: "cancel" | "refund", order: DisplayPaymentOrder) => void;
  onReadAction: (orderId: string) => void;
};

export function PaymentViews(props: Props) {
  const {
    view,
    account,
    orders,
    selected,
    actions,
    busy,
    loading,
    error,
    notice,
    activePass,
    onNavigate,
  } = props;
  const verifying = busy?.startsWith("verify:");
  const action = selected ? actions[selected.orderId] : undefined;
  const pendingAction =
    action?.status === "PENDING" || action?.status === "UNKNOWN";
  const [conditions, setConditions] = useState(false);
  const title =
    view === "purchase"
      ? ""
      : view === "manage"
        ? "프리미엄 관리"
        : view === "detail"
          ? "결제 상세"
          : view === "refund"
            ? "환불 상태"
            : "결제 내역";
  return (
    <div
      className={`${styles.screen} ${["purchase", "success", "error"].includes(view) ? styles.gradient : ""}`}
    >
      {verifying ? (
        <div className={styles.center} role="status">
          <Icon name="spinner" width={72} className={styles.spin} />
          <h2>결제를 확인하고 있어요</h2>
          <p>
            잠시만 기다려 주세요.
            <br />
            확인이 끝나면 이용권이 바로 적용돼요.
          </p>
        </div>
      ) : (
        <>
          {view !== "success" && view !== "error" ? (
            <Nav
              title={title}
              fallback={
                view === "detail" || view === "refund"
                  ? "/mypage/payments"
                  : "/mypage"
              }
              close={view === "purchase"}
              large={view === "manage"}
            />
          ) : null}
          <div className={styles.scroll}>
            {view !== "error" && error ? (
              <div role="alert" className={styles.error}>
                {error}
                <button
                  type="button"
                  className="mt-2 block min-h-10 font-bold"
                  disabled={Boolean(busy)}
                  onClick={props.onRefresh}
                >
                  다시 불러오기
                </button>
              </div>
            ) : null}
            {notice && view !== "success" ? (
              <p role="status" className={styles.notice}>
                {notice}
              </p>
            ) : null}
            {view === "purchase" ? (
              <>
                <section className={styles.headline}>
                  <span className={styles.badge}>발음 집중 연습</span>
                  <h2>
                    준비한 답변을,
                    <br />
                    <em>더 자신 있게 말하도록!</em>
                  </h2>
                  <p>
                    내 답변을 녹음하고 피드백을 받아보세요.
                    <br />
                    다시 말하며 아쉬웠던 발음을 다듬어보세요.
                  </p>
                </section>
                <div className={styles.planWrap}>
                  <section className={styles.planCard}>
                    <span className={`${styles.badge} self-start`}>
                      TEST 이용권
                    </span>
                    <h3>프리미엄</h3>
                    {[
                      "결제일로부터 1개월 이용",
                      "내가 쓴 답변 300자까지 연습",
                      "자동 갱신 없이 한 번만 결제",
                    ].map((label) => (
                      <p className={styles.spec} key={label}>
                        <span className={styles.specCheck}>
                          <Icon name="spec-check" width={10} />
                        </span>
                        {label}
                      </p>
                    ))}
                    <div className={styles.divider} />
                    <p className={styles.price}>
                      <span>1개월 이용권</span>
                      <strong>15,000원</strong>
                    </p>
                  </section>
                </div>
                <h2 className={styles.sectionTitle}>이용권을 확인해 보세요</h2>
                <table className={styles.comparison}>
                  <thead>
                    <tr>
                      <th scope="col">
                        <span className="sr-only">항목</span>
                      </th>
                      <th scope="col">무료</th>
                      <th scope="col">
                        <span className="inline-flex items-center gap-[3px]">
                          <Icon
                            name="compare-crown"
                            width={19.9172}
                            height={16}
                          />
                          프리미엄
                        </span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      ["이용등급", "무료", "유료"],
                      ["이용권 기간", "—", "1개월"],
                      ["자동 갱신", "없음", "없음"],
                      ["결제 금액", "무료", "15,000원"],
                    ].map(([label, free, paid]) => (
                      <tr key={label}>
                        <th scope="row">{label}</th>
                        <td>{free}</td>
                        <td>{paid}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <h2 className={styles.sectionTitle}>이렇게 연습할 수 있어요</h2>
                <div className={styles.benefits}>
                  {[
                    [
                      "어떤 발음을 고칠지 알아보세요",
                      "잘못 읽은 단어와 바른 발음을 함께 확인해요.",
                    ],
                    [
                      "다시 말하고, 달라진 점을 확인하세요",
                      "이전 점수와 비교하며 연습의 변화를 살펴봐요.",
                    ],
                    [
                      "실제로 말할 답변으로 연습하세요",
                      "준비한 자기소개와 면접 답변을 직접 넣을 수 있어요.",
                    ],
                  ].map(([heading, copy], index) => (
                    <section className={styles.benefit} key={heading}>
                      <span>
                        <Icon name="point-crown" width={22.4069} height={18} />
                        POINT 0{index + 1}
                      </span>
                      <h3>{heading}</h3>
                      <p>{copy}</p>
                    </section>
                  ))}
                </div>
                <footer className={`${styles.bottom} ${styles.purchaseBottom}`}>
                  <button
                    type="button"
                    className={styles.primaryButton}
                    disabled={
                      loading || Boolean(busy) || activePass || !account
                    }
                    onClick={props.onPurchase}
                  >
                    {activePass ? "이용권 이용 중" : "15,000원으로 시작하기"}
                  </button>
                  <p>
                    TEST 결제 · 자동 갱신 없음{" "}
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 font-bold"
                      onClick={() => setConditions(true)}
                    >
                      결제 안내
                      <Icon name="note-chevron" width={12} />
                    </button>
                  </p>
                </footer>
              </>
            ) : view === "manage" ? (
              <>
                <div className="px-5 pt-2 pb-6">
                  <MembershipCard account={account} compact />
                </div>
                <div className={styles.band} />
                <div className={styles.manageRow}>
                  이용 종료일<span>{date(account?.membershipExpiresAt)}</span>
                </div>
                <div className={styles.manageRow}>
                  자동 갱신<span>없음</span>
                </div>
                <button
                  type="button"
                  className={styles.manageRow}
                  onClick={() => onNavigate("history")}
                >
                  결제 내역
                  <Icon name="chevron" width={16} />
                </button>
                <div className={styles.band} />
                {!activePass ? (
                  <button
                    type="button"
                    className={styles.manageRow}
                    onClick={() => onNavigate("purchase")}
                  >
                    월간 이용권 알아보기
                    <Icon name="chevron" width={16} />
                  </button>
                ) : null}
              </>
            ) : view === "success" && selected?.status === "PAID" ? (
              <>
                <section className={`${styles.headline} pt-7 pb-6`}>
                  <Icon name="success" width={112} />
                  <h2>
                    프리미엄이
                    <br />
                    <em>시작됐어요!</em>
                  </h2>
                  <p>이제 다음 답변도 이어서 연습해 보세요.</p>
                </section>
                <div className={styles.planWrap}>
                  <section className={styles.planCard}>
                    <h3 className="flex items-center gap-1">
                      <Icon name="point-crown" width={22.4069} height={18} />
                      프리미엄
                    </h3>
                    <div className={styles.divider} />
                    <Info
                      rows={[
                        ["이용 종료일", date(selected.expiresAt)],
                        ["자동 갱신", "없음"],
                        [
                          "결제 금액",
                          formatPaymentAmount(selected.totalAmount),
                        ],
                      ]}
                    />
                  </section>
                </div>
                <footer className={styles.bottom}>
                  <Link href="/my-script" className={styles.primaryButton}>
                    연습 시작하기
                  </Link>
                  <button
                    type="button"
                    className={`${styles.textButton} min-h-11`}
                    onClick={() => onNavigate("history")}
                  >
                    결제 내역 보기
                  </button>
                </footer>
              </>
            ) : view === "error" ? (
              <>
                <div className={styles.center}>
                  <Icon name="error" width={84} />
                  <h2>결제를 완료하지 못했어요</h2>
                  <p role="alert">
                    {error ?? "결제 내역에서 현재 상태를 다시 확인해 주세요."}
                  </p>
                </div>
                <footer className={styles.bottom}>
                  <button
                    type="button"
                    className={styles.primaryButton}
                    disabled={Boolean(busy)}
                    onClick={() =>
                      selected?.status === "PENDING"
                        ? props.onVerify(selected.orderId)
                        : onNavigate("history")
                    }
                  >
                    결제 상태 확인하기
                  </button>
                </footer>
              </>
            ) : view === "detail" && selected ? (
              <>
                <section className={styles.hero}>
                  <p>{selected.orderName}</p>
                  <strong>{formatPaymentAmount(selected.totalAmount)}</strong>
                  <span>{statusLabels[selected.status]}</span>
                </section>
                <div className={styles.band} />
                <Info
                  rows={[
                    [
                      "결제일",
                      date(
                        "paidAt" in selected ? selected.paidAt : null,
                        "full",
                      ),
                    ],
                    ["이용 종료일", date(selected.expiresAt)],
                    ["결제 환경", selected.environment],
                    ["주문 번호", selected.orderId],
                  ]}
                />
                <footer className={styles.bottom}>
                  <button
                    type="button"
                    className={`${styles.textButton} min-h-11`}
                    onClick={() => setConditions(true)}
                  >
                    취소·환불 안내 보기
                  </button>
                  {selected.status === "PENDING" ? (
                    <button
                      type="button"
                      className={styles.primaryButton}
                      disabled={Boolean(busy)}
                      onClick={() => props.onVerify(selected.orderId)}
                    >
                      결제 상태 확인
                    </button>
                  ) : selected.status === "PAID" && !action ? (
                    <>
                      <button
                        type="button"
                        className={styles.secondaryButton}
                        disabled={Boolean(busy)}
                        onClick={() => props.onAction("refund", selected)}
                      >
                        환불 신청하기
                      </button>
                      <button
                        type="button"
                        className={`${styles.textButton} min-h-11`}
                        disabled={Boolean(busy)}
                        onClick={() => props.onAction("cancel", selected)}
                      >
                        전액 결제 취소
                      </button>
                    </>
                  ) : null}
                  {action ? (
                    <button
                      type="button"
                      className={styles.secondaryButton}
                      onClick={() => onNavigate("refund", selected.orderId)}
                    >
                      취소·환불 상태 보기
                    </button>
                  ) : null}
                </footer>
              </>
            ) : view === "refund" && selected && action ? (
              <>
                <section className={styles.hero}>
                  <h2>
                    {action.status === "SUCCEEDED"
                      ? "취소·환불이 완료됐어요"
                      : action.status === "FAILED"
                        ? "취소·환불을 완료하지 못했어요"
                        : action.status === "UNKNOWN"
                          ? "처리 결과를 확인하고 있어요"
                          : "환불을 처리하고 있어요"}
                  </h2>
                  <p>
                    {action.status === "SUCCEEDED"
                      ? "결제 내역에서 완료 상태를 확인할 수 있어요."
                      : "아래에서 현재 처리 상태를 다시 확인할 수 있어요."}
                  </p>
                </section>
                <div
                  className={styles.timeline}
                  data-complete={action.status === "SUCCEEDED"}
                >
                  {[
                    "신청 접수",
                    action.status === "UNKNOWN" ? "확인 필요" : "처리 중",
                    "환불 완료",
                  ].map((label, index) => {
                    const done = index === 0 || action.status === "SUCCEEDED";
                    const current =
                      index === 1 && action.status !== "SUCCEEDED";
                    return (
                      <div
                        className={styles.step}
                        key={index}
                        data-done={done}
                        data-active={current}
                      >
                        <span>
                          {done ? (
                            <Icon name="refund-check" width={12} />
                          ) : (
                            <Icon
                              name={
                                current ? "refund-active" : "refund-waiting"
                              }
                              width={24}
                            />
                          )}
                        </span>
                        <b>{label}</b>
                        {index === 0 ? (
                          <small>{date(action.requestedAt, "short")}</small>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
                <div className={styles.band} />
                <Info
                  rows={[
                    [
                      "요청 금액",
                      formatPaymentAmount(
                        action.amount ?? selected.totalAmount,
                      ),
                    ],
                    ["처리 상태", paymentActionStatusLabel[action.status]],
                    ["마지막 확인", date(action.updatedAt, "full")],
                  ]}
                />
                {pendingAction || action.status === "FAILED" ? (
                  <footer className={styles.bottom}>
                    <button
                      type="button"
                      className={styles.primaryButton}
                      disabled={Boolean(busy)}
                      onClick={() => props.onReadAction(selected.orderId)}
                    >
                      현재 상태 확인
                    </button>
                  </footer>
                ) : null}
              </>
            ) : view === "detail" || view === "refund" || view === "success" ? (
              <p className={styles.empty}>
                {loading
                  ? "결제 정보를 불러오는 중…"
                  : "결제 정보를 확인할 수 없어요."}
                <button
                  type="button"
                  className="mx-auto mt-3 block min-h-11 font-bold text-primary"
                  onClick={() => onNavigate("history")}
                >
                  결제 내역 보기
                </button>
              </p>
            ) : (
              <>
                {loading ? (
                  <p role="status" className={styles.empty}>
                    결제 내역을 불러오는 중…
                  </p>
                ) : orders.length === 0 ? (
                  <p className={styles.empty}>아직 결제 내역이 없어요.</p>
                ) : (
                  orders.map((order, index) => {
                    const month = date(order.createdAt, "month");
                    const action = actions[order.orderId];
                    const pending =
                      action?.status === "PENDING" ||
                      action?.status === "UNKNOWN";
                    return (
                      <Fragment key={order.orderId}>
                        {index === 0 ||
                        date(orders[index - 1].createdAt, "month") !== month ? (
                          <h2 className={styles.month}>{month}</h2>
                        ) : null}
                        <button
                          type="button"
                          className={styles.historyRow}
                          data-cancelled={order.status === "CANCELLED"}
                          onClick={() => onNavigate("detail", order.orderId)}
                        >
                          <span>
                            <strong>{order.orderName}</strong>
                            <small>{date(order.createdAt)}</small>
                          </span>
                          <span>
                            <b>{formatPaymentAmount(order.totalAmount)}</b>
                            <small data-pending={pending}>
                              {pending
                                ? "환불 진행 중"
                                : statusLabels[order.status]}
                            </small>
                          </span>
                        </button>
                      </Fragment>
                    );
                  })
                )}
                {props.hasNext ? (
                  <button
                    type="button"
                    className={`${styles.textButton} mx-5 min-h-12`}
                    disabled={props.loadingMore || Boolean(busy)}
                    onClick={props.onMore}
                  >
                    {props.loadingMore ? "불러오는 중…" : "내역 더 보기"}
                  </button>
                ) : null}
                <footer className={styles.bottom}>
                  <button
                    type="button"
                    className={styles.secondaryButton}
                    onClick={() =>
                      onNavigate(activePass ? "manage" : "purchase")
                    }
                  >
                    {activePass ? "프리미엄 관리" : "프리미엄 혜택 보기"}
                  </button>
                </footer>
              </>
            )}
          </div>
        </>
      )}
      <Dialog open={conditions} onOpenChange={setConditions}>
        <DialogContent className="max-w-[362px] rounded-3xl border-0 bg-white p-6">
          <DialogHeader>
            <DialogTitle>결제·환불 안내</DialogTitle>
            <DialogDescription className="pt-2 text-left leading-6">
              월간 이용권은 15,000원이며 결제일로부터 1개월 동안 이용할 수
              있어요. 자동 갱신되지 않는 TEST 결제입니다. 결제 내역에서 전액
              취소 또는 전액 환불을 요청할 수 있어요.
            </DialogDescription>
          </DialogHeader>
          <button
            type="button"
            className={styles.primaryButton}
            onClick={() => setConditions(false)}
          >
            확인
          </button>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function PaymentCheckoutSheet({
  open,
  onOpenChange,
  onConfirm,
  busy,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  busy: boolean;
}) {
  const [accepted, setAccepted] = useState(false);
  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!busy) {
          setAccepted(false);
          onOpenChange(value);
        }
      }}
    >
      <DialogContent
        overlayClassName="bg-black/45"
        className="top-auto bottom-0 max-h-[90dvh] max-w-[402px] translate-y-0 overflow-y-auto rounded-t-[24px] rounded-b-none border-0 bg-white px-5 pt-3 pb-[max(24px,env(safe-area-inset-bottom))] sm:rounded-t-[24px] sm:rounded-b-none [&>button]:hidden"
        aria-describedby="checkout-description"
      >
        <div className={styles.checkout}>
          <div className={styles.handle} />
          <DialogHeader className="sr-only">
            <DialogTitle>결제 확인</DialogTitle>
            <DialogDescription id="checkout-description">
              TEST 월간 이용권 결제 내용을 확인해 주세요.
            </DialogDescription>
          </DialogHeader>
          <section className={styles.checkoutPlan}>
            <div>
              <h3>
                <Icon name="point-crown" width={22.4069} height={18} />
                프리미엄
              </h3>
              <p>월간 이용권 · TEST</p>
            </div>
            <strong>15,000원</strong>
          </section>
          <Info
            rows={[
              ["이용 기간", "결제일로부터 1개월"],
              ["자동 갱신", "없음"],
              ["오늘 결제 금액", "15,000원"],
            ]}
          />
          <label className={styles.agreement}>
            <input
              type="checkbox"
              checked={accepted}
              onChange={(event) => setAccepted(event.target.checked)}
            />
            TEST 결제이며 자동 갱신되지 않는다는 내용과 전액 취소·환불 안내를
            확인했어요.
          </label>
          <button
            type="button"
            className={styles.primaryButton}
            disabled={!accepted || busy}
            onClick={onConfirm}
          >
            {busy ? "결제 준비 중…" : "프리미엄 시작하기"}
          </button>
          <button
            type="button"
            className={`${styles.textButton} min-h-10`}
            disabled={busy}
            onClick={() => onOpenChange(false)}
          >
            닫기
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
