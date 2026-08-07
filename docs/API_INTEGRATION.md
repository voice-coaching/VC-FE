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
