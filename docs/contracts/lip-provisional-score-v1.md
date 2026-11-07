# 영상 입술 점수 소비 계약

2026-11-06 공유 소비 계약, 2026-11-07 Frontend 반영. 배포 완료를 뜻하지 않는다.
기존 내부 result v6와 공개 `voice-coaching.canonical-analysis-view.v3`의 필드 이름과 소유 관계를 유지한다.

## 종합점수

Frontend는 `canonicalAnalysis.score.overallScore`를 그대로 표시한다. 숫자 0은 유효하고 null은 점수 미제공이다.
서버가 계산한 점수를 발음 채점표·운율·입술 점수로 다시 합산하거나 검산하지 않는다.
Direct는 별도 계약의 `result.score.overallScore`를 유지한다. Direct 음성 접수 성공은 영상 접수 성공 증거가 아니다.

서버 내부 규칙은 음성 종합점수 A와 유효한 입술 총점 L이 모두 있으면 `HALF_UP(0.6A+0.4L,1)`이다.
L을 만들 수 없으면 A를 보존한다. A도 없으면 종합점수는 null이고 입술 점수로 대체하지 않는다.
이 공식은 서버 계약 설명이며 Frontend에 계산 코드를 추가하지 않는다.
원본 Seungun JSON과 기존 발음·음성 종합 검산표는 변경하지 않는다.

## visual 확장

Backend 공개 경로는 `canonicalAnalysis.visual`, 내부 result v6 경로는 `visual`이다.
기존 필수 필드는 유지한다.

| 필드 | 형식 | 의미 |
| --- | --- | --- |
| `scoreKind` | NONE, CALIBRATED, PROVISIONAL | PROVISIONAL은 전문가 검증 전 참조 적합성 |
| `subScores` | 선택 배열, 최대 4개 | 전체 입술 하위 항목; 과거 응답은 생략 가능 |
| `phoneAssessments[].scoreKind` | NONE, REFERENCE_SIMILARITY, CALIBRATED, PROVISIONAL | 위치별 점수 종류 |
| `phoneAssessments[].calibrationRevision` | 문자열 또는 null | PROVISIONAL은 null 허용; SCORED·CALIBRATED는 기존대로 revision 필요 |
| `phoneAssessments[].allowedActionIds` | 빈 배열 또는 `["COMPARE_REFERENCE"]` | 참조 비교 연습 허용; 확정 교정 방향이 아님 |
| `phoneAssessments[].subScores` | 선택 배열, 최대 4개 | 위치별 하위 항목과 측정 근거 |

`correctiveClaimsAllowed=false`를 유지한다. PROVISIONAL을 전문가 검증 점수·발음 정답률·오류 확률로 표시하지 않는다.
SCORED는 CALIBRATED 또는 PROVISIONAL에 사용한다. 루트가 OBSERVED·NONE·null이어도 개별 위치에는
SCORED·PROVISIONAL과 유효한 하위 점수가 있을 수 있다. 종합점수와 국소 관찰을 함께 보존한다.

## subScores 객체

| 필드 | 형식·필수 여부 |
| --- | --- |
| criterionId | 필수; lip_aperture, lip_rounding, lip_closure, lip_timing |
| label | 필수 문자열 |
| score | 필수; 0~100 숫자 또는 null |
| status | 필수; SCORED, UNSCORABLE, NOT_APPLICABLE |
| reasonCode | 필수 문자열 |
| measurements | 선택 배열, 최대 1개 |

SCORED는 숫자, 나머지 상태는 null이다. null을 생략하거나 0으로 바꾸지 않는다.
measurements의 모든 객체 필드는 필수이며 다음 형식이다.

| 필드 | 형식 |
| --- | --- |
| metricId | 문자열 |
| value, referenceMedian | 유한 숫자 |
| referenceScale | 양수인 유한 숫자; 임시 비교 척도이며 모집단 표준편차가 아님 |
| referenceCount | 1~32 정수 |
| tolerance | 0 이상의 유한 숫자 |
| unit | PHONE_PHASE 또는 FACE_SCALE_NORMALIZED |

Backend는 선택 필드가 있으면 그대로 전달하고 없으면 생략한다. 하위 점수는 부모 점수의 근거이며 종합점수에 다시 더하지 않는다.
Frontend는 루트·위치별 label과 score/status를 표시하고 측정 필드·단위는 파싱하여 보존한다.

## 근거와 피드백

coverage의 targetCount, visuallyEligibleCount, observedCount, scoredCount와 비율을 보존한다.
NO_FRAME_IN_ALIGNED_SPAN은 해당 음소 시간 구간에 관측 프레임이 없다는 뜻으로 얼굴 가림과 다르다.
자기 비교·정렬 모호성·참조 부재를 임의 만점이나 0점으로 변환하지 않는다.

서버는 유효한 입술 연습을 최대 2개 우선 선정하고 음성 대상으로 총 3개까지 채운다.
입술 총점이 보류돼도 유효한 위치의 비교 연습을 선정할 수 있다. GPT는 최대 1회 호출하고 공개 feedback은
최대 3줄·전체 5문장·300자다. Frontend는 서버 피드백을 표시하며 GPT를 추가 호출하지 않는다.

인증·녹음 소유 관계·요청/실행 identity·파일 무결성 검사를 유지한다.
전체 녹음·얼굴 좌표·원본 CORE를 공개 응답에 추가하지 않는다.

## 적용과 확인 경계

Backend DTO/공유 schema와 Frontend reader가 확장을 수용한 뒤 운영자가 AI 영상 접수를 활성화한다.
타입 검사·빌드·모의 API/브라우저 검사는 실제 Backend 영상 정규화·result v6 전달·공개 조회·운영 DB 저장 검증을 대신하지 않는다.
공유 인계의 실제 영상 검사에서는 짧은 음소 구간의 프레임 부족으로 입술 총점이 보류됐다.
참조·coverage 기준을 낮추지 않으며 음성 점수와 측정 가능한 국소 연습을 유지한다.
