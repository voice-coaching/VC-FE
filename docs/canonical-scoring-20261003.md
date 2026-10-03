# Canonical 9항목 점수 표시

2026-10-03 구현. Backend 새 scored-H5 점수 계약에 연결한다. 운영 배포·브라우저 QA는 이번 작업에서 수행하지 않았다.

- `src/lib/canonical-score.ts`: 서버 점수 계약 검증. revision=phone-rubric-20261003-v1, 순서 고정 9항목, 단계 0~4/null, 점수 0~100을 확인한다. 과거 S7/H5 null 점수도 허용한다.
- `src/lib/canonical-analysis.ts`: 숫자 점수는 COMPLETED/ACCEPT에 한정하며 채점 실패의 FAILED/완료 불가 상태를 확인한다.
- `src/lib/canonical-presentation.ts`: RUBRIC_COMPUTED 서버 값을 표시 모델로 전달한다. UNSCORABLE은 임의 점수 없이 재시도 안내를 표시한다.
- `src/components/canonical-score-criteria.tsx`: 서버의 9항목 단계를 표시하며 null은 “평가 대상 없음”이다. 전체 점수 산술을 UI에서 구현하지 않는다.
- `src/components/analysis-view.tsx`, `src/components/practice-session.tsx`: 전체 점수를 소수점 첫째 자리까지 표시한다.

새 score에는 overallScore, validity, reason, rubricRevision, criteria가 있다. criteria는 vowels/plain_stops/tense_stops/aspirated_stops/fricatives/affricates/nasals/liquid/coverage 순서다. 실패는 null/UNSCORABLE/SCORING_FAILED다. 비ACCEPT 및 전달 제한 실패는 NOT_AVAILABLE이다. 기존 결과를 0점으로 바꾸거나 자동 재채점하지 않는다. 대본 간 난이도 비교나 100점의 완벽한 발음을 보장하지 않는다는 범위를 화면에 표시한다.

Backend의 새 공개 DTO 및 검증 묶음을 먼저 준비하고 이 FE를 배포한 뒤 RunPod 새 채점 경로를 활성화한다. TypeScript noEmit 및 포맷·정적 확인만 수행했으며 실제 분석·브라우저 QA는 개발자가 수행한다.
