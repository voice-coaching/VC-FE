# 분석 상태 조회 연결 복구

2026-10-03 구현. 상태 GET의 일시적인 502가 분석 자체의 실패로 표시되던 경로를 수정한다.
`/api/backend` → AWS Backend → RunPod 구조와 canonical v4 결과/완료 조건을 유지한다.

## 변경 파일과 계약

- `src/lib/analysis-polling.ts`: 실제 HTTP 502/503/504, fetch NETWORK_ERROR,
  TIMEOUT만 같은 분석의 GET으로 다시 조회한다. 최초 제출의 analysisId 또는 처음
  확인한 ID를 고정하고 다른 시도로 바뀌면 중단한다.
- 대기는 1·2·4·8초, ±20% jitter이며 Retry-After를 남은 예산 안에서 반영한다.
  연속 장애 예산은 첫 오류 이후 90초, 전체는 10분, 개별 GET은 최대 20초다.
  정상 상태 수신은 연속 장애 예산만 초기화한다. deadline을 갱신하지 않는다.
- `src/lib/api/client.ts`: 실제 upstream HTTP 상태를 파싱/계약 예외와 구분한다.
  응답 JSON 오류, 최종 인증 실패, AUTH_SESSION_CHANGED, REQUEST_ABORTED는
  재시도 대상이 아니다. 기존 401 토큰 갱신 규칙은 유지한다.
- `src/lib/api/remote.ts`, `types.ts`: AbortSignal을 실제 status/관련 결과 GET까지 전달한다.
- `src/components/practice-session.tsx`: 진행률을 유지하고 연결 복구 중임을 표시한다.
  예산 초과 시 상태 미확인으로 안내하고 기존 상태 확인 동작을 제공한다. 새 분석 POST를
  만들거나 실패 기록/진행률 100을 만들지 않는다. 화면 이탈, 로그인 변경, 새 poll 시작은
  기존 GET과 대기를 취소한다. 늦은 업로드 응답이 unmount 후 poll을 시작하지 않도록 막는다.
- `src/lib/practice-error.ts`: 연결 확인 실패를 서버의 분석 FAILED와 구분한다.
- `src/routes/lip-practice.tsx`: 기존 공통 poll 호출에도 요청 ID와 signal을 전달한다.
  영상 분석 지원 범위나 결과 계약은 확장하지 않는다.
- `src/app/api/backend/[...proxyPath]/route.ts`: upstream status/Retry-After를 그대로
  전달하며 자체 연결 실패는 no-store 503 + Retry-After 2다. downstream 취소를
  upstream fetch에 전달한다. POST 자동 재전송을 추가하지 않는다.

업로드 client는 대소문자 구분 없이 Content-Length 등 브라우저 관리 헤더를 거른다.
Content-Type, 허용된 서명용 x-amz-* 및 기존 인증 처리는 유지한다. Backend도 새
requiredHeaders에서 Content-Length를 제외한다. presigned URL의 길이 서명과
서버의 실제 파일 크기/MIME/digest/소유권 검증은 유지한다.

## 검증과 배포

2026-10-03 운영 반영 준비 중 `main` → `dev` 병합본의 TypeScript 컴파일에서
`practice-session.tsx`의 `createTitleExamSession`, `titleExamErrorMessage` import
누락을 확인했다. 기존 `@/lib/title-exam`의 두 함수를 다시 연결했으며 새 기능은 추가하지 않는다.

TypeScript noEmit, 변경 파일 포맷과 정적 검토를 수행한다. 자동 테스트/fixture나
브라우저 자동화, 실제 음성/GPT 요청은 실행하지 않는다. PR은 dev 대상이며 병합과
Vercel 운영 배포는 별도다. Backend 배포 보호 변경 및 RunPod 호환 묶음과 함께 인계한다.

개발자가 수동 확인할 항목:

1. 개발 환경에서 30초 동안 상태 GET 503 후 같은 analysisId COMPLETED를 반환하면
   결과가 보이고 analyze/retry POST가 추가되지 않는다. 마지막 진행률이 유지된다.
2. 90초 장애와 전체 10분 초과는 상태 미확인/지연으로 표시되며 상태 확인을 다시
   눌러 기존 작업을 조회할 수 있다. Retry-After와 요청 timeout은 예산을 넘기지 않는다.
3. FAILED, 401/403, 인증 사용자 변경, 잘못된 JSON/상태, 다른 analysisId를 네트워크
   장애로 무한 재시도하지 않는다. 이탈 후 GET·타이머와 늦은 UI 반영이 중단된다.
4. 음성 업로드에서 unsafe Content-Length 경고가 없으며 업로드·등록·선택이 성공한다.
   잘못된 크기/MIME와 만료 서명은 기존 규칙대로 거절된다.
5. 새 숫자 점수와 과거 null 점수 결과, canonical actions/완료 조건을 각각 확인한다.
