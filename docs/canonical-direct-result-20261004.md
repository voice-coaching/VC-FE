# v5 결과 직접 수신

구현·TypeScript 컴파일 확인. Vercel 배포/브라우저 QA/시간 재측정은 아직 하지 않았다.

`waitForCanonicalResult`는 초기 상태 조회로 analysis ID/서버 deadline을 확인하고 `GET /api/v3/analyses/{id}?waitSeconds=8`에서 실제 view를 받는다. deadline이 아직 없을 때만 상태를 다시 확인한다. 결과 준비 이벤트에서 즉시 응답하므로 8초는 결과가 없을 때의 최대 대기다.

받은 view를 canonicalPresentation으로 변환하여 신규 분석·재시도·상태 재확인·재진입에 전달한다. 상태 완료 뒤 별도 GET을 제거했고 저장 상태 관찰의 view도 재사용한다. SAVING/RETRYING의 점수·코칭을 먼저 표시하고 기존 저장/학습/코스/칭호 완료 정책을 유지한다.

기존 pollAnalysis의 auth epoch/AbortSignal/시도 식별자/20초 개별 요청 제한/90초 연결 복구 예산/서버 deadline을 유지한다. 상태를 받은 뒤 대기에 사용한 시간은 서버 잔여 시간에서 제외하고 deadline을 반복 연장하지 않는다. 녹음·request/execution identity와 schema 검사를 유지하며 전역 결과 캐시를 만들지 않는다.

구 BE가 query를 무시하면 빠른 pending 응답에만 1초 간격을 적용한다. 결과 응답에는 추가 간격을 적용하지 않는다. 8초 대기는 프록시 60초/client 20초보다 짧다. 최적 경로에는 BE의 publication/await와 RunPod의 선행 publication이 모두 필요하다. optional publication 실패 시 기존 full handoff로 복구한다.

자동 회귀 테스트·브라우저 자동화는 실행하지 않았다. 개발자는 신규/재시도/재진입, 로그인 변경, 저장 중 이탈, 502 복구, 부분 배포, 결과 수신 후 추가 GET 없이 표시되는지 확인한다.
