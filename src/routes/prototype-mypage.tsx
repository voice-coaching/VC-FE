"use client";
import { PrototypeBottomNav } from "@/components/prototype-bottom-nav";

import Link from "next/link";
import { Settings } from "lucide-react";
import { useEffect, useState } from "react";
import { IPhoneFrame } from "@/components/iphone-frame";
import { PracticeHistoryContent } from "./prototype-history";
import styles from "./prototype-mypage.module.css";
import { PracticePlanEditor } from "./practice-plan-editor";
import {
  initialPlan,
  parsePracticePlan,
  planFields,
  planKey,
} from "@/lib/practice-plan";

const tabs = ["리포트", "연습 기록", "연습 계획"];
const card = "rounded-[20px] bg-white p-[18px]";
export default function PrototypeMyPage() {
  const [tab, setTab] = useState(0);
  const [plan, setPlan] = useState(initialPlan);
  const [editing, setEditing] = useState(false);
  useEffect(() => {
    const syncTab = () => {
      const value = new URLSearchParams(window.location.search).get("tab");
      setTab(value === "history" ? 1 : value === "plan" ? 2 : 0);
    };
    syncTab();
    window.addEventListener("popstate", syncTab);
    return () => window.removeEventListener("popstate", syncTab);
  }, []);
  function selectTab(index: number) {
    setTab(index);
    const url = new URL(window.location.href);
    url.searchParams.set("tab", ["report", "history", "plan"][index]);
    window.history.replaceState(null, "", url.pathname + url.search + url.hash);
  }
  useEffect(() => {
    try {
      setPlan(parsePracticePlan(localStorage.getItem(planKey)));
    } catch {
      /* The example plan remains available. */
    }
  }, []);

  if (editing) {
    return (
      <IPhoneFrame>
        <PracticePlanEditor
          plan={plan}
          onBack={() => setEditing(false)}
          onSave={(saved) => {
            setPlan(saved);
            setEditing(false);
          }}
        />
      </IPhoneFrame>
    );
  }

  return (
    <IPhoneFrame>
      <section className="flex h-full flex-col bg-[#fafbfc] text-[#191f28]">
        <div className="h-11 shrink-0" aria-hidden="true" />
        <header className="relative flex h-12 shrink-0 items-center px-5">
          <h1 className="text-[17px] font-bold">마이</h1>
          <Link
            href="/mypage/settings?preview=1"
            aria-label="설정"
            className="absolute right-5 flex size-11 items-center justify-center rounded-full active:bg-[#f2f4f6]"
          >
            <Settings size={24} />
          </Link>
        </header>
        <div className="shrink-0 bg-[#fafbfc] px-5 pt-2 pb-3">
          <div
            role="tablist"
            aria-label="마이 메뉴"
            className="relative flex rounded-full bg-[#f2f4f6] p-1"
          >
            <span
              aria-hidden="true"
              className={styles.indicator}
              style={{ transform: `translateX(${tab * 100}%)` }}
            />
            {tabs.map((label, index) => (
              <button
                key={label}
                id={`my-tab-${index}`}
                role="tab"
                aria-selected={tab === index}
                aria-controls={`my-panel-${index}`}
                tabIndex={tab === index ? 0 : -1}
                onClick={() => selectTab(index)}
                onKeyDown={(event) => {
                  if (
                    !["ArrowLeft", "ArrowRight", "Home", "End"].includes(
                      event.key,
                    )
                  )
                    return;
                  event.preventDefault();
                  const next =
                    event.key === "Home"
                      ? 0
                      : event.key === "End"
                        ? 2
                        : (tab + (event.key === "ArrowRight" ? 1 : 2)) % 3;
                  selectTab(next);
                  document.getElementById(`my-tab-${next}`)?.focus();
                }}
                className={`relative min-h-10 flex-1 rounded-full text-sm font-bold transition-colors ${tab === index ? "text-[#191f28]" : "text-[#8b95a1]"}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <main className="min-h-0 flex-1 overflow-y-auto px-5 pt-1 pb-6">
          <div
            key={tab}
            id={`my-panel-${tab}`}
            role="tabpanel"
            aria-labelledby={`my-tab-${tab}`}
            className={styles.panel}
          >
            {tab === 0 && (
              <>
                <section className={card}>
                  <p className="flex items-baseline gap-2 font-bold">
                    <strong className="text-[28px] text-[#2f6bff]">
                      3일째
                    </strong>
                    <span className="text-base">연속 연습 중이에요</span>
                  </p>
                  <p className="mt-3 flex items-center gap-3 text-sm font-semibold text-[#6b7684]">
                    총 12회 연습
                    <span className="h-3 w-px bg-[#ccd9ff]" />
                    2시간 40분
                  </p>
                </section>
                <h2 className="mt-4 mb-3 text-base font-bold">
                  내 발음 리포트
                </h2>
                <section className={`${card} space-y-5`}>
                  {[
                    {
                      label: "잘하는 발음",
                      tags: ["모음", "자음 첫소리"],
                      color: "bg-[#e4f5ee] text-[#168c6b]",
                    },
                    {
                      label: "자주 틀리는 발음",
                      tags: ["받침 ㄹ", "된소리"],
                      color: "bg-[#fceee5] text-[#b8581b]",
                    },
                    {
                      label: "억양 특성",
                      tags: ["문장 끝을 올려 읽는 편"],
                      color: "bg-[#e8edff] text-[#4863cf]",
                    },
                  ].map((group) => (
                    <div key={group.label}>
                      <h3 className="mb-2 text-xs font-medium text-[#8b95a1]">
                        {group.label}
                      </h3>
                      <div className="flex flex-wrap gap-1.5">
                        {group.tags.map((tag) => (
                          <span
                            key={tag}
                            className={`rounded-full px-3 py-2 text-sm font-bold ${group.color}`}
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </section>
              </>
            )}
            {tab === 1 && <PracticeHistoryContent />}
            {tab === 2 && (
              <section className={card}>
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-base font-bold">내 연습 계획</h2>
                  <button
                    className="min-h-8 px-1 text-sm font-semibold text-[#2444a7]"
                    onClick={() => setEditing(true)}
                  >
                    수정
                  </button>
                </div>
                <dl className="space-y-4 text-sm">
                  {planFields.map(([key, label]) => (
                    <div
                      key={key}
                      className="flex items-start justify-between gap-4"
                    >
                      <dt className="shrink-0 text-[#6b7684]">{label}</dt>
                      <dd className="text-right font-semibold">{plan[key]}</dd>
                    </div>
                  ))}
                </dl>
              </section>
            )}
          </div>
        </main>
        <PrototypeBottomNav />
      </section>
    </IPhoneFrame>
  );
}
