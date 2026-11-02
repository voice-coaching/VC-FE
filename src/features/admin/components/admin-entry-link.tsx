"use client";

import Link from "next/link";
import { ShieldCheck, ChevronRight } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { getAccessToken } from "@/lib/api/client";
import { getAuthSessionSnapshot } from "@/lib/auth-session";
import { adminApi } from "../api";
import { useAdminSession } from "../hooks";

/** A successful server authorization, never a membership label, reveals the entry. */
export function AdminEntryLink() {
  const session = useAdminSession();
  const anonymous =
    getAuthSessionSnapshot().status === "anonymous" && !getAccessToken();
  const access = useQuery({
    queryKey: ["admin", session, "entry"],
    queryFn: ({ signal }) => adminApi.access(signal),
    enabled: !anonymous,
    retry: false,
    staleTime: 0,
    gcTime: 0,
    refetchOnWindowFocus: true,
  });
  if (anonymous || !access.data || access.isError) return null;
  return (
    <section className="bg-white">
      <h2 className="h-8 px-5 py-2 text-[12px] leading-4 font-bold text-[#333d4b]">
        서비스 관리
      </h2>
      <Link
        href="/admin"
        className="flex h-14 w-full items-center gap-3.5 px-5 py-2 text-left"
      >
        <span className="flex size-9 shrink-0 items-center justify-center text-primary">
          <ShieldCheck size={22} aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1 text-[15px] leading-[22px] font-medium">
          관리자 페이지
        </span>
        <ChevronRight size={18} className="text-[#8b95a1]" aria-hidden="true" />
      </Link>
    </section>
  );
}
