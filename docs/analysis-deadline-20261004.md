# 분석 대기 기한과 같은 시도 재조회

2026-10-04 로컬 구현. 운영 배포·브라우저 QA 전이다.

- 상태 응답의 선택 필드 `deadlineAt`, `serverTime`을 사용한다. 첫 유효 상태에서 서버 상대 시간을 monotonic 대기 시간으로 고정하고 최대 1시간 + 상태 반영 여유 5초로 제한한다. 이후 polling으로 기한을 계속 연장하지 않는다.
- 해당 필드가 없는 기존 Backend에서는 기존 10분 대기 제한을 유지한다. local 대기 종료는 `AnalysisWaitTimeout`이며 서버 FAILED 판정이 아니다.
- 대기·통신 오류에 마지막 analysisId를 보존한다. “분석 상태 다시 확인”은 그 ID를 기대값으로 전달하고 다른 시도로 바뀌면 결과를 섞지 않는다. 새 analyze/retry POST를 자동 전송하지 않는다.
- 기존 `/api/backend` 프록시, canonical v4 요청·parser와 완료 조건을 유지한다. v5 capability/parser와 B2 완료 분리는 이 변경에 포함되지 않는다.

확인: TypeScript `tsc --noEmit --incremental false`, 변경 파일 Prettier. 자동 테스트·브라우저 QA·Vercel 배포는 수행하지 않았다. PR 대상은 `dev`다.
