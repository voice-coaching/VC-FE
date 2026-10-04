# v5 결과 우선 표시

후속: [결과 직접 수신](canonical-direct-result-20261004.md). 아래 초기 구현의 상태 polling→별도 결과 GET을 결과 대기 요청 한 번으로 대체한다.

구현 상태이며 운영 배포·브라우저 QA는 별도다. Backend의 `analysis.canonical.delivery.enabled`를 켜기 전에 이 FE를 먼저 반영해야 한다.

- 상태 응답의 `resultAvailable=true`에서 분석 polling을 끝내고 같은 analysis의 결과를 조회한다. analysis/recording/request/execution ID 검증은 유지한다.
- view v2의 선택 필드 `persistenceStatus`는 NONE/SAVING/RETRYING/SAVED를 허용한다. 필드가 없는 기존 서버와 호환된다.
- SAVING/RETRYING이면 점수·피드백을 즉시 표시하고 저장 안내를 보여준다. 서버 검증이 끝난 결과에만 적용되며 임의 점수나 원본 코어를 표시하지 않는다.
- 저장 상태를 5초 간격으로 확인한다. 사용자 인증이나 시도 ID가 바뀌면 이전 결과를 제거한다. 일시적인 통신 오류에서는 결과를 유지하고 다시 확인한다.
- 학습 완료·과정 진행·칭호 시험 제출은 DB 저장 후 기존 `actions.canComplete`에 따른다. 저장 중 다음 과정으로 진행하는 버튼을 잠근다. 일반 학습 화면에서 나가도 DB 저장은 계속되지만 학습 완료 API는 SAVED 관찰 또는 재진입 때 호출한다.
- 재시도/취소 등 변경 동작은 서버 actions를 따른다. 저장 중 언마운트가 기존 분석 자동 취소를 발생시키지 않는다.

TypeScript 컴파일과 변경 파일 Prettier 확인만 수행한다. 브라우저 자동화·회귀 테스트는 실행하지 않는다. 운영 활성화 후 개발자가 결과 선표시, 저장 완료, 재진입, DB 지연, 인증 변경을 확인해야 한다.
