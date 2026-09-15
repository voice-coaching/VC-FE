# SpeakAI 신규 백엔드 API 기능명세서

작성일: 2026-09-15  
대상 디자인: Figma `ZvdY7HlvuSgSAlg4o9W0JC`, `03_Screen / Frame 1000002915` (`571:2245`)  
목적: 최신 디자인에서 예시·로컬·안내 상태로 남은 기능을 실제 서비스 기능으로 전환한다.

## 1. 범위

운영 Swagger 기준 기존 API는 53개다. 프론트 어댑터에는 여기에 프로필 사진 4개와 칭호·승급 시험 4개를 추가해 총 61개 계약이 정의돼 있다. 기존 경로와 상세 타입은 [API 연동 문서](API_INTEGRATION.md)를 기준으로 한다.

현재 인접 로컬 `VC-BE`에서 실제 매핑이 확인된 API는 다음 3개뿐이다.

- `GET /api/onboarding/me`
- `PUT /api/onboarding/me`
- `PATCH /api/onboarding/me`

따라서 백엔드는 다음 두 작업을 구분해야 한다.

1. 기존 53개 프론트 계약 중 로컬에 없는 API 구현
2. 이 문서에서 정의하는 신규 디자인 API 구현

이 문서는 2번의 기능·데이터 계약을 정의한다. 기존 API의 구현 완료 전에는 로그인부터 분석 결과까지 실제 종단 검증이 불가능하다.

## 2. 우선순위 요약

| 우선순위 | 기능                    | 신규/변경 계약                                   |
| -------- | ----------------------- | ------------------------------------------------ |
| P0       | 사용자 입력 문장 분석   | `POST /api/practice-contents/custom`             |
| P0       | 클래스 실제 교육 내용   | `GET /api/courses/{courseId}/steps/{stepId}`     |
| P0       | 결과·마이 억양 실데이터 | 분석 prosody curve, 사용자 prosody profile       |
| P0       | 법적 동의 이력          | 법률 문서 조회, 동의 조회·변경, signup 요청 확장 |
| P0       | 프로필 사진             | 사진 조회·등록·교체·삭제                         |
| P0       | 칭호와 승급 시험        | 칭호 진행도, 시험 생성·조회·서버 채점            |
| P0       | 예문·Chirp 음성         | 단계별 예문 5개, 서버 합성 음성                  |
| P1       | 콘텐츠 카드와 필터      | facets, summary 메타데이터 확장, adjacent        |
| P1       | 비밀번호 재설정         | reset request, reset confirm                     |
| P1       | 연습 알림과 알림함      | preferences, push subscriptions, notifications   |
| P1       | 공지와 문의             | notices, inquiries                               |
| P2       | 구독 관리               | products, current subscription, checkout, portal |

## 3. 공통 규칙

### 3.1 인증과 응답

- 인증 API를 제외한 모든 요청은 `Authorization: Bearer {accessToken}`을 사용한다.
- 토큰 재발급은 기존 HttpOnly refresh cookie 계약을 유지한다.
- 성공과 오류 모두 기존 envelope를 유지한다.

```json
{
  "result": true,
  "message": "OK",
  "data": {},
  "code": "OPTIONAL_MACHINE_CODE"
}
```

- 시간은 ISO 8601 UTC 문자열로 반환한다. 예: `2026-09-15T00:30:00Z`.
- 페이지 목록은 기존 `PageResult<T>`를 사용한다. `hasNext`는 모든 목록에서 필수로 반환한다.
- 생성 요청은 `Idempotency-Key` 헤더를 지원한다. 같은 사용자·키·요청 본문은 같은 결과를 반환한다.
- 클라이언트에 Java 예외명, SQL, object storage key, 결제사 원문 오류를 노출하지 않는다.

### 3.2 공통 오류 코드

| HTTP | code                      | 의미                                     |
| ---- | ------------------------- | ---------------------------------------- |
| 400  | `VALIDATION_ERROR`        | 필드 형식, 길이, enum 오류               |
| 401  | `AUTHENTICATION_REQUIRED` | 로그인 필요                              |
| 403  | `FORBIDDEN`               | 본인 소유가 아니거나 동의·상품 권한 부족 |
| 404  | `RESOURCE_NOT_FOUND`      | 리소스 없음                              |
| 409  | `CONFLICT`                | 상태 충돌 또는 이미 처리됨               |
| 410  | `RESOURCE_EXPIRED`        | 임시 콘텐츠·토큰 만료                    |
| 413  | `PAYLOAD_TOO_LARGE`       | 원고·첨부·오디오 제한 초과               |
| 422  | `UNPROCESSABLE_AUDIO`     | 분석 가능한 음성이 아님                  |
| 429  | `RATE_LIMITED`            | 재시도 제한, `Retry-After` 포함          |
| 503  | `TEMPORARY_UNAVAILABLE`   | 일시 장애, 안전하게 재시도 가능          |

## 4. 사용자 입력 문장 연습

### 4.1 사용자 입력 콘텐츠 생성

`POST /api/practice-contents/custom` — P0

사용자가 `/my-script`에 입력한 원고를 기존 학습 세션에서 사용할 수 있는 사용자 소유 콘텐츠로 만든다. 반환된 `id`는 기존 `POST /api/training-sessions`의 `contentId`로 전달한다.

요청:

```json
{
  "title": "내 문장",
  "scriptText": "프로젝트의 핵심 목표를 또렷하게 전달하겠습니다.",
  "learningFocus": "BOTH",
  "retention": "SESSION_HISTORY",
  "locale": "ko-KR"
}
```

검증:

- `scriptText`: trim 후 1~300 Unicode code point
- 제어문자, 빈 문장, 지원하지 않는 locale은 400
- `learningFocus`: `PRONUNCIATION | INTONATION | BOTH`
- `retention`: 현재 디자인에서는 `SESSION_HISTORY`만 지원한다.

응답 `201`:

```json
{
  "result": true,
  "message": "사용자 문장을 만들었습니다.",
  "data": {
    "id": "custom_01J7Z5C8W2",
    "contentType": "SENTENCE",
    "origin": "USER_INPUT",
    "title": "내 문장",
    "category": "CUSTOM",
    "difficulty": "INTERMEDIATE",
    "estimatedSeconds": 15,
    "learningFocus": "BOTH",
    "description": "직접 입력한 문장으로 연습해요.",
    "scriptText": "프로젝트의 핵심 목표를 또렷하게 전달하겠습니다.",
    "targetPronunciations": [],
    "referenceAudioAvailable": false,
    "sentences": [
      {
        "sequenceNo": 1,
        "text": "프로젝트의 핵심 목표를 또렷하게 전달하겠습니다.",
        "startOffset": 0,
        "endOffset": 28
      }
    ],
    "createdAt": "2026-09-15T00:30:00Z"
  }
}
```

동작 규칙:

- 콘텐츠와 이후 세션은 요청 사용자만 조회한다.
- 학습 기록을 삭제하면 관련 사용자 입력 원문과 음원도 보존 정책에 따라 제거한다.
- 기존 녹음 업로드, 음질 검사, 분석, 결과, 기록 API를 그대로 재사용한다.
- 서버가 문장 분리를 결정한다. 프론트의 로컬 분리 결과와 다르면 서버 결과를 최종으로 표시한다.

완료 기준:

- 내 문장 결과가 `sampleAnalysis` 없이 실제 분석 ID와 세그먼트를 사용한다.
- 완료한 내 문장이 마이 기록에 표시되고 재접속 후에도 조회된다.
- 다른 사용자의 custom content ID 접근은 403 또는 404다.

## 5. 억양 비교와 사용자 억양 프로필

### 5.1 분석별 prosody curve

`GET /api/analyses/{analysisId}/prosody-curve` — P0

Figma의 “속도와 억양” 탭에서 내 억양과 기준 억양을 실제 시계열로 그린다.

응답 `200`:

```json
{
  "result": true,
  "message": "OK",
  "data": {
    "analysisId": 1001,
    "unit": "SEMITONE",
    "sampleIntervalMs": 50,
    "durationMs": 7240,
    "referenceAvailable": true,
    "points": [
      { "timeMs": 0, "userPitch": null, "referencePitch": null },
      { "timeMs": 50, "userPitch": 2.41, "referencePitch": 2.76 },
      { "timeMs": 100, "userPitch": 2.6, "referencePitch": 2.81 }
    ],
    "markers": [
      { "type": "PAUSE", "startMs": 2850, "endMs": 3160, "status": "NORMAL" },
      {
        "type": "STRESS",
        "timeMs": 4520,
        "label": "핵심",
        "status": "NEEDS_IMPROVEMENT"
      }
    ],
    "generatedAt": "2026-09-15T00:31:00Z"
  }
}
```

규칙:

- 무성 구간은 `null`; 0으로 대체하지 않는다.
- 동일 분석 ID에는 같은 좌표를 반환해 시각 결과가 흔들리지 않게 한다.
- 기준 음성이 없는 콘텐츠는 `referenceAvailable=false`, referencePitch는 전부 `null`이다.
- 최대 400 points를 권장하며 더 긴 음원은 서버에서 다운샘플링한다.

### 5.2 기간별 사용자 prosody profile

`GET /api/users/me/prosody-profile?period=MONTH&timezone=Asia%2FSeoul` — P0

마이의 “억양 특성”을 실제 학습 데이터로 채운다.

응답 `200`:

```json
{
  "result": true,
  "message": "OK",
  "data": {
    "period": { "from": "2026-09-01", "to": "2026-09-30" },
    "minimumDataSatisfied": true,
    "analyzedSessionCount": 12,
    "traits": [
      {
        "code": "RISING_SENTENCE_END",
        "label": "문장 끝을 올려 읽는 편",
        "confidence": 0.87,
        "evidenceCount": 9,
        "recommendation": { "targetType": "COURSE", "courseId": 403 }
      }
    ],
    "updatedAt": "2026-09-15T00:31:00Z"
  }
}
```

데이터가 부족하면 `traits=[]`, `minimumDataSatisfied=false`를 반환하고 프론트는 예시 문구 대신 빈 상태를 표시한다.

## 6. 클래스 단계 상세

### 6.1 단계 교육 콘텐츠 조회

`GET /api/courses/{courseId}/steps/{stepId}` — P0

기존 `GET /api/courses/{courseId}/steps`는 목록·잠금·진도용 요약을 유지한다. 새 상세 API는 제목 문자열 추론을 없애고 실제 학습 내용을 제공한다.

응답 `200`:

```json
{
  "result": true,
  "message": "OK",
  "data": {
    "id": 4012,
    "courseId": 401,
    "stepOrder": 2,
    "stepType": "AUDIO_EXAMPLE",
    "title": "좋은 예시 들어보기",
    "subtitle": "받침 ㄹ의 위치와 소리에 집중해 보세요.",
    "contentRevision": 3,
    "blocks": [
      {
        "type": "DIAGRAM",
        "diagram": {
          "kind": "TONGUE_POSITION_RIEUL",
          "altText": "혀끝을 윗잇몸 뒤에 붙이는 위치"
        }
      },
      {
        "type": "CHECKLIST",
        "items": [
          "혀끝을 윗잇몸 뒤에 붙여요",
          "혀를 떼면서 소리를 내요",
          "끝까지 힘을 유지해요"
        ]
      },
      {
        "type": "PRACTICE_PROMPT",
        "practiceContentId": 201
      }
    ],
    "completed": false
  }
}
```

지원 block type:

- `TEXT`: `title?`, `body`
- `IMAGE`: `assetUrl`, `altText`, `aspectRatio`
- `DIAGRAM`: 검증된 `kind`, `altText`
- `CHECKLIST`: `items[]`
- `AUDIO`: 기존 reference audio ID
- `PRACTICE_PROMPT`: 기존 practice content ID

규칙:

- 프론트는 임의 HTML을 렌더링하지 않는다. 서버는 구조화 block만 반환한다.
- `courseId`와 `stepId`가 일치하지 않으면 404다.
- 게시된 revision은 기존 세션이 끝날 때까지 유지한다.

## 7. 콘텐츠 목록 메타데이터와 이동

### 7.1 필터 taxonomy

`GET /api/practice-contents/facets?type=NEWS` — P1

응답 `200`:

```json
{
  "result": true,
  "message": "OK",
  "data": {
    "type": "NEWS",
    "categories": [
      { "value": "SOCIETY", "label": "사회", "count": 24, "order": 1 },
      { "value": "ECONOMY", "label": "경제", "count": 18, "order": 2 }
    ],
    "difficulties": [
      { "value": "BEGINNER", "label": "초급", "count": 20, "order": 1 }
    ],
    "revision": "2026-09-15.1"
  }
}
```

프론트는 한글 라벨을 필터 값으로 전송하지 않고 `value`를 사용한다.

### 7.2 콘텐츠 summary 확장

기존 `PracticeContentSummary`에 다음 필드를 추가한다.

```json
{
  "publisher": "연합뉴스",
  "paragraphCount": 5,
  "sentenceCount": 3,
  "syllableCount": null,
  "publishedAt": "2026-09-15T00:00:00Z"
}
```

- NEWS: `publisher`, `paragraphCount`, `sentenceCount` 필수
- SENTENCE: `syllableCount` 필수
- ANNOUNCER: `speakerName` 또는 대표 reference audio의 화자 표시
- 프론트가 제목에서 음절 수를 계산하지 않는다.

### 7.3 이전·다음 콘텐츠

`GET /api/practice-contents/{contentId}/adjacent?type=NEWS&category=SOCIETY&difficulty=BEGINNER` — P1

```json
{
  "result": true,
  "message": "OK",
  "data": {
    "previous": { "id": 100, "title": "이전 기사" },
    "next": { "id": 102, "title": "다음 기사" }
  }
}
```

첫 항목의 `previous`, 마지막 항목의 `next`는 `null`이다. 정렬 기준은 목록 API와 동일해야 한다.

## 8. 법률 문서와 동의 이력

### 8.1 현재 법률 문서 조회

`GET /api/legal-documents/{type}?locale=ko-KR` — P0

`type`: `TERMS_OF_SERVICE | PRIVACY | QUALITY_IMPROVEMENT | MARKETING`

```json
{
  "result": true,
  "message": "OK",
  "data": {
    "type": "PRIVACY",
    "version": "2026-09-15",
    "title": "개인정보 수집 및 이용",
    "required": true,
    "effectiveAt": "2026-09-15T00:00:00Z",
    "sections": [
      {
        "title": "수집 항목",
        "paragraphs": ["이메일, 닉네임, 학습 기록과 음성 데이터를 처리합니다."]
      }
    ]
  }
}
```

### 8.2 내 동의 조회

`GET /api/users/me/consents` — P0

문서 type별 `agreed`, `documentVersion`, `agreedAt`, `withdrawnAt`을 반환한다.

### 8.3 동의 또는 철회

`PUT /api/users/me/consents/{type}` — P0

```json
{
  "agreed": false,
  "documentVersion": "2026-09-15",
  "source": "SETTINGS"
}
```

- 필수 약관 철회는 계정 이용 중 직접 허용하지 않고 409 `REQUIRED_CONSENT`를 반환한다.
- 마케팅 철회는 즉시 발송 대상에서 제외한다.
- 동의 변경은 append-only 감사 이력으로 남긴다.

### 8.4 회원가입 계약 변경

기존 `termsAgreed`, `privacyAgreed` boolean 대신 versioned consents를 받는다.

```json
{
  "email": "new@example.com",
  "password": "********",
  "nickname": "새사용자",
  "consents": [
    { "type": "AGE_OVER_14", "agreed": true, "documentVersion": "2026-09-15" },
    {
      "type": "TERMS_OF_SERVICE",
      "agreed": true,
      "documentVersion": "2026-09-15"
    },
    { "type": "PRIVACY", "agreed": true, "documentVersion": "2026-09-15" },
    {
      "type": "QUALITY_IMPROVEMENT",
      "agreed": false,
      "documentVersion": "2026-09-15"
    },
    { "type": "MARKETING", "agreed": false, "documentVersion": "2026-09-15" }
  ]
}
```

이전 boolean 필드는 한 릴리스 동안만 호환하고 이후 제거한다.

## 9. 비밀번호 재설정

### 9.1 재설정 요청

`POST /api/auth/password-reset/requests` — P1

```json
{
  "email": "user@example.com",
  "redirectUri": "https://app.example.com/password-reset"
}
```

- 계정 존재 여부와 관계없이 `202`와 같은 문구를 반환해 이메일 열거를 막는다.
- 사용자·IP 기준 rate limit을 적용한다.
- 소셜 로그인 전용 계정도 동일한 외부 응답을 주고 내부적으로 안내 메일 정책을 적용한다.

### 9.2 새 비밀번호 확정

`POST /api/auth/password-reset/confirm` — P1

```json
{ "token": "single-use-token", "newPassword": "********" }
```

성공 시 모든 기존 refresh session을 폐기하고 `204` 또는 `data:null`을 반환한다. 만료·사용 완료 token은 410 `RESET_TOKEN_EXPIRED`다.

## 10. 연습 알림과 알림함

### 10.1 환경설정 조회·변경

- `GET /api/users/me/notification-preferences` — P1
- `PATCH /api/users/me/notification-preferences` — P1

```json
{
  "practiceReminder": {
    "enabled": true,
    "time": "21:00",
    "daysOfWeek": ["MON", "WED", "FRI"],
    "timezone": "Asia/Seoul"
  },
  "marketing": { "enabled": false },
  "updatedAt": "2026-09-15T00:40:00Z"
}
```

마케팅 알림은 `MARKETING` 동의가 없으면 켤 수 없으며 409를 반환한다. 연습 알림과 마케팅 동의를 혼합하지 않는다.

### 10.2 Web Push 구독

- `POST /api/users/me/push-subscriptions` — P1
- `DELETE /api/users/me/push-subscriptions/{subscriptionId}` — P1

등록 요청은 `endpoint`, `keys.p256dh`, `keys.auth`, `userAgent`, `deviceName?`을 받는다. 같은 endpoint 재등록은 멱등 처리한다. 만료·410 Gone endpoint는 서버가 비활성화한다.

### 10.3 알림 목록과 읽음

- `GET /api/notifications?page=0&size=20&unreadOnly=false` — P1
- `PATCH /api/notifications/{notificationId}/read` — P1
- `POST /api/notifications/read-all` — P1

알림 항목:

```json
{
  "id": 8801,
  "type": "PRACTICE_REMINDER",
  "title": "오늘 연습을 시작해 볼까요?",
  "body": "추천 뉴스 3문장이 준비됐어요.",
  "deepLink": "/home",
  "readAt": null,
  "createdAt": "2026-09-15T12:00:00Z"
}
```

목록 응답에는 `unreadCount`를 함께 제공한다. `deepLink`는 허용된 앱 내부 경로만 저장한다.

## 11. 공지사항과 1:1 문의

### 11.1 공지사항

- `GET /api/notices?page=0&size=20` — P1
- `GET /api/notices/{noticeId}` — P1

목록 항목은 `id`, `title`, `pinned`, `publishedAt`, `summary`; 상세는 구조화 `sections` 또는 sanitizing된 Markdown을 반환한다. 게시 전·숨김 공지는 일반 사용자에게 노출하지 않는다.

### 11.2 문의

- `POST /api/inquiries` — P1
- `GET /api/users/me/inquiries?page=0&size=20` — P1
- `GET /api/users/me/inquiries/{inquiryId}` — P1

생성 요청:

```json
{
  "category": "ANALYSIS",
  "subject": "분석 결과 문의",
  "body": "분석 결과의 억양 그래프를 확인하고 싶습니다.",
  "relatedSessionId": 701,
  "replyEmail": "user@example.com"
}
```

- `subject` 1~~100자, `body` 1~~2000자
- 상태: `RECEIVED | IN_PROGRESS | ANSWERED | CLOSED`
- 다른 사용자의 문의는 404로 처리한다.
- 첨부가 필요해지면 녹음 업로드 URL을 재사용하지 말고 문의 전용 presigned upload 계약을 별도로 둔다.

## 12. 구독 관리

제품·결제 정책이 확정되기 전까지 메뉴를 준비 중으로 표시한다. 메뉴를 실제 기능으로 출시할 때 다음 계약을 사용한다.

- `GET /api/subscription-products` — P2
- `GET /api/users/me/subscription` — P2
- `POST /api/billing/checkout-sessions` — P2
- `POST /api/billing/portal-sessions` — P2

현재 구독 응답은 `status`, `product`, `currentPeriodEnd`, `cancelAtPeriodEnd`, `provider`를 포함한다. 결제·해지 상태는 결제사 webhook을 서버가 검증한 뒤 반영하며 프론트 redirect만으로 활성화하지 않는다. checkout/portal session 생성은 `Idempotency-Key`를 요구한다.

## 13. 기존 API에 필요한 보강

신규 endpoint 외에 다음 기존 계약을 함께 보강해야 한다.

| 기존 계약                                   | 보강 내용                                                                         |
| ------------------------------------------- | --------------------------------------------------------------------------------- |
| `POST /api/training-sessions/{id}/complete` | 멱등 처리, 기존 실제 학습 시간을 1초 같은 임의 값으로 덮지 않음                   |
| `GET /api/users/me/training-sessions/{id}`  | `analysis.id`를 항상 제공해 기존 분석·segment·prosody API를 이어 조회 가능하게 함 |
| `GET /api/practice-contents`                | `hasNext` 필수, summary 메타데이터 추가                                           |
| `GET /api/courses/{id}/steps`               | `stepCount`와 items 길이의 정합 보장; 상세 내용은 새 step detail로 분리           |
| `GET /api/home`                             | 알림 배지용 `unreadNotificationCount` 추가 또는 알림 목록의 별도 선조회 허용      |
| `GET /api/users/me/strengths-weaknesses`    | 한 섹션 장애가 통계·기록 응답을 막지 않도록 독립 장애 경계 유지                   |

## 14. 보안·개인정보·운영 요구사항

- 원고와 음성은 민감 사용자 콘텐츠로 분류하고 저장 시 암호화한다.
- 분석 작업 로그에 원문·presigned URL·push endpoint·reset token을 남기지 않는다.
- 음원과 custom script 삭제 정책을 개인정보 처리방침 및 탈퇴 처리와 일치시킨다.
- presigned URL은 짧게 만료시키고 사용자·session·mime type·최대 크기를 검증한다.
- password reset token은 해시 저장, 1회용, 짧은 만료 시간을 사용한다.
- 알림 deep link와 공지 Markdown은 allowlist/sanitize한다.
- 신규 생성 API는 request ID와 idempotency key를 로그에 남기되 개인정보는 마스킹한다.
- 지표: API p95, 4xx/5xx, 분석 소요 시간, push 성공률, reset 요청률, 문의 접수 성공률.

## 15. 프론트-백엔드 통합 완료 조건

- OpenAPI에 이 문서의 endpoint, enum, 예시, 오류 code가 반영돼 있다.
- 프론트 타입 생성 또는 수동 타입과 OpenAPI schema diff가 0이다.
- 정상, 빈 목록, 400, 401-refresh, 403, 404, 409, 429, 503 계약 테스트가 있다.
- 내 문장 입력 → 세션 → 업로드 → 음질 검사 → 분석 → 결과 → 마이 기록이 실제 서버로 완료된다.
- 분석 결과 화면의 곡선이 서로 다른 두 녹음에서 서로 다른 좌표를 표시한다.
- 데이터 부족 사용자의 마이 억양 특성은 예시가 아니라 빈 상태다.
- 클래스 목록 → 단계 상세 → 예시 → 연습 → 진도 저장 → 완료가 새로고침 후 유지된다.
- 약관 상세를 읽고 동의한 문서 버전과 시간이 서버에서 조회된다.
- 알림 토글은 다른 기기에서도 동기화되고, 동의 철회 후 마케팅 발송이 중단된다.
- 비밀번호 재설정 요청은 계정 존재 여부를 외부 응답으로 노출하지 않는다.
- 공지·문의·구독 메뉴는 실제 데이터 또는 명확한 제품 미출시 상태 중 하나만 보여준다.

## 16. 권장 구현 순서

1. 기존 53개 계약 중 로컬 미구현 API와 인증 사용자 식별을 완성한다.
2. 프로필 사진 CRUD와 칭호·승급 시험을 구현한다.
3. custom content, course step detail, prosody curve/profile, versioned consent를 구현한다.
4. 단계별 예문과 Chirp 음성 캐시를 구현한다.
5. content facets·summary·adjacent와 password reset을 구현한다.
6. notification preferences·push·notification center를 구현한다.
7. notices와 inquiries를 구현한다.
8. 결제 정책 확정 후 subscription API를 구현한다.
9. 각 단계가 끝날 때 목 응답을 제거하고 실제 서버 종단 테스트와 모바일 시각 회귀를 통과시킨다.

## 17. 프로필 사진 CRUD

사용자 사진은 닉네임과 분리된 리소스로 관리한다. 기존 `GET /api/users/me`에는 목록·헤더에서 추가 조회 없이 표시할 수 있도록 `profileImageUrl: string | null`을 추가한다.

### 17.1 조회

`GET /api/users/me/profile-image` — P0

사진이 없을 때도 오류 대신 `200`과 `data: null`을 반환한다. 사진이 있으면 다음 형식이다.

```json
{
  "result": true,
  "message": "OK",
  "data": {
    "id": 501,
    "imageUrl": "https://cdn.example.com/profiles/501.webp",
    "originalFileName": "profile.png",
    "mimeType": "image/webp",
    "sizeBytes": 184320,
    "updatedAt": "2026-09-15T05:00:00Z"
  }
}
```

### 17.2 등록·교체·삭제

- `POST /api/users/me/profile-image` — 최초 등록, `multipart/form-data`의 `file`
- `PUT /api/users/me/profile-image` — 기존 사진 교체, 동일한 multipart 계약
- `DELETE /api/users/me/profile-image` — 현재 사진 삭제, 성공 `204`

`POST`는 사진이 이미 있으면 409 `PROFILE_IMAGE_EXISTS`, `PUT`은 기존 사진이 없으면 404 `PROFILE_IMAGE_NOT_FOUND`다. `DELETE`는 멱등 처리하며 이미 사진이 없어도 `204`를 반환한다.

검증·보안 규칙:

- 허용 형식: JPEG, PNG, WebP; 최대 5MB
- 확장자나 요청 Content-Type이 아니라 파일 signature를 검증한다.
- 디코딩 실패, 가로·세로 128px 미만, 4096px 초과 이미지는 400 `INVALID_PROFILE_IMAGE`다.
- 서버에서 정사각형 썸네일을 생성하고 EXIF 위치·촬영 정보를 제거한다.
- 교체·삭제 성공 후 기존 원본과 파생 이미지는 비동기로 제거하되 응답 직후 새 URL만 노출한다.
- 이미지 URL은 사용자 인증 토큰을 query string에 포함하지 않는 안정적인 CDN URL이어야 한다.
- 탈퇴 시 원본·파생 이미지 모두 개인정보 파기 대상에 포함한다.

## 18. 사용자 칭호와 승급 시험

칭호 순서는 `왕초보 → 초보 → 동네 아나운서 → 아나운서 지망생 → 아나운서`다. 학습 횟수는 **시험 응시 자격**만 열며 자동 승급시키지 않는다. 승급은 서버가 소유한 분석 점수가 합격 기준 이상일 때만 원자적으로 반영한다.

기본 정책은 다음과 같고, 운영 변경을 위해 프론트 하드코딩 대신 API 응답을 최종 기준으로 사용한다.

| 목표 칭호       | 누적 완료 학습 | 합격 점수 |
| --------------- | -------------- | --------- |
| 초보            | 5회            | 70점      |
| 동네 아나운서   | 15회           | 75점      |
| 아나운서 지망생 | 30회           | 80점      |
| 아나운서        | 60회           | 85점      |

### 18.1 내 칭호와 응시 자격

`GET /api/users/me/title` — P0

```json
{
  "result": true,
  "message": "OK",
  "data": {
    "code": "ABSOLUTE_BEGINNER",
    "label": "왕초보",
    "completedTrainingCount": 5,
    "minimumTrainingCount": 0,
    "next": {
      "code": "BEGINNER",
      "label": "초보",
      "requiredTrainingCount": 5,
      "remainingTrainingCount": 0,
      "passingScore": 70,
      "eligible": true
    },
    "updatedAt": "2026-09-15T05:00:00Z"
  }
}
```

최고 칭호는 `next: null`이다. `completedTrainingCount`에는 `COMPLETED` 상태이며 삭제·무효 처리되지 않은 학습만 포함한다. 재분석과 결과 재열람은 횟수를 늘리지 않는다.

### 18.2 시험 생성과 조회

- `POST /api/users/me/title-exams` — 현재 단계의 다음 승급 시험 생성
- `GET /api/users/me/title-exams/{examId}` — 진행 중이거나 완료한 시험 조회

생성 응답 `201`:

```json
{
  "result": true,
  "message": "승급 시험을 준비했습니다.",
  "data": {
    "id": 901,
    "currentTitle": "왕초보",
    "targetTitle": "초보",
    "practiceContentId": 4101,
    "requiredTrainingCount": 5,
    "passingScore": 70,
    "status": "READY",
    "createdAt": "2026-09-15T05:01:00Z"
  }
}
```

- 자격 미달은 409 `TITLE_EXAM_NOT_ELIGIBLE`, 최고 칭호는 409 `MAX_TITLE_REACHED`다.
- 같은 목표의 `READY | IN_PROGRESS` 시험이 있으면 새 시험을 중복 생성하지 않고 기존 시험을 반환한다.
- 시험 콘텐츠는 일반 콘텐츠와 동일하게 조회하지만 시험 ID와 사용자에게 고정한다.
- `POST /api/training-sessions`는 선택 필드 `titleExamId`를 받고, 해당 시험의 `practiceContentId`와 일치하는지 검증한다.

### 18.3 시험 제출과 승급

`POST /api/users/me/title-exams/{examId}/submit` — P0

```json
{ "analysisId": 7301 }
```

응답 `200`:

```json
{
  "result": true,
  "message": "승급 시험 채점이 완료됐습니다.",
  "data": {
    "examId": 901,
    "status": "PASSED",
    "score": 78,
    "passingScore": 70,
    "passed": true,
    "previousTitle": "왕초보",
    "currentTitle": "초보",
    "evaluatedAt": "2026-09-15T05:03:00Z"
  }
}
```

- 클라이언트는 점수를 제출하지 않는다. 서버가 시험 세션에 연결된 `analysisId`의 `overallScore`를 조회한다.
- 분석·시험·사용자의 소유권과 지정 콘텐츠 일치를 모두 검증한다.
- `score >= passingScore`일 때만 시험 `PASSED`와 사용자 칭호 변경을 한 트랜잭션으로 처리한다.
- 제출 재시도는 같은 결과를 반환하는 멱등 요청이어야 한다. 이미 채점된 시험의 다른 분석 제출은 409 `TITLE_EXAM_ALREADY_GRADED`다.
- 불합격해도 누적 학습 횟수는 유지한다. 새 시험을 생성해 재응시할 수 있다.
- 정책 변경은 이미 생성된 시험의 `passingScore`를 바꾸지 않는다.

## 19. 추가 누락 API: 단계별 예문과 Chirp 음성

현재 프론트의 단계별 예문 5개와 Google Chirp 3 HD 합성은 로컬 데이터 및 프론트 서버 route에 머물러 있다. 운영 콘텐츠 관리와 다기기 일관성을 위해 다음 계약이 추가로 필요하다.

### 19.1 단계별 연습 예문

`GET /api/courses/{courseId}/steps/{stepId}/practice-examples` — P0

응답은 정확히 5개의 게시된 예문을 `order` 순서로 반환한다.

```json
{
  "result": true,
  "message": "OK",
  "data": {
    "courseId": 203,
    "stepId": 306,
    "revision": 4,
    "items": [
      {
        "id": "final-consonant-2",
        "order": 2,
        "text": "꽃밭 끝에 햇빛이 밝게 비칩니다.",
        "hint": "받침 ㅊ·ㅌ·ㅆ이 대표음으로 나는 것을 익혀요.",
        "focus": null,
        "locale": "ko-KR"
      }
    ]
  }
}
```

`courseId`와 `stepId`가 일치하지 않으면 404다. 예문 revision은 시험·학습 세션에 저장해 결과 재조회 시 문장이 바뀌지 않게 한다.

### 19.2 Chirp 합성 음성

`GET /api/practice-examples/{exampleId}/audio?voice=ko-KR-Chirp3-HD-Aoede` — P0

- 성공 응답은 envelope가 아닌 `audio/mpeg` binary이며 `ETag`와 private cache header를 제공한다.
- 허용된 게시 예문 ID만 합성한다. 임의 text query를 받지 않아 비용 남용과 임의 콘텐츠 합성을 막는다.
- 기본 화자는 `ko-KR-Chirp3-HD-Aoede`, 속도는 `0.92`이며 허용 화자는 서버 allowlist로 제한한다.
- `(exampleId, revision, voice, speakingRate)` 조합으로 결과를 저장·캐시한다.
- 생성 실패는 JSON envelope와 503 `TTS_UNAVAILABLE`, 제한 초과는 429 `TTS_RATE_LIMITED`다.
- Google Cloud 자격증명은 서버에서만 사용하며 브라우저와 API 응답에 노출하지 않는다.

## 20. 추가 기능 통합 완료 조건

- 프로필 사진 등록 → 조회 → 교체 → 삭제가 새로고침과 다른 기기에서도 동일하다.
- 잘못된 이미지 형식·크기·이미지 위장 파일이 저장되지 않는다.
- 학습 횟수만 충족한 사용자는 현재 칭호가 유지되고 승급 시험 버튼만 활성화된다.
- 합격점 미만은 칭호가 유지되고, 기준 이상 분석은 정확히 한 단계만 승급한다.
- 다른 사용자의 시험·분석 ID 제출과 동일 분석의 중복 승급이 차단된다.
- 단계별 예문은 항상 5개이며 선택한 문장과 합성 음성·녹음 분석 기준 문장이 일치한다.
