# 코칭 사용량 프론트 연동

백엔드 `docs/api/coaching-usage-limits.md`, `docs/api/ai-unified-v6-contract.md` 기준이다.

- `GET /api/users/me/coaching-usage`를 인증된 프록시 경로로 조회한다. HTTP `cache: no-store`이며 사용자 ID를 요청에 넣지 않는다.
- 마이페이지와 이용권 관리, 녹음 화면에서 서버의 `remaining`, `limit`, `used`, `reserved`, `startsAt`, `expiresAt`를 표시한다. 날짜는 한국 시간이며 무료 체험은 계정당 최초 한 달에만 제공한다. 기간이나 잔여분을 클라이언트에서 임의로 계산하거나 월별 리셋하지 않는다.
- TEST 유료 이용권은 이용기간당 30회, 무료 체험은 8회다. 테스트 admin은 nullable 기간·한도·잔여분을 무제한 표시로 처리하지만 입력 상한은 동일하다. 제공량 안내와 실제 잔여분을 구분한다.
- 사용량은 계정·인증 세대별 메모리 쿼리로 분리하며 영구 저장하지 않는다. 화면 진입·포커스 복귀·기간 종료 시각 및 분석 접수/재시도/종료·결제 상태 갱신 시 재조회한다. 사용량 조회가 녹음을 막거나 조회 실패가 무제한 사용으로 처리되는 일은 없다. 최종 접수 판단은 서버에 맡긴다.
- `COACHING_QUOTA_EXCEEDED`, `COACHING_PERIOD_EXPIRED` 403은 로그인 오류와 구분한다. 계정의 토큰을 지우거나 자동 재인증/분석 재접수를 하지 않는다. 기존 결과 조회를 차단하지 않는다.
- `COACHING_SCRIPT_LIMIT_EXCEEDED`, `COACHING_AUDIO_LIMIT_EXCEEDED` 422는 원고·음성 제한을 안내한다. 새 업로드 전 Unicode code point 300자(공백·문장부호 포함), 90,000ms 이내를 검사한다. 기존 녹음은 자동으로 삭제하지 않는다. 다중 문장에서도 접수 실패를 바로 표시한다.
- 새 요청과 재시도, 음성·영상 모두 `X-Analysis-Result-Schema: voice-coaching.runpod-analysis-result.v6` 및 `{ accepted: true, policyRevision: capabilities.consentPolicyRevision }`를 전송한다. 재시도는 기존 결과의 `actions.canRetry`도 확인한다. 새 동의 정책을 임의로 하드코딩하지 않는다.
- 입 모양 연습의 새 분석도 녹화에서 분리한 음성을 인증된 API로 접수한다. UI의 AI 직접 접수 분기를 제거해 새 코칭 원장 검사를 거치도록 하며, 기존 직접 분석 기록을 읽는 기능은 유지한다.

사용량 응답·화면 표시, 403/422와 토큰 유지, V6/동의 Body, Unicode/음성 경계, 업로드 전 차단·녹음 보존 및 인증 세대 전환을 프론트 회귀 테스트로 검증한다.
