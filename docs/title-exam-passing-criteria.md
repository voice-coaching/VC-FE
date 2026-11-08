# 승급 시험 합격 판정 연동 보완

## 저장 재조회와 채점 완료 연결 (2026-11-08)

- 수동 저장 재확인과 자동 저장 대기는 `canonicalLookupIdentity`로 analysisId,
  recordingId, requestId, executionId만 추출한다. 결과 객체 전체를 strict 조회 계약에
  전달하지 않는다. 문장·승급 시험의 공통 녹음 화면과 입모양 연습의 저장 대기에 적용된다.
- `refreshCanonicalPersistence`는 서버의 `409 CANONICAL_ANALYSIS_CHANGED`에만
  500ms 간격으로 최대 두 번 추가 GET한다. 네 ID는 고정하며 분석 POST는 보내지 않는다.
  계속 같은 409이면 기존 결과를 보존하고 수동 재확인을 안내한다.
- 응답의 ID 불일치, 명시적인 시도 변경, 401/403/404, 인증 세션 변경 또는 취소는 중단한다.
  기존 projection·시도 일치 검사와 학습 완료 전 선택 녹음 검사를 유지한다.
- SAVING/RETRYING → SAVED 확인 → 학습 완료 → 승급 채점 순서로 진행한다.
  채점 중 진행 안내를 표시하고, 오류 시 `채점 다시 확인`을 제공한다.
  검증된 PASSED/FAILED 결과가 있어야 완료 버튼과 보고서 저장 후 이동을 허용한다.

검증:

```sh
node --import tsx --test scripts/canonical-persistence.test.ts scripts/canonical-completion.test.ts scripts/title-exam-api.test.ts scripts/title-exam-resume.test.ts
npm run dev -- --webpack --port 3132
node scripts/verify-title-save-grade.mjs
```

브라우저 검증은 localhost의 모의 API로 수행한다. 운영 서버에 분석·채점 요청을 보내지 않는다.
자동 저장·수동 확인·자동/수동 409 복구·다른 실행 차단·채점 지연/오류의 버튼 상태를 확인한다.

## 원인과 책임

2026-11-07 확인 기준: FE main `39d8b16`, BE main `0ca81d2`.
백엔드 `TitleService.submit()`이 합격 여부와 관계없이 칭호를 변경하고,
`TitleExam.resultingRank()`가 불합격에도 목표 칭호를 반환했다.
프론트에는 이미 응답의 합격 여부·점수 기준·칭호 변경 일관성 검증이 있었다.
따라서 DB의 잘못된 승급은 백엔드 수정·배포가 필요하다.

## 프론트 변경

- `src/lib/title-exam.ts`: 정상 합격·불합격 모두 점수와 합격 기준이 유한한 숫자이며
  0~100 범위인지 확인한다. null, 누락, NaN, 음수, 초과 점수를 정상 불합격으로 표시하지 않는다.
- 불합격은 `FAILED`, `passed=false`, 점수 미달, 기존 칭호 유지가 모두 일치해야 한다.
- 합격은 `PASSED`, `passed=true`, 점수 기준 충족, 칭호 변경이 모두 일치해야 한다.
- API 주소·요청 본문·UI 디자인은 변경하지 않는다. 프론트가 직접 승급을 결정하거나
  채점 기준을 하드코딩하지 않는다.

## 검증과 배포 확인

`node --import tsx --test scripts/title-exam-api.test.ts scripts/title-exam-resume.test.ts`
에서 기존 시험 진입·세션 복구와 불합격·모순 응답·잘못된 점수·정확한 경계 점수를 검증한다.
백엔드 배포 후 70점 기준에서 69.99점은 기존 칭호, 70점은 한 단계 승급하는지
실제 저장 점수와 `/api/users/me/title` 응답을 대조한다.
점수 없음은 채점을 보류하고 같은 분석 재제출은 중복 승급하지 않아야 한다.
기존에 잘못 승급된 계정은 이번 UI 수정으로 자동 복구되지 않는다.
