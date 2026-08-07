"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { House, Search, User } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

const TABS = [
  { to: "/home", icon: House, label: "홈" },
  { to: "/class", icon: Search, label: "클래스" },
  { to: "/mypage", icon: User, label: "마이" },
] as const;

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="sticky bottom-0 z-20 border-t border-border bg-background/95 backdrop-blur">
      <ul className="flex items-center justify-around px-6 py-3">
        {TABS.map(({ to, icon: Icon, label }) => {
          const active = pathname === to || pathname.startsWith(`${to}/`);
          return (
            <li key={to}>
              <Link
                href={to}
                aria-label={label}
                className={cn(
                  "flex flex-col items-center gap-1 text-[10px] transition-colors",
                  active ? "text-brand" : "text-muted-foreground",
                )}
              >
                <Icon className="size-6" strokeWidth={active ? 2.2 : 1.6} />
                <span>{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function AppShell({
  children,
  nav = true,
  className,
}: {
  children: ReactNode;
  nav?: boolean;
  className?: string;
}) {
  return (
    <div className="app-shell flex flex-col">
      <main className={cn("flex-1", className)}>{children}</main>
      {nav ? <BottomNav /> : null}
    </div>
  );
}
