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

`verify:api`는 53개 메서드를 모두 호출해 HTTP 메서드, 경로, 쿼리 파라미터가 명세와 일치하는지 검사합니다.
