# API ver.08/07 전체 연동 작업 보고서

> 이 문서는 2026-08-08 당시 계약의 작업 기록입니다. 현재 계약은
> [API_INTEGRATION.md](./API_INTEGRATION.md)를 기준으로 하며, 운영 Swagger에서 제거된
> 콘텐츠별 추천 API를 포함한 아래 53개 목록은 현재 기준이 아닙니다.

작업일: 2026-08-08  
기준 명세: [Notion API 명세서(ver.08/07)](https://app.notion.com/p/3a4bf91c409e8310bfc001e014b3bdff)

## 결과 요약

- Notion 데이터베이스와 각 상세 페이지에서 API 53개의 요청·응답·오류 규칙을 확인했습니다.
- 기존 22개 가상 엔드포인트와 mock 기본 실행을 제거하고 ver.08/07 계약으로 교체했습니다.
- 53개 엔드포인트를 타입이 지정된 `ApiContract`와 원격 구현에 모두 추가했습니다.
- 공통 응답 래퍼, JWT Access Token, HttpOnly Refresh Cookie, 401 자동 갱신/재시도, 타임아웃, 오류 변환을 적용했습니다.
- multipart 단일 분석 요청을 presigned URL 기반 비동기 분석 파이프라인으로 교체했습니다.
- 홈, 콘텐츠, 연습, 클래스, 마이페이지, 기록, 설정 화면의 정적/mock 데이터 연결을 실제 API 호출로 교체했습니다.
- Next.js 16 규칙에 맞춰 공개 환경변수를 `NEXT_PUBLIC_*`로 변경했습니다.

## 엔드포인트 적용 현황 (53/53)

| 도메인     | Method | Path                                                                 | 클라이언트 메서드                      |
| ---------- | ------ | -------------------------------------------------------------------- | -------------------------------------- |
| 인증       | GET    | `/api/auth/email-availability`                                       | `auth.checkEmail`                      |
| 인증       | POST   | `/api/auth/signup`                                                   | `auth.signUp`                          |
| 인증       | POST   | `/api/auth/login`                                                    | `auth.signIn`                          |
| 인증       | POST   | `/api/auth/social-login`                                             | `auth.socialLogin`                     |
| 인증       | POST   | `/api/auth/token/refresh`                                            | `auth.refresh`                         |
| 인증       | POST   | `/api/auth/logout`                                                   | `auth.signOut`                         |
| 사용자     | GET    | `/api/users/me`                                                      | `users.getMe`                          |
| 사용자     | PATCH  | `/api/users/me`                                                      | `users.updateProfile`                  |
| 사용자     | DELETE | `/api/users/me`                                                      | `users.withdraw`                       |
| 온보딩     | GET    | `/api/onboarding/me`                                                 | `onboarding.get`                       |
| 온보딩     | PUT    | `/api/onboarding/me`                                                 | `onboarding.save`                      |
| 온보딩     | PATCH  | `/api/onboarding/me`                                                 | `onboarding.update`                    |
| 홈         | GET    | `/api/home`                                                          | `home.get`                             |
| 홈         | GET    | `/api/recommendations`                                               | `home.getRecommendations`              |
| 홈         | GET    | `/api/users/me/training-sessions/recent`                             | `home.getRecentTraining`               |
| 콘텐츠     | GET    | `/api/practice-contents`                                             | `content.list`                         |
| 콘텐츠     | GET    | `/api/practice-contents/next`                                        | `content.getNext`                      |
| 콘텐츠     | GET    | `/api/practice-contents/{contentId}`                                 | `content.get`                          |
| 콘텐츠     | GET    | `/api/practice-contents/{contentId}/recommendations`                 | `content.getRecommendations`           |
| 콘텐츠     | GET    | `/api/practice-contents/{contentId}/reference-audios`                | `content.getReferenceAudios`           |
| 콘텐츠     | GET    | `/api/reference-audios/{audioId}/playback-url`                       | `content.getReferenceAudioPlaybackUrl` |
| 클래스     | GET    | `/api/courses`                                                       | `courses.list`                         |
| 클래스     | GET    | `/api/courses/{courseId}`                                            | `courses.get`                          |
| 클래스     | POST   | `/api/courses/{courseId}/start`                                      | `courses.start`                        |
| 클래스     | GET    | `/api/courses/{courseId}/progress`                                   | `courses.getProgress`                  |
| 클래스     | PATCH  | `/api/courses/{courseId}/progress`                                   | `courses.updateProgress`               |
| 클래스     | POST   | `/api/courses/{courseId}/complete`                                   | `courses.complete`                     |
| 클래스     | GET    | `/api/courses/{courseId}/steps`                                      | `courses.getSteps`                     |
| 클래스     | GET    | `/api/users/me/course-progress`                                      | `courses.getMyProgress`                |
| 학습       | POST   | `/api/training-sessions`                                             | `training.create`                      |
| 학습       | GET    | `/api/training-sessions/{sessionId}`                                 | `training.get`                         |
| 학습       | POST   | `/api/training-sessions/{sessionId}/cancel`                          | `training.cancel`                      |
| 학습       | POST   | `/api/training-sessions/{sessionId}/recordings/upload-url`           | `training.getUploadUrl`                |
| 학습       | POST   | `/api/training-sessions/{sessionId}/recordings`                      | `training.registerRecording`           |
| 학습       | GET    | `/api/training-sessions/{sessionId}/recordings`                      | `training.listRecordings`              |
| 학습       | DELETE | `/api/training-sessions/{sessionId}/recordings/{recordingId}`        | `training.deleteRecording`             |
| 학습       | PATCH  | `/api/training-sessions/{sessionId}/recordings/{recordingId}/select` | `training.selectRecording`             |
| 학습       | POST   | `/api/training-sessions/{sessionId}/analyze`                         | `training.analyze`                     |
| 학습       | GET    | `/api/training-sessions/{sessionId}/analysis/status`                 | `training.getAnalysisStatus`           |
| 학습       | POST   | `/api/training-sessions/{sessionId}/analysis/retry`                  | `training.retryAnalysis`               |
| 학습       | GET    | `/api/training-sessions/{sessionId}/analysis`                        | `training.getSessionAnalysis`          |
| 학습       | GET    | `/api/recordings/{recordingId}/playback-url`                         | `training.getRecordingPlaybackUrl`     |
| 학습       | POST   | `/api/training-sessions/{sessionId}/complete`                        | `training.complete`                    |
| 분석       | GET    | `/api/analyses/{analysisId}`                                         | `analyses.get`                         |
| 분석       | GET    | `/api/analyses/{analysisId}/segments`                                | `analyses.getSegments`                 |
| 분석       | POST   | `/api/analyses/{analysisId}/feedback/regenerate`                     | `analyses.regenerateFeedback`          |
| 마이페이지 | GET    | `/api/users/me/statistics`                                           | `myPage.getStatistics`                 |
| 마이페이지 | GET    | `/api/users/me/score-trends`                                         | `myPage.getScoreTrends`                |
| 마이페이지 | GET    | `/api/users/me/strengths-weaknesses`                                 | `myPage.getStrengthsWeaknesses`        |
| 마이페이지 | GET    | `/api/users/me/training-sessions`                                    | `myPage.listTrainingSessions`          |
| 마이페이지 | GET    | `/api/users/me/training-sessions/{sessionId}`                        | `myPage.getTrainingSession`            |
| 마이페이지 | DELETE | `/api/users/me/training-sessions/{sessionId}`                        | `myPage.deleteTrainingSession`         |
| 마이페이지 | GET    | `/api/users/me/weakness-recommendations`                             | `myPage.getWeaknessRecommendations`    |

## 화면 연결

- 회원가입/로그인: 새 요청 필드와 응답 구조, OAuth callback의 `authorizationCode` 교환을 적용했습니다.
- 온보딩: UI 응답을 API의 대문자 enum 및 `surveyAnswers` 구조로 변환합니다.
- 홈: `/api/home`의 오늘 현황, 추천, 최근 학습, 클래스 진행 정보를 표시합니다.
- 뉴스/문장/아나운서: `/api/practice-contents` 목록과 상세를 사용합니다.
- 클래스: 목록 조회 후 start/steps를 호출해 연결된 연습 콘텐츠로 이동하고 완료 시 진도를 저장합니다.
- 음성 연습: 세션·presigned 업로드·음질 검사·선택·분석 폴링·결과/segment·완료 API를 순서대로 호출합니다.
- 마이페이지: 사용자 정보, 통계, 강점/약점, 학습 기록을 병렬 조회합니다.
- 설정: 프로필 수정, 로그아웃, 탈퇴 API를 사용합니다.

`내 문장을 넣어서 연습하기`는 ver.08/07 명세에 사용자 정의 콘텐츠 생성 API가 없으므로 가짜 contentId를 보내지 않고 준비 중 안내로 변경했습니다.

## 변경 파일

- `src/lib/api/types.ts`: ver.08/07 요청·응답 타입 및 전체 계약
- `src/lib/api/client.ts`: 공통 래퍼, 인증, refresh, 오류, 타임아웃, 업로드
- `src/lib/api/remote.ts`: 53개 엔드포인트 구현
- `scripts/verify-api-contract.ts`: 전 엔드포인트 호출 계약 검증
- `src/components/practice-session.tsx`: 비동기 음성 분석 전체 흐름
- `src/components/content-catalog.tsx`, `course-catalog.tsx`: 콘텐츠/클래스 API 화면
- `src/routes/*`: 인증, 온보딩, 홈, 연습, 클래스, 마이페이지 연결
- `.env.example`, `docs/API_INTEGRATION.md`: 실행 설정과 운영 가이드

## 검증 결과

| 검증                      | 결과 | 증거                                                           |
| ------------------------- | ---- | -------------------------------------------------------------- |
| API 계약 검증             | 통과 | `npm run verify:api` → `53/53 endpoints + token refresh retry` |
| 개발 계정 검증            | 통과 | `npm run verify:dev-account`                                   |
| TypeScript                | 통과 | `npx tsc --noEmit`                                             |
| 변경 파일 ESLint          | 통과 | 변경된 TS/TSX 전체 오류 0건                                    |
| Next.js 프로덕션 빌드     | 통과 | Next.js 16.3.0, 17개 route 생성                                |
| 브라우저 루트 화면        | 통과 | `HAS_CONTENT`, Next 오류 overlay 없음                          |
| 브라우저 홈 화면          | 통과 | `HAS_CONTENT`, 탐색 링크 렌더링, Next 오류 overlay 없음        |
| 개발 계정 브라우저 로그인 | 통과 | `/auth` 버튼 → `/home`, 로컬 토큰·개발 배너 확인               |
| 패키지 취약점             | 통과 | `npm install` audit: 0 vulnerabilities                         |

## 라이브 백엔드 확인 상태

### 개발용 임시 계정

DB 없이 인증 화면과 기본 홈 화면을 확인할 수 있도록 개발 환경 전용 계정을 추가했습니다.

- 이메일: `dev@ttobak.local`
- 비밀번호: `Dev1234!`
- 적용 범위: 로컬 로그인, 개발 세션, 로컬 프로필, 기본 홈 화면
- 제한: 프로덕션에서는 비활성화되며 실제 API 데이터는 생성하지 않음

현재 저장소와 환경에는 실제 백엔드 origin, 테스트 계정, OAuth 인가 URL이 제공되어 있지 않습니다. 따라서 이번 검증은 프론트엔드 계약·요청 생성·빌드·브라우저 렌더링까지 완료했으며, 실제 서버의 CORS/쿠키/S3/Grok 응답은 아직 확인하지 못했습니다.

라이브 확인에는 다음 값이 필요합니다.

1. `NEXT_PUBLIC_API_BASE_URL` (경로 `/api`를 제외한 backend origin)
2. 로그인 가능한 테스트 계정 또는 OAuth 인가 URL
3. 백엔드의 credential CORS 허용 및 HTTPS 쿠키 설정

값을 설정한 뒤 실제 가입/로그인, 토큰 만료 재발급, 음성 업로드·분석 완료, 학습 기록 조회/삭제 시나리오를 실행하면 최종 운영 연동을 판정할 수 있습니다.
