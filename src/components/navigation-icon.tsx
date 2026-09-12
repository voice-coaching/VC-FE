import { X } from "lucide-react";
import Image from "next/image";
import styles from "./navigation-icon.module.css";

/** Header navigation: equal 24px artwork and 44px touch targets. */
export function NavigationIcon({ close = false }: { close?: boolean }) {
  return (
    <span className={styles.icon} aria-hidden="true">
      {close ? (
        <X size={24} strokeWidth={2} />
      ) : (
        <Image
          src="/figma/auth/chevron-left.svg"
          alt=""
          width={24}
          height={24}
        />
      )}
    </span>
  );
}
