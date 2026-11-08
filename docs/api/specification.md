# API 명세 - VC-FE

## 2026-11-08 브라우저 원본 영상

`/lip-practice`의 Backend 권한 발급과 AI 원본 접수/조회는 [직접 영상 계약](direct-video-upload.md)을 따른다.
권한 POST에만 검증한 Origin을 Backend 중계로 전달한다. 기존 VIDEO capability는 이 새 흐름의 gate가 아니다.
Frontend 내부 endpoint는 기존 /api/backend/* 중계를 유지하며 영상 bytes는 이 중계를 통과하지 않는다.

## GET /api/users/me/popup — 홈 관리자 공지

활성 로그인 회원용 기존 Backend API를 `/api/backend` 프록시로 조회한다. path/query/body 인자는 없고
기존 인증과 갱신을 사용한다. `cache: no-store`로 조회하며 팝업 조회 실패 때문에 홈을 오류 화면으로 바꾸지 않는다.
200 ApiEnvelope.data는 아래 객체 또는 null이다. null이면 표시하지 않는다.

| 필드 | 타입·필수/null | 의미 |
| --- | --- | --- |
| id | 양의 정수, 필수/non-null | 팝업 식별자 |
| title | 문자열 1~200자, 필수/non-null | 공지 제목 |
| body | 문자열 1~1,000자, 필수/non-null | 공지 본문, 줄바꿈 유지. 공백만 있는 값은 거절 |
| deepLink | `/home`·`/notifications`·`/mypage`, 필수/nullable | 선택 이동 목적지. null이면 이동 버튼 없음 |
| startsAt | offset 포함 ISO datetime, 필수/non-null | 서버가 정한 게시 시작 |
| endsAt | offset 포함 ISO datetime, 필수/non-null | 게시 종료, 시작 이후 |

서버가 시각·활성 상태·우선순위를 판단한다. FE가 기기 시각으로 게시 여부를 재판정하지 않는다.
Backend `/notifications` 목적지는 실제 FE 화면 `/home/notifications`로 변환한다. 외부·임의 경로는 거절한다.
401/403은 기존 인증/권한 오류이며, 네트워크/5xx/잘못된 응답도 팝업만 생략한다. 신규 분석·저장·읽음 API는 호출하지 않는다.
닫기는 현재 로그인·브라우저 페이지 실행 중 메모리에만 보관하며 새로고침하면 서버에서 다시 확인한다.
‘하루 동안 보지 않기’와 ‘일주일 동안 보지 않기’는 회색 텍스트 버튼이다. 브라우저 localStorage의 기존 사용자 ID·팝업 ID별 키에 선택 시각부터
각각 24시간 또는 7일(168시간) 뒤 만료 시각만 저장한다. 기존 주간 숨김 키도 유지한다. 만료 시 다시 표시하며 다른 회원·다른 팝업에는 적용하지 않는다.
서버 게시 기간은 그대로 서버가 판단하며, 숨김 환경설정만 기기 시각을 사용한다. 저장 공간이 차단되면 현재 방문에서만 닫는다.
다른 브라우저/기기와 동기화하거나 Backend에 읽음·숨김 정보를 전송하지 않는다.

## 2026-11-08 선택형 음성 세부점수

기존 Backend `/api/v3/analyses/{analysisId}`와 Direct 조회/SSE/저장 이력의 `score.details`를 보존한다.
인증·상태·endpoint는 유지하며, 선택 필드가 없어도 총점·총평을 표시한다.
[필드·표시·호환성 계약](score-details.md).

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


## Direct 연습 결과 표시 (2026-11-01)

`POST /direct/api/v1/analyses` 및 GET/SSE의 기존 공개 분석 계약·인증·경로는 유지한다. 신규 AI 결과의 선택 필드 `result.practiceResult`를 보존해 `AnalysisView`에 전달한다. 선택인 이유는 AI 배포 순서와 기존 저장 이력 호환이며, 필드가 있으면 모든 하위 필드는 필수다.

| 필드 | 타입/null | 의미 |
|---|---|---|
| schemaVersion | string | `voice-coaching.direct-practice-result.v1` |
| scope | string | `UTTERANCE` |
| scriptText | string, 1~4000자 | 접수된 원고 |
| decisionStatus | string | ACCEPT/REJECT/INCONCLUSIVE/SYSTEM_FAILURE, 기존 decision.status와 일치 |
| score | canonicalScore | 기존 result.score와 일치, 미채점 overallScore=null 보존 |
| feedback | string(1~4000자) 또는 null | ACCEPT이며 failure가 없으면 기존 coaching.feedback, 그 외 null |
| sentenceResults | null | 문장별 채점 미지원 |
| sentenceResultsReason | string | `UTTERANCE_ONLY` |

중복 점수·결정·feedback이 기존 결과와 다르면 `PRACTICE_RESULT_MISMATCH`로 파싱을 거부한다. 이전 응답에 필드가 없으면 기존 검증된 전체 녹음 score/decision/coaching.feedback를 그대로 표시한다. SSE·GET·저장 이력은 같은 parser를 사용한다.

`이번 연습 결과`는 segments와 교정 후보가 없더라도 전체 녹음 점수·AI 피드백을 표시한다. 실제 제공된 문장별 segments가 있으면 기존 화면을 유지한다. 실패/거부/보류를 정상 판정·0점으로 바꾸지 않는다. 문장별 채점이나 정상/주의 임계값은 추가하지 않는다.

정적 확인·TypeScript 컴파일만 수행하며 실제 녹음, AI 응답, 저장 이력 재열기와 화면 QA는 개발자가 확인한다. 배포·실제 추론 성공을 주장하지 않는다.


## 문장별 녹음 묶음 계약

[문장별 녹음·일괄 피드백 API](sentence-practice-batches.md)의 네 endpoint, 상태·실패·복구 계약을 따른다. 기존 단일 direct 결과와 내부 canonical 계약의 버전은 유지한다.


## 활성 인증형 연습의 프론트 진행

문장·뉴스·아나운서·내 문장·클래스는 [인증형 연속 녹음 흐름](authenticated-sentence-practice.md)을 사용한다. 기존 API 요청/응답·인증 계약을 변경하지 않고 캡처와 업로드/분석의 대기를 분리한다. 익명 Direct endpoint로 자동 전환하지 않는다.

## 영상 촬영본 소비 계약 (2026-11-07)

기존 `/api/analysis-capabilities`, `/api/analysis-capabilities/canonical`, recording upload/register/select, analyze 및 canonical 조회 URL을 유지한다. 신규 endpoint는 없다.
미디어 capability는 no-store로 조회한다. `acceptedVideoMimeTypes`, `maximumVideoUploadBytes`, `minimumDurationMs`, `maximumDurationMs`, `videoRequiresAudioTrack`을 적용한다.
등록의 기존 선택 필드 `videoProcessingConsentAccepted: boolean|null`, `videoProcessingConsentPolicyRevision: string|null`은 영상 정책이 필요하고 해당 revision에 동의한 경우에만 true/서버 revision으로 전달한다. 비활성 정책에서는 생략한다.
음성 동의는 별도의 analyze body에 유지한다. 정책 미확인·미동의는 Frontend 단계에서 중단하고 API를 호출하지 않는다. 등록 응답의 기존 `analysisMediaType=AUDIO_VISUAL`을 확인한다.
입술 확장 필드의 enum·선택/null·측정 단위는 [영상 입술 점수 소비 계약](../contracts/lip-provisional-score-v1.md)을 따른다. 종합점수 경로는 `data.canonicalAnalysis.score.overallScore`이며 ApiResponse 래퍼 해제 후에는 `view.canonicalAnalysis.score.overallScore`다. Client는 점수를 다시 계산하지 않는다.
