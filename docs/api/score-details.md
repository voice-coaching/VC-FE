# 종합점수·음성 6항목 세부점수

2026-11-08 사용자 제공 `frontend-score-details-response.md`를 구현한 후보다. AI writer·Backend·Frontend 운영 배포 완료를 뜻하지 않는다.

기존 총점 경로 `view.canonicalAnalysis.score.overallScore`를 유지하고 선택 객체 `score.details`를 보존한다.
Direct 조회/SSE는 `result.score.details`, 연습 결과는 `result.practiceResult.score.details`, 저장 이력은 각 `result.score.details`를 같은 parser로 읽는다.
문장별 독립 연습도 기존 Direct 결과 컴포넌트를 재사용한다. 새 endpoint·분석 POST·GPT 호출은 추가하지 않는다.

## 선택 응답

| 필드                       | 타입·의미                                                  |
| -------------------------- | ---------------------------------------------------------- |
| schemaVersion              | `voice-coaching.score-details.v1`                          |
| validationStatus           | `EXPERT_REVIEW_PENDING`; 전문가 검증 전 기준의 연습 점수   |
| aggregationMode            | AUDIO_ONLY 또는 AUDIO_VISUAL                               |
| audioScore / visualScore   | 각각 0~100 숫자 또는 null                                  |
| audioWeight / visualWeight | 정수 %, 서버 값 그대로 표시                                |
| criteria                   | 6개 항목. criterionId/label/score/status/reasonCode/weight |

criteria의 순서는 pronunciation_accuracy(발음 정확성), speaking_rate(발음 속도), articulation_rate(조음 속도), pauses(쉼), pitch(억양·음높이), intensity(음량·강도)다.
score는 0~100 숫자 또는 null, status는 SCORED 또는 UNSCORABLE이다. SCORED는 숫자, UNSCORABLE은 null이다.
label/reasonCode는 문자열, weight는 음성 내부 비중의 정수 %다.
기본 40/10/10/10/15/15 및 AUDIO_VISUAL의 현재 60/40은 응답 값이며 parser의 고정 조건이나 재합산식으로 사용하지 않는다.
기존 `score.criteria`는 9개 음소 채점표이고 `details.criteria`와 다른 데이터다.

## 표시·호환성

- `score-details.ts`가 선택 응답을 읽고 정렬·점수 포맷·평가 보류 문구를 제공한다. 모르는 추가 필드는 거절하지 않는다.
- 세부점수 누락·null·잘못된 선택 객체·미지원 버전은 세부점수만 생략하고 유효한 기존 총점·총평은 유지한다.
- 0점은 `0.0`으로 표시한다. UNSCORABLE은 ‘평가 불가’, 객체 부재는 ‘세부점수 미제공’이다.
- 총점 null에서도 제공된 항목 점수를 표시한다. 새 총점은 계산하지 않는다.
- AUDIO_ONLY에서는 visualScore가 남아 있어도 입술 합산으로 표시하지 않는다. AUDIO_VISUAL에서만 서버의 입술 점수와 반영 비율을 표시한다.
- `AnalysisResult.scoreDetails`는 내부 화면 모델의 선택 필드다. canonical/Direct adapter가 전달하며 기존 9항목 정보는 유지한다.
- Direct/practiceResult의 동일성 확인은 기존 decision/총점/validity/reason/총평을 유지한다. 선택 metadata나 검산표 revision 차이를 전체 결과 거절의 조건으로 삼지 않는다.
- AnalysisView 본문과 상세 화면에서 같은 표시 컴포넌트를 사용한다. 기존 입술 visual/subScores 계약은 변경하지 않는다.

과거 저장 JSON에 details가 없으면 소급 생성하지 않는다. CORE·내부 검산표·hash·좌표를 UI에 추가하지 않는다.
AI writer의 새 필드 제공과 Backend 전달 배포 뒤 실제 서버 응답 및 화면 종단 확인이 필요하다.
자동 회귀 테스트·브라우저 자동화·실제 녹음/추론은 수행하지 않는다. 타입 검사·변경 파일 lint·정적 diff로 확인한다.
