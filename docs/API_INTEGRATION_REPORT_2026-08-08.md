# API ver.08/07 전체 연동 작업 보고서

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

`내 문장을 넣어서 연습하기`는 ver.08/07 명세에 사용자 정의 콘텐츠 생성 API가
없으므로 메뉴에서 제거했으며 기존 주소는 등록된 문장 연습으로 이동합니다.

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

| 검증                  | 결과 | 증거                                                           |
| --------------------- | ---- | -------------------------------------------------------------- |
| API 계약 검증         | 통과 | `npm run verify:api` → `53/53 endpoints + token refresh retry` |
| TypeScript            | 통과 | `npx tsc --noEmit`                                             |
| 변경 파일 ESLint      | 통과 | 변경된 TS/TSX 전체 오류 0건                                    |
| Next.js 프로덕션 빌드 | 통과 | Next.js 16.3.0, 21개 route 생성                                |
| 브라우저 루트 화면    | 통과 | `HAS_CONTENT`, Next 오류 overlay 없음                          |
| 브라우저 홈 화면      | 통과 | `HAS_CONTENT`, 탐색 링크 렌더링, Next 오류 overlay 없음        |
| 패키지 취약점         | 통과 | `npm install` audit: 0 vulnerabilities                         |

## 2026-08-20 화면 이동 재점검

- Notion 원본 데이터 소스의 53개 Method/Path와 `ApiContract`, 원격 구현,
  계약 검증 스크립트를 다시 대조해 53/53 일치를 확인했습니다.
- 랜딩의 카카오·네이버 버튼이 이메일 인증 화면에만 머물지 않고 선택한 OAuth
  인가 흐름을 시작하도록 수정했습니다. 설정되지 않은 공급자는 명확한 오류를
  표시합니다.
- 최근 학습 이어하기가 `sessionId`와 `resumeType`을 유지하도록 수정했습니다.
  분석 중인 세션은 상태 폴링을 재개하고, 완료 결과는 기록 상세로 이동합니다.
- 클래스 재시작 시 `POST /courses/{courseId}/start` 응답의 `lastStepId`를 반영해
  이어서 학습할 연습 단계를 선택합니다.
- 콘텐츠·클래스에서 연습 화면으로 들어간 경우 원래 목록으로 돌아가도록
  `returnTo`를 전달하고 내부 경로만 허용합니다.
- 학습 기록 목록/요약 카드가 새 `/mypage/history/{sessionId}` 상세 화면으로
  이동하며 상세 조회, 녹음 재생 URL 조회, 기록 삭제 API를 실제로 사용합니다.
- 로그인·온보딩·로그아웃·탈퇴 완료 후에는 `replace` 이동을 사용해 브라우저
  뒤로가기로 완료 전 화면에 되돌아가지 않도록 했습니다.

재점검 결과: `verify:api` 53/53, TypeScript, 변경 파일 ESLint, Next.js
프로덕션 빌드, 브라우저 주요 이동 경로와 콘솔 오류 검사가 모두 통과했습니다.

## 라이브 백엔드 확인 상태

### 2026-08-20 운영 경로 정리

- 인메모리 API와 고정 개발 계정을 제거했습니다. 백엔드 주소가 비어 있으면 동일
  오리진의 `/api`를 사용하며, 연결 실패를 가짜 성공 데이터로 대체하지 않습니다.
- 보호 경로는 `/api/users/me`로 세션을 확인한 뒤 렌더링하고, 401은 원래 이동
  목적지를 보존해 로그인 화면으로 이동합니다.
- 프로필은 서버 응답만 사용하며 API 실패 시 오래된 localStorage 값을 표시하지
  않습니다.
- Access Token은 localStorage에서 제거하고 메모리에만 보관하며, 새 문서에서는
  HttpOnly Refresh Cookie로 세션을 복구합니다.
- 콘텐츠·클래스·학습 기록 목록은 `page`와 `hasNext`를 사용해 다음 페이지를
  이어서 불러옵니다.
- 마이페이지에 점수 추이와 약점 추천 응답을 연결했습니다.
- 학습 화면 이탈 시 미완료 세션을 취소하고, 분석 실패 재시도·AI 코칭 재생성·
  다음 콘텐츠 조회 API를 실제 사용자 동작에 연결했습니다.
- 녹음 MIME 타입을 브라우저별로 협상하고 WebM/MP4/Ogg에 맞는 파일 확장자를
  업로드 명세에 전달합니다.

현재 `.env`에 설정된 라이브 백엔드를 대상으로 비파괴 요청을 확인했습니다.

- `GET /api/auth/email-availability`: HTTP 200, 공통 JSON 응답의
  `data.available`/`data.email` 확인
- `Origin: http://localhost:3000` 요청: 정확한
  `Access-Control-Allow-Origin`과 `Access-Control-Allow-Credentials: true` 확인
- `OPTIONS /api/auth/login`: HTTP 200, `Authorization`/`Content-Type` 요청 헤더와
  인증 API에 필요한 메서드 허용 확인
- 브라우저 회원가입 화면: 라이브 이메일 중복 확인 성공 문구와 콘솔 오류 0건 확인

실제 계정을 생성하거나 기존 사용자 데이터를 변경하는 검증은 수행하지 않았습니다.
최종 운영 판정에는 운영용 테스트 계정과 음성 샘플을 이용한 가입/로그인, 토큰 만료
재발급, presigned 업로드·분석 완료, 기록 조회/삭제 시나리오가 추가로 필요합니다.
