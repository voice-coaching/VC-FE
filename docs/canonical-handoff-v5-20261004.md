> Superseded rollout policy: [v5-only deployment](canonical-v5-only-migration-20261004.md). Dual-version admission/fallback below is historical.

# canonical v5 결과 연동

`src/lib/api/canonical.ts`는 접수 직전 `/api/analysis-capabilities/canonical`의 `resultSchemas`를 확인한다. v5를 허용하면 `X-Analysis-Result-Schema: voice-coaching.runpod-analysis-result.v5`를 보내며, v4만 허용하면 기존 헤더를 사용한다. 둘 다 접수 불가면 요청을 생성하지 않는다. 구 Backend의 명시적 404에서만 v4 호환 동작을 유지한다.

결과 조회는 `/api/analyses/{id}/result-contract`로 현재 소유한 시도의 profile·request/execution/recording ID를 확인한다. v5는 `/api/v3/analyses/{id}`, v4는 기존 v2 endpoint를 사용한다. 두 조회 사이에 retry가 일어나면 시도 ID 불일치로 결과를 거부한다. 서버 제공 URL을 fetch하지 않는다.

`src/lib/canonical-analysis.ts`는 공개 view v1/profile v4와 view v2/profile v5의 정확한 조합만 허용한다. score·코칭·scoped ID·MFA·actions 검증은 동일하다. Backend archive 상태를 완료 조건이나 사용자 UI에 추가하지 않는다. 접수 응답이나 영속 인계 완료만으로 사용자 분석 완료를 표시하지 않는다.

인증·5xx·형식 오류를 다른 profile로 전환하지 않는다. 이력과 재진입도 동일 client를 사용하며 계정별 결과를 전역 cache에 보관하지 않는다. 기존 502 복구와 같은 analysisId 재조회 흐름은 유지한다.

확인: TypeScript 컴파일 및 변경 파일 포맷 확인. 브라우저·실제 업로드 QA와 Vercel 배포는 별도다. Backend/RunPod v5 준비 및 개발자 수용 후 Backend capability를 활성화한다.
