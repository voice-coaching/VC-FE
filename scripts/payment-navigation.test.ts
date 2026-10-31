import assert from "node:assert/strict";
import test from "node:test";
import {
  paymentBackTarget,
  paymentNavigation,
  type PaymentView,
} from "../src/lib/payment-navigation";

function history(initial: string[]) {
  const entries = [...initial];
  let index = entries.length - 1;
  return {
    get current() {
      return entries[index];
    },
    get entries() {
      return [...entries];
    },
    push(href: string) {
      entries.splice(++index);
      entries.push(href);
    },
    replace(href: string) {
      entries[index] = href;
    },
    back() {
      if (index) index--;
    },
    forward() {
      if (index + 1 < entries.length) index++;
    },
  };
}

test("failed checkout is shown once; confirm, Back and Forward cannot reopen it", () => {
  const router = history(["/mypage", "/mypage/payments?view=purchase"]);
  const failed = paymentNavigation("purchase", "error", "order-1");
  router[failed.method](failed.href);
  assert.equal(router.current, "/mypage/payments?view=error&order=order-1");
  assert.equal(
    router.entries.filter((href) => href.includes("view=error")).length,
    1,
  );

  const acknowledged = paymentNavigation("error", "history", "order-1");
  router[acknowledged.method](acknowledged.href);
  assert.equal(router.current, "/mypage/payments");
  assert.equal(
    router.entries.some((href) => href.includes("view=error")),
    false,
  );
  router.back();
  assert.equal(router.current, "/mypage");
  router.forward();
  assert.equal(router.current, "/mypage/payments");
});

test("payment history's back action returns to MyPage regardless of the checkout entry point", () => {
  for (const previous of [
    "/mypage/settings",
    "/mypage/payments?view=manage",
    "/mypage/payments",
  ]) {
    const router = history([
      "/mypage",
      previous,
      "/mypage/payments?view=purchase",
    ]);
    const failed = paymentNavigation("purchase", "error");
    router[failed.method](failed.href);
    const acknowledged = paymentNavigation("error", "history");
    router[acknowledged.method](acknowledged.href);
    const target = paymentBackTarget("history");
    assert.equal(target, "/mypage");
    router.replace(target!);
    assert.equal(router.current, "/mypage");
    assert.equal(
      router.entries.some((href) => href.includes("view=error")),
      false,
    );
  }
});

test("acknowledging a redirect failure drops callback and order parameters", () => {
  const router = history([
    "/mypage",
    "/mypage/payments?paymentId=order-1&code=PAY_PROCESS_CANCELED&message=cancelled",
  ]);
  router.replace("/mypage/payments?view=error");
  const acknowledged = paymentNavigation("error", "history");
  router[acknowledged.method](acknowledged.href);
  assert.equal(router.current, "/mypage/payments");
  router.back();
  assert.equal(router.current, "/mypage");
  router.forward();
  assert.equal(router.current, "/mypage/payments");
});

test("a later checkout can show its own failure without retaining an acknowledged one", () => {
  const router = history(["/mypage", "/mypage/payments"]);
  for (const order of ["first", "second"]) {
    const purchase = paymentNavigation("history", "purchase");
    router[purchase.method](purchase.href);
    const failure = paymentNavigation("purchase", "error", order);
    router[failure.method](failure.href);
    assert.equal(
      new URL(router.current, "https://app.test").searchParams.get("order"),
      order,
    );
    const acknowledged = paymentNavigation("error", "history");
    router[acknowledged.method](acknowledged.href);
    assert.equal(
      router.entries.some((href) => href.includes("view=error")),
      false,
    );
  }
});

test("success confirmation is also removed from Back history after acknowledgment", () => {
  const router = history(["/mypage", "/mypage/payments?view=purchase"]);
  const success = paymentNavigation("purchase", "success", "paid-order");
  router[success.method](success.href);
  const acknowledged = paymentNavigation("success", "history");
  router[acknowledged.method](acknowledged.href);
  router.back();
  assert.equal(router.current, "/mypage");
});

test("regular order detail navigation retains Back and safely encodes the order ID", () => {
  const detail = paymentNavigation("history", "detail", "order/?&view=error");
  assert.equal(detail.method, "push");
  const url = new URL(detail.href, "https://app.test");
  assert.equal(url.pathname, "/mypage/payments");
  assert.equal(url.searchParams.get("view"), "detail");
  assert.equal(url.searchParams.get("order"), "order/?&view=error");
  for (const view of [
    "detail",
    "refund",
    "manage",
    "purchase",
  ] as PaymentView[]) {
    assert.equal(paymentBackTarget(view), null);
  }
});
