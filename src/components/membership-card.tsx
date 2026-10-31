"use client";

import Image from "next/image";
import Link from "next/link";
import type { UserAccount } from "@/lib/api";
import styles from "./membership.module.css";

export function MembershipCard({
  account,
  compact = false,
}: {
  account: UserAccount | null;
  compact?: boolean;
}) {
  const paid = account?.membershipType === "paid";
  const test = account?.membershipType === "admin";
  const expires = account?.membershipExpiresAt
    ? new Intl.DateTimeFormat("ko-KR", {
        timeZone: "Asia/Seoul",
        month: "numeric",
        day: "numeric",
      }).format(new Date(account.membershipExpiresAt))
    : null;
  return (
    <section className={styles.membershipCard} aria-label="내 이용권">
      <div className={styles.cardHead}>
        <p>내 이용권</p>
        <span className={styles.badge}>
          {paid || test ? (
            <Image
              src="/figma/membership/crown.svg"
              alt=""
              width={18}
              height={14.4598}
            />
          ) : null}
          {account
            ? paid
              ? "프리미엄 이용 중"
              : test
                ? "테스트 이용 중"
                : "무료 이용 중"
            : "확인 중"}
        </span>
      </div>
      <div className={styles.membershipValue}>
        <strong>
          {account ? (paid ? "1개월" : test ? "테스트 이용등급" : "무료") : "—"}
        </strong>
        {expires ? <span>{expires}까지</span> : null}
      </div>
      {!compact ? (
        <Link
          href={`/mypage/payments?view=${paid || test ? "manage" : "purchase"}`}
          className={paid || test ? styles.softButton : styles.gradientButton}
        >
          {paid || test ? "프리미엄 관리" : "프리미엄 혜택 보기"}
        </Link>
      ) : null}
    </section>
  );
}
