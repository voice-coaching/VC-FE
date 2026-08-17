# API 연동 가이드 (ver.08/07)

기준 문서: [Notion API 명세서(ver.08/07)](https://app.notion.com/p/3a4bf91c409e8310bfc001e014b3bdff)

프론트엔드는 `src/lib/api/types.ts`의 `ApiContract`만 사용하며, `src/lib/api/remote.ts`가 명세의 53개 엔드포인트를 구현합니다. 응답은 공통 `{ result, message, data }` 래퍼에서 `data`만 반환합니다.

## 환경 설정

```env
# 백엔드 origin만 입력합니다. 경로의 /api는 클라이언트가 붙입니다.
# 비워두면 프론트엔드와 동일한 origin을 사용합니다.
NEXT_PUBLIC_API_BASE_URL=https://backend.example.com
NEXT_PUBLIC_ENABLE_DEV_ACCOUNT=false

NEXT_PUBLIC_GOOGLE_AUTH_URL=
NEXT_PUBLIC_KAKAO_AUTH_URL=
NEXT_PUBLIC_NAVER_AUTH_URL=
NEXT_PUBLIC_APPLE_AUTH_URL=
```

## 개발용 임시 계정

백엔드와 DB가 없는 로컬 개발 환경에서는 다음 계정으로 로그인 화면을 확인할 수 있습니다.

```text
이메일: dev@ttobak.local
비밀번호: Dev1234!
```

- `next dev`에서만 사용할 수 있으며 프로덕션 빌드에서는 비활성화됩니다.
- `NEXT_PUBLIC_API_BASE_URL`이 비어 있으면 자동으로 활성화됩니다.
- API 주소가 설정된 상태에서도 사용하려면 `NEXT_PUBLIC_ENABLE_DEV_ACCOUNT=true`를 설정합니다.
- 로그인과 로컬 프로필·홈 화면 확인 용도이며 실제 서버 데이터는 만들지 않습니다.

백엔드는 credential 요청을 허용해야 합니다. 프론트엔드는 모든 요청에 `credentials: include`를 사용하며, Access Token은 `Authorization: Bearer ...`, Refresh Token은 서버가 설정한 HttpOnly Cookie로 전송합니다.

## 인증 및 재시도

- Access Token은 브라우저 localStorage의 `ttobak.accessToken`에 저장합니다.
- Refresh Token은 JavaScript에서 읽거나 저장하지 않습니다.
- 인증 API가 401을 반환하면 `POST /api/auth/token/refresh`를 한 번 호출하고 원 요청을 한 번 재시도합니다.
- 여러 요청의 토큰 갱신이 겹치면 하나의 refresh 요청을 공유합니다.
- `x-new-access-token` 헤더 또는 `{ data: { newAccessToken } }` 형태도 처리합니다.
- refresh 실패, 로그아웃, 회원 탈퇴 시 Access Token을 제거합니다.

## 음성 분석 흐름

1. `POST /api/training-sessions`
2. `POST /api/training-sessions/{sessionId}/recordings/upload-url`
3. 발급된 presigned URL에 음성 Blob을 직접 `PUT`
4. `POST /api/training-sessions/{sessionId}/recordings`
5. `GET /api/training-sessions/{sessionId}/recordings`로 음질 검사 완료 대기
6. `PATCH /api/training-sessions/{sessionId}/recordings/{recordingId}/select`
7. `POST /api/training-sessions/{sessionId}/analyze`
8. `GET /api/training-sessions/{sessionId}/analysis/status` 폴링
9. `GET /api/analyses/{analysisId}`와 `/segments` 조회
10. `POST /api/training-sessions/{sessionId}/complete`

업로드는 `XMLHttpRequest`를 사용해 실제 전송률을 표시하며, 일반 API 20초/업로드 60초 타임아웃을 적용합니다.

## 검증 명령

```bash
npm run verify:api
npx tsc --noEmit
npm run build
```

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
=======
