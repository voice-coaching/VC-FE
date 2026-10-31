"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { TopBar } from "@/components/top-bar";
import { DirectHistory } from "@/components/direct-history";
import { reportSaves, type ReportSave } from "@/lib/report-saves";
import { api } from "@/lib/api";
export default function SavedPage() {
  const [items, setItems] = useState<Array<ReportSave & { title: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(false);
    void reportSaves
      .list()
      .then(async (saves) => {
        const rows = await Promise.all(
          saves
            .filter((item) => item.source === "SESSION")
            .map(async (item) => {
              const detail = await api.myPage.getTrainingSession(
                item.referenceId,
              );
              return { ...item, title: detail.content.title };
            }),
        );
        if (active) setItems(rows);
      })
      .catch(() => {
        if (active) setError(true);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [retry]);
  return (
    <AppShell chromeColor="#f2f4f6" className="bg-[#f2f4f6]">
      <TopBar to="/home" title="저장" />
      <div className="mx-5 border-b-2 border-[#191f28] py-4 text-center font-bold">
        AI 리포트
      </div>
      <section className="space-y-3 p-5" aria-label="저장한 AI 리포트">
        {loading ? (
          <p role="status">리포트를 불러오는 중이에요</p>
        ) : error ? (
          <button onClick={() => setRetry((value) => value + 1)}>
            불러오지 못했어요. 다시 시도
          </button>
        ) : (
          <>
            {items.map((item) => (
              <Link
                key={item.referenceId}
                href={`/mypage/history/${item.referenceId}?tab=report`}
                className="block rounded-2xl bg-white p-5 font-bold"
              >
                {item.title}
                <span className="mt-2 block text-sm font-normal text-[#8b95a1]">
                  AI 리포트 보기
                </span>
              </Link>
            ))}
            {!items.length && (
              <p className="py-8 text-center text-sm text-[#8b95a1]">
                완료 화면에서 저장한 AI 리포트를 여기서 확인할 수 있어요.
              </p>
            )}
            <DirectHistory savedOnly />
          </>
        )}
      </section>
    </AppShell>
  );
}
