export type PaymentView =
  "history" | "purchase" | "manage" | "detail" | "refund" | "success" | "error";

export function paymentNavigation(
  current: PaymentView,
  next: PaymentView,
  orderId?: string,
) {
  const params = new URLSearchParams();
  if (next !== "history") params.set("view", next);
  if (orderId && next !== "history") params.set("order", orderId);
  // Result pages belong to the checkout entry. Acknowledging one must remove
  // it from Back/Forward history instead of making it the previous screen.
  const resultPage = (view: PaymentView) =>
    view === "error" || view === "success";
  return {
    method:
      resultPage(current) || resultPage(next)
        ? ("replace" as const)
        : ("push" as const),
    href: `/mypage/payments${params.size ? `?${params}` : ""}`,
  };
}

export function paymentBackTarget(view: PaymentView) {
  return view === "history" ? "/mypage" : null;
}
