# 영상 연습 v6 연결

2026-10-07. `dev=ff3dec9` 기반 후보 구현, 운영 미배포.

- `src/lib/api/canonical.ts`: 기존 analyze/retry URL/body에 v6 헤더를 보내는 명시적 영상 메서드 추가. 음성 메서드는 v5 유지.
- `src/lib/api/analysis-capabilities.ts`: VIDEO는 지원 여부 및 v6 schema 광고 모두 확인.
- `src/routes/lip-practice.tsx`: 기존 촬영/정규화 등록/품질 확인/선택 후 영상 analyze 호출. AbortSignal 전달.
- `src/lib/canonical-analysis.ts`, `canonical-lip.ts`: public view v2/v3를 profile과 묶어 엄격히 파싱. 현재 recording/request/execution 검증 유지. null 점수, 관찰, 시간 범위, coverage 검사.
- `src/components/canonical-lip-result.tsx`, `analysis-view.tsx`: 기존 음성 피드백 옆에 입술 상태·자음 구간·관찰/보정 점수·연구용 유사도를 별도 표시. null은 점수 미제공으로 표시하며 종합 음성 점수에 합산하지 않음.

Backend PR #114, AI PR #34가 함께 필요하다. 기존 URL의 v3 public view가 private v6 결과를 그대로 전달하는 것은 아니다. 얼굴 좌표·receipt·비밀값을 화면에 노출하지 않는다. public 상세 128개 제한 및 생략 수를 표시한다.

초기 AI 후보는 자음 MFA 기반 관찰 전용이다. 참조·보정 데이터와 개발자 QA 전에는 입술 점수가 제공되지 않는다. Backend VIDEO capability가 닫힌 상태에서는 촬영/업로드 전 기존 안내를 유지한다.

확인: Next 16.3.5의 로컬 Server/Client Components guide 확인, TypeScript `tsc --noEmit --incremental false` 통과, 소스 정적 검토. 브라우저 QA·자동 회귀 테스트·실제 영상/GPT 호출·배포는 실행하지 않았다.
