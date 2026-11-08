# 엔드포인트 목록 - VC-FE

운영 백엔드의 80개 엔드포인트 목록은 운영 OpenAPI
`https://api.voice-coaching.site/v3/api-docs`를 단일 기준으로 사용한다. 프론트의
전체 호출 계약은 `scripts/verify-api-contract.ts`, 구현은
`src/lib/api/remote.ts`에서 관리한다.

프론트 내부에서만 제공하는 경로는 다음 두 개다.

| Method | URL              | 설명                           |
| ------ | ---------------- | ------------------------------ |
| ALL    | `/api/backend/*` | 운영 백엔드 동일 오리진 프록시 |
| GET    | `/api/tts`       | 예시 음성 MP3 호환 프록시      |

이전에 적혀 있던 `GET /health`는 프론트에서 사용하지 않고 운영 OpenAPI에도 없는
템플릿 항목이므로 제거했다.


## 분석 연동

원본 영상의 외부 Backend/AI endpoint 색인·인증은 [브라우저 직접 업로드 계약](direct-video-upload.md#ai-브라우저-endpoint)을 따른다.
영상은 AI origin으로 직접 전송하며 Frontend 중계에는 권한 metadata만 보낸다.

| Method | URL | 인증 | 설명 |
|---|---|---|---|
| GET | `/api/analysis-capabilities/canonical` | 사용자 로그인 | 분석 계약·접수 가능 상태·목적별 지원 범위 |
| GET | `/api/v3/analyses/{analysisId}` | 사용자 로그인·소유 확인 | 현재 실행 결과와 저장·후속 작업 상태 |

## 승급시험 재개·새 시작

| Method | URL | 인증 | 설명 |
|---|---|---|---|
| POST | `/api/users/me/title-exams/{examId}/restart` | 사용자 로그인·본인 미채점 시험 | `{previousTrainingSessionId}`를 보내 이전 작업을 취소하고 새 녹음 세션에 연결. 응답은 기존 시험 조회 형식 |

`TitleExamSession`은 기존 녹음·분석이 있으면 재개/새 시작 선택 전까지 녹음 화면을 mount하지 않는다. 미분석 저장 녹음의 재개는 확인 화면과 별도의 분석 버튼을 사용한다. 새 시작은 Backend의 위 API 배포가 선행되어야 하며, API 실패 시 기존 녹음 자동 제출로 우회하지 않는다. 이미 채점된 시험에서 새 시작은 기존 시험 생성 API의 다음 응시 자격을 따른다.


## 문장별 독립 연습

| Method | Path | 인증 | 목적 |
|---|---|---|---|
| POST | `/direct/api/v1/practice-batches` | 없음 | 문장 목록을 연습 ID에 고정 |
| POST | `/direct/api/v1/practice-batches/{batchId}/sentences/{sequenceNo}` | 없음 | 문장 WAV 한 개 접수·분석 시작 |
| GET | `/direct/api/v1/practice-batches/{batchId}` | 없음 | 진행 또는 전 문장 피드백 일괄 조회 |
| POST | `/direct/api/v1/practice-batches/{batchId}/cancellations` | 없음 | 미공개 연습과 접수 작업 취소 |
