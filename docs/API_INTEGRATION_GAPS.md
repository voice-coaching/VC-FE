# API 연동 보류 항목

운영 Swagger의 기존 53개 외에 현재 프론트 기능을 실제 서버 데이터로 전환하려면 아래 API가 추가로 필요합니다. 상세 요청·응답·오류·보안 규칙은 [신규 백엔드 API 기능명세서](BACKEND_API_FUNCTIONAL_SPEC_2026-09-15.md)를 기준으로 합니다.

## 프로필 사진과 칭호

- 프로필 사진: `GET | POST | PUT | DELETE /api/users/me/profile-image`
- 내 칭호: `GET /api/users/me/title`
- 승급 시험: `POST /api/users/me/title-exams`
- 시험 조회: `GET /api/users/me/title-exams/{examId}`
- 서버 채점·승급: `POST /api/users/me/title-exams/{examId}/submit`

칭호는 누적 학습 횟수만으로 자동 변경하지 않습니다. 횟수는 응시 자격이며, 서버 분석 점수가 단계별 합격 기준 이상일 때만 한 단계 승급합니다.

## 단계별 예문과 음성

- 단계별 예문 5개: `GET /api/courses/{courseId}/steps/{stepId}/practice-examples`
- Chirp 합성 음성: `GET /api/practice-examples/{exampleId}/audio`

현재는 프론트 로컬 예문과 `/api/tts` route가 이 기능을 대신합니다. 운영에서는 콘텐츠 revision, 허용된 예문 ID, 합성 화자, 캐시를 백엔드가 관리해야 합니다.

## 사용자 입력 문장 연습

현재 운영 Swagger에는 사용자가 입력한 임의 문장을 학습 콘텐츠로 생성하거나, 콘텐츠 ID 없이 스크립트 원문을 전달해 학습 세션을 만드는 API가 없습니다.

음성 분석 흐름의 `POST /api/training-sessions`는 서버에 등록된 `contentId`를 필수로 사용합니다. 사용자 요청에 따라 `/my-script`에 입력·문장 확인·브라우저 음성 미리 듣기·로컬 녹음·예시 결과 화면을 구현했습니다. `/practice/custom`은 이 화면으로 이동합니다. `localOnly` 경로는 임의 콘텐츠 ID로 서버에 요청하지 않으며, 녹음 업로드·분석·학습 기록 저장을 하지 않습니다. 화면에 체험 및 예시 결과임을 표시합니다.

이 기능을 연동하려면 Backend에서 다음 중 하나의 계약이 필요합니다.

- 사용자 문장을 임시/정식 콘텐츠로 생성하고 `contentId`를 반환하는 API
- `scriptText`를 직접 받아 임시 학습 세션을 생성하는 API
