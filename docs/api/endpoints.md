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

| Method | URL | 인증 | 설명 |
|---|---|---|---|
| GET | `/api/analysis-capabilities/canonical` | 사용자 로그인 | 분석 계약·접수 가능 상태·목적별 지원 범위 |
| GET | `/api/v3/analyses/{analysisId}` | 사용자 로그인·소유 확인 | 현재 실행 결과와 저장·후속 작업 상태 |
