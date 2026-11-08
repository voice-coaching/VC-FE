# 흐름 문서 - VC-FE

주요 기능 흐름을 단계별로 기록한다.

## 흐름 템플릿
### Flow Name
- Actor:
- Entry point:
- Preconditions:
- Steps:
- Validation:
- Empty state:
- Error state:
- Permission behavior:
- Retry or recovery:
- Side effects:
- Related API:
- Related DB tables:


## 모든 음성 문장 연습의 연속 캡처

[인증형 문장 연습 흐름](../api/authenticated-sentence-practice.md)에 일반 문장·뉴스·아나운서·내 문장·클래스·기존 세션·로컬·승급 시험의 실제 진입을 기록한다. 문장 이동은 로컬 캡처를 따르며 서버 접수/추론은 다음 녹음의 조건이 아니다. 결과 UI는 마지막 녹음 뒤에만 표시한다. 기존 소유·저장·진도·채점 의미는 유지한다.

## 카메라 촬영본 분석 (2026-11-07)

카메라/마이크 → 단일 영상 Blob → 처리 목적 안내·현재 revision 동의 → 최신 VIDEO capability/미디어 제한 검사 → 기존 URL 발급/영상 PUT/등록 → AUDIO_VISUAL 및 동일 녹음 품질 PASS 확인 → 녹음 선택 → v6 analyze → identity 검사를 거친 v3 view → 종합점수와 입술 근거 표시.

정책·업로드·등록 판단은 `src/lib/lip-analysis.ts`, 안내/화면 전환은 `src/routes/lip-practice.tsx`와 consent component가 담당한다.
지원 중단 중에도 로컬 촬영은 가능하다. 동의 변경·정책 누락·제한 위반 시 서버 리소스 생성 전에 중단한다.
취소는 업로드/조회 대기 중단이며 접수된 서버 작업 취소와 다르다. 불명확한 접수 실패에는 자동 신규 분석을 만들지 않는다.
입술 전체 점수가 없어도 유효한 종합점수와 위치별 피드백을 보존한다. 상세 계약/실패 동작은 [영상 연습 v6 연결](../audiovisual-v6-20261007.md)을 따른다.

## 승급 시험 저장·채점 재조회 보완 (2026-11-08)

공통 녹음 화면의 수동 재확인과 문장·입모양 연습의 자동 저장 대기는
`canonical-persistence.ts`에서 네 시도 ID만 추출해 조회한다.
서버의 `CANONICAL_ANALYSIS_CHANGED` 409는 같은 ID로 최대 두 번 추가 GET하며,
반환 ID 불일치·권한 상실·명시적 시도 변경은 즉시 중단한다. 복구 중 분석 요청은 생성하지 않는다.
승급 시험은 저장 확인과 학습 완료 후 채점을 자동 제출하고, 정상 PASSED/FAILED 응답 검증 후
완료 버튼을 연다. 채점 중·오류 상태에서는 완료를 막고 진행 안내 또는 채점 재확인을 표시한다.
상세 검증은 `docs/title-exam-passing-criteria.md`를 따른다.
