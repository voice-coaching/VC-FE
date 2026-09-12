"use client";
import Link from "next/link";
import { useState } from "react";
import { usePrototypeHistory } from "@/hooks/use-prototype-history";
import { modeLabels, todaySummary } from "@/lib/prototype-history";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";

export function PracticeHistoryContent() {
  const { items, error, ready, clear } = usePrototypeHistory();
  const [deleting, setDeleting] = useState(false);
  const today = todaySummary(items);
  return (
    <>
      <div className="space-y-4 pb-4">
        <section className="rounded-2xl bg-[#edf2ff] p-5">
          <h2 className="text-xl font-bold">
            오늘 {today.sentences}문장 연습했어요
          </h2>
          <p className="mt-2 text-sm text-[#3659ad]">
            {today.count}회 완료,{" "}
            {today.dailyDone ? "오늘의 연습 완료" : "나만의 속도로 이어가세요"}
          </p>
        </section>
        <p className="text-xs leading-5 text-[#8b95a1]">
          프로토타입 완료 기록만 최근 100개까지 이 브라우저에 보관해요. 계정에
          동기화하지 않으며, 원고와 음성, 분석 점수는 저장하지 않아요.
        </p>
        {error ? (
          <p role="alert" className="text-sm text-red-600">
            기록을 읽거나 변경하지 못했어요. 브라우저 저장 공간 설정을 확인해
            주세요.
          </p>
        ) : !ready ? (
          <p>기록을 불러오고 있어요.</p>
        ) : items.length === 0 ? (
          <div className="rounded-2xl bg-white p-5">
            <h2 className="font-bold">아직 완료한 연습이 없어요</h2>
            <p className="mt-2 text-sm text-[#4e5968]">
              결과에서 연습 마치기를 누르면 여기에 기록돼요.
            </p>
            <Link
              href="/news/today"
              className="mt-4 flex min-h-12 items-center justify-center rounded-full bg-[#2f6bff] font-bold text-white"
            >
              오늘의 3문장 시작하기
            </Link>
          </div>
        ) : (
          <ol className="space-y-3">
            {items.map((item) => (
              <li key={item.id} className="rounded-2xl bg-white p-5 shadow-sm">
                <p className="text-xs font-bold text-[#2f6bff]">
                  {modeLabels[item.mode]} {item.sentenceCount}문장 완료
                </p>
                <h2 className="mt-2 font-bold">{item.title}</h2>
                <time
                  dateTime={item.completedAt}
                  className="mt-2 block text-xs text-[#8b95a1]"
                >
                  {new Date(item.completedAt).toLocaleString("ko-KR")}
                </time>
              </li>
            ))}
          </ol>
        )}
        {items.length > 0 && (
          <button
            onClick={() => setDeleting(true)}
            className="min-h-11 text-sm text-[#4e5968] underline"
          >
            프로토타입 기록 모두 삭제
          </button>
        )}
      </div>
      <AlertDialog open={deleting} onOpenChange={setDeleting}>
        <AlertDialogContent className="max-w-[340px] rounded-2xl bg-white">
          <AlertDialogTitle>완료 기록을 모두 지울까요?</AlertDialogTitle>
          <AlertDialogDescription>
            이 브라우저의 프로토타입 기록만 삭제해요. 삭제한 기록은 복구할 수
            없습니다.
          </AlertDialogDescription>
          <AlertDialogCancel>취소</AlertDialogCancel>
          <AlertDialogAction onClick={clear}>기록 삭제</AlertDialogAction>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
