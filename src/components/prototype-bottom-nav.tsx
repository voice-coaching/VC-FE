"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./prototype-bottom-nav.module.css";

const tabs = [
  { href: "/home", label: "홈", icon: "tab-home" },
  { href: "/class", label: "클래스", icon: "tab-class" },
  { href: "/mypage", label: "마이", icon: "tab-my" },
] as const;

export function PrototypeBottomNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="주 메뉴" className={styles.nav}>
      <ul className={styles.list}>
        {tabs.map(({ href, label, icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <li key={href} className={styles.item}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={styles.link}
              >
                <span
                  aria-hidden="true"
                  className={styles.icon}
                  style={{
                    maskImage: `url(/figma/home/${icon}.svg)`,
                    WebkitMaskImage: `url(/figma/home/${icon}.svg)`,
                  }}
                />
                <span>{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
