# Canonical 9항목 점수 표시

2026-10-04 Native 전환: `phone-rubric-native-v1`도 명시적으로 허용한다. 서버 점수와 9항목 단계만 표시하며 계산은 FE에서 수행하지 않는다. Native 결과에는 이전 방식과의 직접 비교 불가 및 일부 모음 관측 범주 통합을 안내한다. 기존 점수를 새 revision으로 바꾸지 않는다. UNKNOWN/UNSCORABLE은 점수로 대체하지 않는다. 정책 보정과 RunPod 실행 승인이 완료되기 전에는 운영 활성화하지 않는다.

최신 dev `aecddad` 기준 `feat/native-score-contract-20261004`에서 TypeScript `--noEmit --incremental false` 통과. 브라우저 QA·커밋·푸시·PR·운영 배포는 수행하지 않았다.

2026-10-03 구현. Backend 새 scored-H5 점수 계약에 연결한다. 운영 배포·브라우저 QA는 이번 작업에서 수행하지 않았다.

- `src/lib/canonical-score.ts`: 서버 점수 계약 검증. revision=phone-rubric-20261003-v1, 순서 고정 9항목, 단계 0~4/null, 점수 0~100을 확인한다. 과거 S7/H5 null 점수도 허용한다. `canonicalCriterionPoints`는 검증된 단계와 해당 revision의 배점을 항목 점수 표시 모델로 변환한다.
- `src/lib/canonical-analysis.ts`: 숫자 점수는 COMPLETED/ACCEPT에 한정하며 채점 실패의 FAILED/완료 불가 상태를 확인한다.
- `src/lib/canonical-presentation.ts`: RUBRIC_COMPUTED 서버 값을 표시 모델로 전달한다. UNSCORABLE은 임의 점수 없이 재시도 안내를 표시한다.
- `src/components/canonical-score-criteria.tsx`: 종합점수 탭에서 9항목을 “받은 점수 / 배점”으로 표시하며 null은 “평가 대상 없음”이다. 전체 점수 산술을 UI에서 구현하지 않는다.
- `src/components/analysis-view.tsx`, `src/components/practice-session.tsx`: 전체 점수를 소수점 첫째 자리까지 표시한다.

새 score에는 overallScore, validity, reason, rubricRevision, criteria가 있다. criteria는 vowels/plain_stops/tense_stops/aspirated_stops/fricatives/affricates/nasals/liquid/coverage 순서다. 실패는 null/UNSCORABLE/SCORING_FAILED다. 비ACCEPT 및 전달 제한 실패는 NOT_AVAILABLE이다. 기존 결과를 0점으로 바꾸거나 자동 재채점하지 않는다. 대본 간 난이도 비교나 100점의 완벽한 발음을 보장하지 않는다는 범위를 화면에 표시한다.

Backend의 새 공개 DTO 및 검증 묶음을 먼저 준비하고 이 FE를 배포한 뒤 RunPod 새 채점 경로를 활성화한다. TypeScript noEmit 및 포맷·정적 확인만 수행했으며 실제 분석·브라우저 QA는 개발자가 수행한다.

## 항목별 점수 표시 (2026-10-04)

공개 API의 항목 원본은 여전히 `criterionId`와 `level`이다. 표시 모델은 확인된 `phone-rubric-20261003-v1` 계약의 `배점 × level / 4`를 사용한다. 배점은 모음 25점, 유음 5점, 나머지 7항목 각각 10점이다. 근거를 다시 채점하거나 단계 안의 세부 정확도를 추정하지 않는다. 새로운 rubric revision은 별도 계약 확인 없이 이 배점을 적용하지 않는다.

- 예: 모음 3단계는 `18.75 / 25점`, 비음 2단계는 `5 / 10점`, 유음 3단계는 `3.75 / 5점`이다. 최대 소수점 둘째 자리의 정확한 값을 표시하며 불필요한 0은 붙이지 않는다.
- 0단계는 `0 / 배점`으로 표시한다. null은 평가 대상 없음이며 0점과 구별한다.
- 항목 점수는 100점 재정규화 전 배점 기준이다. 평가 대상 배점이 90점이고 획득 합계가 65점이면 종합점수는 서버가 제공한 `72.2`를 그대로 사용한다. 항목별 반올림이나 FE의 전체 점수 재계산은 하지 않는다.
- 소스 근거: intelligentAI `src/voice_coach/backend_analysis/phone_rubric.py`의 `CRITERIA`, `worksheet`. API 및 RunPod 채점 계약 변경은 없다.
- 개발자 화면 확인 항목: 소수 2자리 점수, 0단계, null 항목, 전 항목 표시, 작은 화면의 긴 항목명, 신규 결과와 저장된 분석 이력. 자동 테스트·브라우저 QA·운영 배포는 수행하지 않는다.
