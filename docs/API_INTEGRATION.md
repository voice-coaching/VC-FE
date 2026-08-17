<<<<<<< Updated upstream
# 또박 API 연동 규약

프론트엔드는 `src/lib/api/types.ts`의 `ApiContract`만 사용합니다. 개발 중에는 `mockApi`, 백엔드 연결 시에는 `createRemoteApi`가 같은 계약을 구현합니다.

```env
VITE_API_MODE=remote
VITE_API_BASE_URL=https://api.example.com/v1
```

## 공통 규칙

- JSON 요청은 `Content-Type: application/json`을 사용합니다.
- 음성 분석은 `multipart/form-data`를 사용하며 `audio`, `contentId`, `script`, `category`, `durationMs`를 전송합니다.
- 인증 요청에는 `Authorization: Bearer <accessToken>`과 `credentials: include`가 적용됩니다.
- 오류 응답 형식은 `{ "code": "ERROR_CODE", "message": "사용자 메시지", "details": {} }`입니다.
- 분석 요청 제한 시간은 60초, 일반 요청은 20초입니다.
- 날짜는 ISO 8601, 녹음 길이와 음절 타임스탬프는 밀리초 단위입니다.

## 엔드포인트

| 영역       | 메서드 및 경로                                                                          | 프론트 메서드                                          |
| ---------- | --------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| 계정       | `GET /auth/email/check?email=`                                                          | `auth.checkEmail`                                      |
| 계정       | `POST /auth/signup`, `POST /auth/login`                                                 | `auth.signUp`, `auth.signIn`                           |
| 계정       | `GET /auth/social/:provider`                                                            | `auth.socialLogin`                                     |
| 계정       | `GET /auth/session`, `POST /auth/refresh`                                               | `auth.getSession`, `auth.refresh`                      |
| 계정       | `POST /auth/logout`, `DELETE /account`                                                  | `auth.signOut`, `auth.withdraw`                        |
| 온보딩     | `GET /onboarding`, `PUT /onboarding`                                                    | `onboarding.get`, `onboarding.save`                    |
| 콘텐츠     | `GET /contents`, `GET /contents/:id`                                                    | `content.list`, `content.get`                          |
| 추천/이동  | `GET /contents/recommendations`, `GET /contents/:id/next`, `GET /contents/:id/previous` | `content.getRecommendations`, `getNext`, `getPrevious` |
| 예시 음성  | `GET /contents/:id/reference-audio`                                                     | `content.getReferenceAudio`                            |
| 분석       | `POST /analyses`, `POST /analyses/:id/retry`                                            | `practice.analyze`, `retryAnalysis`                    |
| 결과       | `GET /analyses/:id`, `POST /analyses/:id/complete`                                      | `practice.getResult`, `complete`                       |
| 클래스     | `GET /classes`, `GET /classes/:id`, `PUT /classes/:id/progress`                         | `classes.list`, `get`, `saveProgress`                  |
| 마이페이지 | `GET /me/summary`, `PATCH /me/profile`                                                  | `myPage.getSnapshot`, `updateProfile`                  |
| 기록       | `GET /me/history`, `GET /me/history/:id`                                                | `myPage.listHistory`, `getHistory`                     |

`AnalysisResult.syllables`에 `status`, `errorType`, `startMs`, `endMs`를 채우면 음절 상태 표시, 오류 유형, 선택 재생, 재생 위치 포커싱을 추가 API 변경 없이 활성화할 수 있습니다.
=======
# 운영 API 연동 가이드 (2026-08-17)

기준 문서: [운영 Swagger](https://api.voice-coaching.site/swagger-ui/index.html)

프론트엔드는 `src/lib/api/types.ts`의 `ApiContract`만 사용합니다. `src/lib/api/remote.ts`는 현재 Swagger의 52개 operation을 구현하고, 응답의 공통 `{ result, message, data }` 래퍼에서 `data`를 반환합니다.

## 환경 설정

```env
NEXT_PUBLIC_API_BASE_URL=https://api.voice-coaching.site
NEXT_PUBLIC_ENABLE_DEV_ACCOUNT=false

# 공개 식별자만 입력합니다. Client Secret은 프론트에 두지 않습니다.
NEXT_PUBLIC_GOOGLE_CLIENT_ID=
NEXT_PUBLIC_KAKAO_REST_API_KEY=
```

OAuth 공개 식별자 값은 각 개발자 콘솔에서 발급받아 로컬 `.env`와 Vercel 환경변수에 각각 설정해야 합니다.

## SNS 로그인

지원 provider는 `GOOGLE`, `KAKAO`입니다.

1. 로그인 버튼에서 provider의 인가 페이지 URL을 생성합니다.
2. CSRF 방지를 위한 일회성 `state`와 실제 `redirectUri`를 `sessionStorage`에 10분간 보관합니다.
3. provider가 아래 콜백으로 `code`와 `state`를 전달합니다.
4. 콜백에서 state를 검증한 뒤 `POST /api/auth/social-login`에 `provider`, `authorizationCode`, `redirectUri`를 보냅니다.
5. `isNewUser=true` 또는 `onboardingRequired=true`이면 `/onboarding`, 아니면 `/home`으로 이동합니다.

등록된 Redirect URI:

- 운영 Google: `https://vc-fe.vercel.app/oauth/google/callback`
- 운영 Kakao: `https://vc-fe.vercel.app/oauth/kakao/callback`
- 로컬 Google: `http://localhost:3000/oauth/google/callback`
- 로컬 Kakao: `http://localhost:3000/oauth/kakao/callback`

Google의 `access_denied`, Kakao의 `error`/`error_reason` 등 취소·오류 응답은 콜백 화면에서 처리합니다. Kakao 이메일이 없는 응답도 허용합니다.

## 토큰과 세션 복원

- 모든 Backend 요청은 `credentials: "include"`를 사용합니다.
- Access Token은 `localStorage`의 `ttobak.accessToken`에 저장하고 `Authorization: Bearer ...`로 전송합니다.
- Refresh Token은 JavaScript에서 읽거나 저장하지 않고 서버의 HttpOnly Cookie로만 전송합니다.
- 보호 API가 401을 반환하면 `POST /api/auth/token/refresh`를 한 번 호출한 뒤 원 요청을 한 번 재시도합니다.
- 동시에 여러 요청이 401을 받아도 하나의 refresh 요청을 공유합니다.
- 앱 시작 시 `/api/users/me`로 세션을 확인합니다. Access Token이 없거나 만료되면 위 refresh 흐름으로 복원합니다.
- OAuth 콜백에서는 인가 코드 교환과 세션 복원이 경쟁하지 않도록 시작 시 복원을 건너뜁니다.
- refresh 실패, 로그아웃, 회원 탈퇴 시 Access Token을 제거합니다.

운영 도메인 `https://vc-fe.vercel.app`과 로컬 `http://localhost:3000` 모두 Backend CORS의 credential 요청이 허용되는 것을 확인했습니다.

## 음성 분석 흐름

1. `POST /api/training-sessions`
2. `POST /api/training-sessions/{sessionId}/recordings/upload-url`
3. 발급된 presigned URL에 음성 Blob을 직접 `PUT`
4. `POST /api/training-sessions/{sessionId}/recordings`
5. 녹음 목록을 폴링해 음질 검사 완료 대기
6. 분석할 녹음을 선택
7. 분석 요청 후 상태 폴링
8. 종합 결과와 구간별 결과 조회
9. 학습 세션 완료 처리

업로드는 `XMLHttpRequest`로 실제 전송률을 표시합니다. 일반 API는 20초, 업로드는 60초 타임아웃을 적용합니다.

## Swagger 정합성 변경

이전 계약에 있던 `GET /api/practice-contents/{contentId}/recommendations`는 현재 Swagger에 없어 제거했습니다. 개인화 추천은 현재 제공되는 `GET /api/recommendations`를 사용합니다.

## 검증 명령

```bash
npm run verify:api
npm run verify:dev-api
npm run verify:dev-account
npm run lint
npm run build
```

`verify:api`는 현재 Swagger의 52개 operation에 대해 HTTP 메서드, 경로, 쿼리 파라미터와 401 refresh 재시도를 검증합니다.
>>>>>>> Stashed changes
