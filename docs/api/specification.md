# API 명세 - VC-FE

정확한 API 계약을 이 문서에 기록한다.

## 엔드포인트 템플릿
### METHOD /path
- 설명:
- 인증:
- Path params:
- Query params:
- Request body:
- Response body:
- Status codes:
- Error cases:

## 인증 계약
- token/session 형식, refresh 규칙, 만료, 필수 header를 기록한다.

## 외부 API 매핑
- upstream 계약이 확인된 경우에만 내부 endpoint와 upstream 호출 관계를 기록한다.


## Canonical capability와 결과 처리 보완 (2026-10-04)

### GET /api/analysis-capabilities/canonical

사용자 로그인 Bearer 인증, 요청 body/path/query 없음. 200은 표준 ApiResponse envelope의 data이며 Cache-Control은 no-store다. 미인증은 기존 인증 계층의 401/403이다. 설정/점검 중에도 조회 자체는 200이고 admissionEnabled=false, resultSchemas=[]로 표현한다. 기존 /api/analysis-capabilities의 CONFIGURED는 설정 존재 의미를 유지한다.

| 필드 | 타입/필수/null | 의미 |
|---|---|---|
| capabilityVersion | string/필수/non-null | voice-coaching.analysis-capabilities.v1 |
| analysisProfile | string/필수/non-null | CANONICAL_HANDOFF_20261004_V5 |
| resultSchemas | string[]/필수/non-null | 접수 가능 시 voice-coaching.runpod-analysis-result.v5 하나, 불가 시 빈 배열 |
| admissionEnabled | boolean/필수/non-null | worker/readiness/용량/maintenance 접수 조건. 개별 사용자 권한을 대신하지 않음 |
| scopes | object/필수/non-null | STANDALONE_AUDIO, COURSE, TITLE_EXAM, VIDEO 네 키 |
| scopes.*.supported | boolean/필수/non-null | 해당 목적의 구현 지원 여부. 현재 단독 음성만 true |
| scopes.*.reasonCode | string/필수/nullable | 단독 음성은 null, 미지원은 각각 COURSE_ANALYSIS_UNSUPPORTED, TITLE_EXAM_ANALYSIS_UNSUPPORTED, VIDEO_ANALYSIS_UNSUPPORTED |

FE는 지원 범위를 녹음/업로드 전에 확인하고, 위 필드가 빠진 과거 응답은 전체 지원으로 추정하지 않는다. 구버전 응답은 클라이언트 ANALYSIS_CAPABILITIES_UNAVAILABLE(503)로 안내한다. 미지원 목적은 반환 reasonCode로 안내하고, 접수 불가는 ANALYSIS_INTEGRATION_UNAVAILABLE로 안내한다. 이들은 FE의 로컬 오류 분류이며 capability GET의 HTTP 200을 서버 409/503으로 바꾼 것은 아니다. 실제 analyze/retry의 소유·선택·동의·용량·접수 검사는 계속 Backend가 수행한다.

### 기존 GET /api/v3/analyses/{analysisId} 및 complete/upload-url

- request/profile/result/view 버전은 v3/v5/v5/view-v2 그대로다. JSON schema 9개 바이트는 변경하지 않는다.
- v5 COMMITTED handoff의 검증과 현재 request/execution/녹음/소유/원본 hash가 일치한 결과를 학습 완료·재녹음의 저장 증명으로 사용한다. v5에 retainedEvidence를 요구하지 않는다. v4 보관 자료는 기존 receipt 증명을 유지한다.
- 학습 완료는 ACCEPT/INLINE/feedbackDeliveryAllowed와 기존 adapter/generation 조건이 필요하다. REJECT/INCONCLUSIVE는 적격 결과의 재녹음만 허용한다. 미검증/SAVING/다른 실행은 완료 불가다. B2 archive는 독립 처리다.
- 결과 표시 권한과 actions.canComplete는 별개다. canComplete=false인 유효 ACCEPT 결과를 일반 AI 실패로 표시하지 않는다. FAILED, REJECT, INCONCLUSIVE의 안내를 구분한다.
- 선공개 뒤 서버 재시작으로 동일 attempt가 일시 PROCESSING/NONE이 되어도 FE는 잠정 결과를 읽기 전용으로 보존하며 상태를 다시 조회한다. 전체 identity가 바뀌거나 인증/소유가 무효면 보존하지 않는다.
- 저장 조회는 한 번에 최대 120초, 요청별 15초, 5초 간격으로 제한한다. 지연 후 사용자가 조회만 다시 시작할 수 있고 자동 analyze/retry 제출은 없다.
- complete 요청의 totalLearningSeconds는 새 페이지 recorder의 0초가 아닌 현재 선택된 서버 녹음 durationMs로 계산한다. duration이 없으면 임의의 1초를 만들지 않는다.
- 실행 상태 조회로 확인한 RunPod INTERNAL_ERROR/DEPENDENCY_UNAVAILABLE terminal FAILED는 Backend failure_code=runpod_execution_failed, 공개 serviceFailure={origin:RUNPOD, code:CANONICAL_EXECUTION_FAILED, stage:EXECUTION}으로 구분한다. UNKNOWN/404/409/5xx만으로 terminal 실패를 만들지 않는다.
