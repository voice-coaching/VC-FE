# 브라우저 원본 영상 직접 업로드

2026-11-08 소스 연결. 업로드는 AI PR #73, 화면용 요약은 AI PR #75의
`voice-coaching.browser-video-summary.v1`, 권한 발급은 Backend #212·#213을 따른다.
이 문서의 Frontend 변경 자체는 운영 배포·실제 로그인 영상 QA 완료를 뜻하지 않는다.
이전 RS256 `/api/analysis-authorizations/video` 후보를 사용하지 않고 운영 Ed25519 계약으로 교체했다.

## 사용자 흐름과 경계

`/lip-practice`는 촬영/재생을 유지하고 원본 영상·내장 음성의 AI 직접 전송에 동의한 뒤 제출한다.
Backend `VIDEO` capability와 handoff readiness를 영상 버튼의 선행 조건으로 사용하지 않는다.
로컬 촬영은 기존 12초 상한, 제출은 실제 음성 트랙·0.5~120초·256 MiB·지원 MIME을 확인한다.

브라우저는 영상 bytes와 시도 UUID를 유지한다. 기존 custom content/훈련 세션은 원고와 로그인 소유권을
확인하는 권한 문맥으로만 만든다. 영상 S3 업로드·recording 등록/선택·Backend analyze·품질 polling·
완료 API·Backend 결과 수집은 호출하지 않는다. 동일 시도의 재확인은 같은 권한 문맥과 AI job을 사용한다.

## 인증·권한

POST `/api/training-sessions/{sessionId}/video-analysis-upload-grants`:
로그인 Access Token과 실제 Origin, JSON `{clientRequestId,source:{sha256,fileSizeBytes,mimeType},
videoProcessingConsentAccepted:true,videoProcessingConsentPolicyRevision:"voice-video-processing-consent-v1"}`.
source는 원본 bytes의 SHA-256, 1~268435456 bytes, video/mp4·video/webm·video/quicktime이다.

Backend data는 `schemaVersion=voice-coaching.browser-video-grant.v1`, aiBaseUrl(HTTPS origin),
jobsPath=/browser/v1/video-analysis-jobs, grantToken, expiresAt(Unix seconds),
metadata={clientRequestId,scriptText,contentId,source}다. data는 기존 client에서 한 번만 해제한다.
반환 UUID·source·서버 원고·content 연결을 대조하며, 갱신으로 AI origin/원고가 바뀌면 중단한다.

`/api/backend/*` 중계는 이 권한 POST에 한해 브라우저 Origin이 현재 origin과 같은지 확인하고
Origin을 Backend로 전달한다. 다른 경로의 헤더 정책은 유지한다. 누락/교차 Origin은 403이다.
AI 호출은 Backend가 반환한 HTTPS origin과 고정 jobsPath만 사용하며 cookies=omit이다.
로그인 토큰·서버 Bearer는 AI에 보내지 않고 grantToken만 Authorization으로 전달한다.
토큰은 메모리에만 보관한다. 만료 임박/401 시 같은 시도·원본으로 갱신하며 401 재전송은 1회다.

## AI 브라우저 endpoint

아래 경로는 aiBaseUrl 기준이며 모두 브라우저 Origin과 grant Bearer가 필요하다.

| Method | Path | 요청/성공 |
|---|---|---|
| GET | /browser/v1/video-analysis-jobs?clientRequestId=UUID | 같은 시도 조정, 200 상태 또는 첫 접수 전 404 |
| POST | /browser/v1/video-analysis-jobs | Backend metadata JSON, 202 상태 |
| PUT | /browser/v1/video-analysis-jobs/{jobId}/source | 실제 원본 Blob, 선언 video MIME, 200 상태 |
| POST | /browser/v1/video-analysis-jobs/{jobId}/start | 본문 없음, 202 상태 |
| GET | /browser/v1/video-analysis-jobs/{jobId} | 200 상태 |
| GET | /browser/v1/video-analysis-jobs/{jobId}/summary | 200 화면용 최종 요약 bytes·X-Result-SHA256·ETag |
| POST | /browser/v1/video-analysis-jobs/{jobId}/cancel | 명시적 서버 취소용 client 메서드, 200 상태 |

상태는 AWAITING_MEDIA→QUEUED→RUNNING→COMPLETED/FAILED, 또는 CANCELLED다.
응답 유실 후 같은 UUID를 조회해 이미 업로드한 source·시작한 작업을 재사용한다.
재확인 버튼은 새 clientRequestId나 추론/GPT를 생성하지 않는다. 종료 실패에는 다시 촬영하도록 안내한다.
상태 GET의 일시 전송 실패는 최대 5회 backoff/Retry-After로 재조회한다. 20분 화면 대기 만료는
AI 취소·실패를 뜻하지 않는다. 대기 중단은 AbortSignal로 요청을 중단하고 같은 촬영본에서 재확인한다.
로그인 변경/페이지 해제 뒤에는 후속 업로드·start·늦은 결과 표시를 진행하지 않는다.

## 결과 표시와 보존 범위

resultAvailable=true일 때 `/summary`의 최대 2 MiB 응답 bytes를 SHA-256으로 검증하고
요약 응답의 X-Result-SHA256·따옴표로 감싼 ETag와 대조한다. 상태 resultSha256은 전체 보존
결과의 digest이므로 요약과 비교하지 않는다. `/result`는 호환용이며 이 화면에서는 호출하지 않는다.
jobId·executionId·clientRequestId·종료 상태를 현재 시도와 대조한다. 요약에는 원본 미디어 hash가 없다.

| 필드 | 타입·필수/null | 의미 |
|---|---|---|
| schemaVersion | string/필수 | voice-coaching.browser-video-summary.v1 |
| jobId·executionId·clientRequestId | UUID string/필수 | 현재 작업·실행·시도 연결 |
| status | string/필수 | COMPLETED 또는 FAILED |
| score.overallScore | number/필수/nullable | AI 종합점수 0~100 |
| score.validity·score.reason | string/필수 | AI 점수 의미. 기존 전체 결과 enum으로 거절하지 않음 |
| score.details | object/선택 | voice-coaching.score-details.v1 음성 6항목. [필드 명세](score-details.md) |
| visual.score | number/필수/nullable | 종합점수와 별도인 입술점수 0~100 |
| visual.scoreKind | string/필수 | CALIBRATED·PROVISIONAL·NONE |
| visual.scoreScope | string/필수 | WHOLE_CLIP·ASSESSED_PHONES_ONLY·UNAVAILABLE |
| coaching.feedback | string/필수 | 서버 피드백을 기호·공백·줄바꿈 포함 일반 텍스트로 표시 |
| failure | object/필수/nullable | 실패 시 code:string. HTTP 200도 status/failure를 확인 |

요약은 전용 DTO로 읽고 기존 전체 결과의 점수·CORE 파서를 재사용하지 않는다.
선택 `score.details`는 공통 표시 점수 파서로 보존하고, 성공 시 `analysis.scoreDetails`로
그대로 전달해 기존 `AnalysisScoreDetails`에서 표시한다. 실패 결과에는 세부점수를 전달하지 않는다.
과거 결과의 필드 부재·잘못된 선택 객체는 세부점수만 생략하며 총점·피드백 표시를 막지 않는다.
0은 유효, null은 미제공이다. 입술점수 null이어도 총점·피드백을 표시한다.
ASSESSED_PHONES_ONLY는 ‘관찰된 부분 기준’, PROVISIONAL은 임시 참조 비교 점수로 표시한다.
점수·가중치를 재계산하지 않고 발음별 관찰·시간·프레임·세부 조음 목록을 생성하지 않는다.
내부 CORE·landmark·저장 경로를 화면에 전달하지 않으며 AI UUID를 Backend 정수 분석 ID로 위장하지 않는다.

요약 GET의 401은 동일 시도 권한 갱신, 403은 Origin 오류, 404는 미존재/다른 소유자,
409는 결과 미준비/없는 종료 결과다. 오류 시 상태 재확인으로 판단하며 5xx·수집 실패를
새 분석·GPT 실행으로 바꾸지 않는다. 실패 응답에 서버 피드백이 있으면 그대로 표시한다.

이 새 경로는 Backend 분석 이력/완료에 연결되지 않는다. 현재 화면에서 결과를 확인하고 완료 시 홈으로 이동한다.
저장됐다고 주장하는 리포트 저장 dialog와 Backend 학습 기록 이동을 새 영상 경로에 사용하지 않는다.
기존 음성/Backend 결과의 이력과 리포트 저장은 바꾸지 않는다. 브라우저 복구 저장소의 기존
촬영본·UUID·세션·AI 작업 연결로 같은 연습을 재개하며, 사용자 이력 화면 연결과는 구분한다.

## 검증

TypeScript noEmit·변경 파일 ESLint/Prettier·Git diff와 endpoint/호출 경로를 확인했다.
요약·기존 작업 복구 회귀 21건에서 0/null·확장 점수 의미·실패 피드백·긴 피드백·
일반 텍스트 이스케이프·요약 digest·시도 식별자 검증을 확인했다.
Next 16.3.5 webpack 프로덕션 빌드에서 컴파일·타입 검사·42개 페이지 생성을 통과했다.
로컬에 빠진 잠금 버전 PortOne SDK 0.1.13은 기존 검증 전용 설치 경로로 해석했다.
빌드 중에만 사용한 tsconfig 경로 설정과 생성된 next-env 변경은 원복하고 의존성·잠금 파일을 변경하지 않는다.
운영 AI의 프론트 Origin POST/PUT/GET preflight가 모두 204임을 읽기 전용으로 확인했다.
실제 사용자 로그인·카메라·영상 업로드·분석/GPT·브라우저 자동화·운영 Frontend 배포는 실행하지 않았다.
