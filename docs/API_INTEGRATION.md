# API 연동 가이드 (ver.08/07)

기준 문서: [운영 Swagger](https://api.voice-coaching.site/swagger-ui/index.html), [Notion API 명세서(ver.08/07)](https://app.notion.com/p/API-ver-08-07-3b5fd927f58c806db009d42373cbeb2a)

프론트엔드는 `src/lib/api/types.ts`의 `ApiContract`만 사용하며, `src/lib/api/remote.ts`가 운영 Swagger의 53개 operation을 구현합니다. 응답은 공통 `{ result, message, data }` 래퍼에서 `data`만 반환합니다.

2026-08-25 재검증 시 Notion 데이터베이스에는 50개가 있고 운영 Swagger에는 53개가 있습니다. Swagger에만 있는 아래 3개는 운영 서버에 실제 존재하고 마이페이지에서 사용하므로 삭제하지 않습니다.

- `GET /api/users/me/score-trends`
- `GET /api/users/me/strengths-weaknesses`
- `GET /api/users/me/weakness-recommendations`

## 환경 설정

```env
# 백엔드 origin만 입력합니다. 경로의 /api는 클라이언트가 붙입니다.
# 비워두면 프론트엔드와 동일한 origin을 사용합니다.
NEXT_PUBLIC_API_BASE_URL=https://backend.example.com
NEXT_PUBLIC_SITE_URL=https://frontend.example.com

NEXT_PUBLIC_GOOGLE_CLIENT_ID=
NEXT_PUBLIC_KAKAO_REST_API_KEY=
NEXT_PUBLIC_NAVER_CLIENT_ID=
NEXT_PUBLIC_APPLE_AUTH_URL=

NEXT_PUBLIC_GOOGLE_REDIRECT_URI=http://localhost:3000/oauth/google/callback
NEXT_PUBLIC_KAKAO_REDIRECT_URI=http://localhost:3000/oauth/kakao/callback
NEXT_PUBLIC_NAVER_REDIRECT_URI=http://localhost:3000/oauth/naver/callback
NEXT_PUBLIC_APPLE_REDIRECT_URI=
```

OAuth 공급자 콘솔에는 위 리다이렉트 URI를 정확히 등록해야 합니다. 운영에서는
`localhost` 대신 실제 HTTPS 프론트엔드 origin을 사용합니다. 스킴, 호스트, 포트,
경로, 마지막 슬래시가 하나라도 다르면 카카오는 `KOE006`, Google은
`redirect_uri_mismatch` 오류를 반환합니다.

백엔드는 credential 요청을 허용해야 합니다. 프론트엔드는 모든 요청에 `credentials: include`를 사용하며, Access Token은 `Authorization: Bearer ...`, Refresh Token은 서버가 설정한 HttpOnly Cookie로 전송합니다.

## 인증 및 재시도

- 이메일 회원가입 비밀번호는 운영 DTO와 동일하게 영문·숫자·특수문자를 모두 포함한 8~72자로 검사하며, 닉네임은 30자로 제한합니다.
- Access Token은 JavaScript 메모리에만 보관합니다. 새로고침 시 HttpOnly Refresh
  Cookie로 Access Token을 다시 발급받습니다.
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

## 화면 연결 보강

- 홈: 최근 학습은 `/api/home`의 `recentTraining`을 사용합니다. 별도 `GET /api/users/me/training-sessions/recent`는 기록이 없는 사용자를 404로 응답하므로 홈에서 중복 호출하지 않습니다. 홈·개인화 추천이 빈 이력에서 실패하면 0 상태와 일반 콘텐츠 목록으로 대체합니다.
- 설정: `PATCH /api/onboarding/me`로 학습 목표, 하루 학습 시간, 주간 횟수를 수정합니다.
- 클래스: 상세 보기에서 `GET /api/courses/{courseId}`, 이어 학습에서 `GET /api/courses/{courseId}/progress`를 사용합니다.
- 연습 이어하기: `GET /api/training-sessions/{sessionId}`로 세션과 콘텐츠를 검증합니다.
- 녹음 검토: `DELETE /api/training-sessions/{sessionId}/recordings/{recordingId}`로 분석하지 않을 시도를 삭제합니다.
- 결과: `GET /api/practice-contents/{contentId}/recommendations`로 유사 콘텐츠를 표시합니다. 운영 Swagger에 없는 `limit` 쿼리는 보내지 않습니다.

## 검증 명령

```bash
npm run verify:api
npx tsc --noEmit
npm run build
```

`verify:api`는 운영 Swagger의 53개 operation에 대해 HTTP 메서드, 경로, 쿼리 파라미터와 401 refresh 재시도를 검증합니다.
