# 분석 결과 조회 409 복구

2026-10-05 18:23 KST, 분석 80의 결과 조회가 worker claim과 겹쳐 409로 종료됐다. 이후 같은 세션 131에 업로드 URL을 다시 요청해 `INVALID_SESSION_STATE` 409가 반복됐다. 최초 분석은 별도로 RunPod journal 연결 단계에서 실패했으며 두 문제를 구분한다.

## 변경 파일

- `src/lib/canonical-recovery.ts`: `409 + CANONICAL_ANALYSIS_CHANGED`만 자동 재조회 가능한 읽기 충돌로 구분한다. 다른 409, 인증 변경, 실제 attempt 변경은 자동 복구 대상으로 추가하지 않는다. 접수된 분석의 결과를 확인하지 못한 경우 기존 분석을 수동 재조회할 수 있도록 판단을 분리한다.
- `src/lib/analysis-polling.ts`: 해당 읽기 충돌을 기존 지수 backoff·90초 연속 장애 한도·전체 deadline·취소 및 인증 변경 처리 안에서 재조회한다. 성공하면 장애 횟수를 초기화한다. 분석 POST나 업로드는 자동 재전송하지 않는다.
- `src/components/practice-session.tsx`: 결과 조회 오류 후 “분석 상태 다시 확인”을 제공한다. 이미 접수했거나 접수 응답이 유실된 분석은 `analyze()`와 재녹음 진입에서도 기존 상태 조회로 연결한다. 서버가 제공한 canRetry/canRerecord는 기존 정책대로 사용한다. 결과를 확인하기 전 같은 ANALYZING 세션에 새 업로드 URL을 요청하지 않는다.

Backend의 409 상태 변경 감지와 세션 보호는 유지한다. FE→RunPod 직접 전송의 UUID 멱등성·인증 방식에는 변경이 없다. 과정·기존 세션 등 AWS 경유 경로에 발생한 오류를 수정한다.

## 확인 범위

TypeScript noEmit 컴파일과 변경 파일 Prettier 검사, diff 정적 확인을 수행했다. 자동 회귀 테스트·브라우저 QA·실제 추론은 수행하지 않았다. 개발자는 PENDING→PROCESSING 중 읽기 충돌, 지속되는 409 후 상태 재확인, FAILED의 서버 허용 재시도, 재녹음 허용 결과, 인증 변경·취소·실제 attempt 변경을 확인한다. 오류 화면을 여러 번 눌러도 접수된 녹음을 재업로드하지 않아야 한다.

PR 대상은 dev다. PR 생성은 main 병합이나 Vercel 운영 반영을 뜻하지 않는다. RunPod journal 연결 실패 복구는 AI 저장소의 동반 변경이다.
