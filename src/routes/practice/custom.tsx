import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { TopBar } from "@/components/top-bar";

export default function Custom() {
  return (
    <AppShell nav={false}>
      <TopBar to="/home" title="내 문장 연습" />
      <div className="px-5 pb-10">
        <h1 className="text-2xl font-bold tracking-tight">
          내 문장을 넣어서 연습하기
        </h1>
        <div className="mt-6 rounded-3xl bg-surface p-5">
          <p className="text-sm font-semibold">
            현재 API 버전에서는 준비 중인 기능입니다.
          </p>
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
            API 명세서(ver.08/07)에 사용자 문장 생성 엔드포인트가 없어 임의의
            콘텐츠 ID로 분석을 요청하지 않습니다.
          </p>
          <Link
            href="/sentences"
            className="mt-5 block rounded-full bg-foreground py-3.5 text-center text-xs font-semibold text-background"
          >
            등록된 문장으로 연습하기
          </Link>
        </div>
      </div>
    </AppShell>
  );
}
