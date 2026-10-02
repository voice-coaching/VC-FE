# Canonical v4 프론트엔드 연결

## 2026-10-02 사용자 결정 반영

PR #33/#35의 별도 canonical 화면, legacy/v4 선택 화면 및 새 피드백 카드 UI를 철회한다.
기존 녹음·로딩·피드백·점수·문장별 화면과 이력 탭/삭제 대화상자를 유지하고,
분석 API 계층만 v4를 사용한다. 기존 두 모드를 병행하거나 오류 시 v3로 재요청하지 않는다.

수정 기준은 dev `d2a880d`다. 화면 복원 기준은 우리 변경 이전 main `35b2c9c`이며
`analysis-view.tsx`, `coaching-view.tsx`, `coaching.ts`는 그 원본으로 복원했다.
삭제한 우리 파일은 canonical-analysis-view, canonical-practice-session, practice-session-entry,
coaching-sentence다. 이후 다른 개발자의 UI 변경은 덮어쓰지 않는다.

## API 계약

FE → 기존 /api/backend 프록시 → Backend → RunPod 순서다.
서버 비밀키를 브라우저에 전달하지 않는다.

| 작업            | 계약                                                                                                                   |
| --------------- | ---------------------------------------------------------------------------------------------------------------------- |
| analyze / retry | 기존 POST 경로와 accepted/policyRevision body 유지, X-Analysis-Result-Schema: voice-coaching.runpod-analysis-result.v4 |
| status          | 기존 GET /api/training-sessions/{id}/analysis/status                                                                   |
| 결과            | GET /api/v2/analyses/{id}, public view v1 strict 검증, no-store                                                        |
| 완료            | 현재 선택 녹음과 최신 v4 actions.canComplete 확인 후 기존 complete                                                     |
| 재시도          | 최신 v4 actions.canRetry 확인 후 기존 retry에 v4 헤더                                                                  |
| 재녹음          | 전체 시도 식별자 재조회 + canRerecord 확인, 같은 세션에 새 recording 업로드/선택/analyze                               |
| 이력            | 현재 recordingId를 검증해 같은 기존 AnalysisView에 표시                                                                |
| 피드백 재생성   | v4 미지원: 기존 regenerate endpoint를 호출하지 않음                                                                    |

canonical GET이 404여도 v3 /api/analyses/{id}로 fallback하지 않는다.
따라서 과거 v3 이력은 기존 오류 영역으로 조회 불가가 표시된다. 데이터를 삭제하거나
새 결과로 위장하지 않는다. 과거 결과 이관은 별도 Backend 계약 작업이다.
분석이 없는 세션의 정확한 404 ANALYSIS_NOT_FOUND와 RECORDING/UPLOADING 상태만
녹음 화면으로 복귀시킨다. URL의 resumeType만으로 실패 분석을 새 분석으로 바꾸지 않는다.
응답 유실 뒤에는 새 분석 자동 요청 없이 현재 상태를 조회한다.

## 기존 화면을 위한 데이터 어댑터

`canonical-presentation.ts`가 검증된 public view를 기존 AnalysisResult **화면 모델**에 연결한다.
AnalysisResult는 이 경로에서 legacy 서버 응답 DTO가 아니다.

- 원문 public view를 canonical 필드에 보존한다. scoped ID, request/execution ID, MFA 위치,
  canonical 판정, provenance와 후보/표현 순서 및 guidance 연결 검증은 유지한다.
- 허용된 후보 표현 explanation/action/practice/selfCheck를 순서대로 기존 AI 총평에 표시한다.
  모델 관측 기반 검토이지 확정된 발음 오류가 아님을 함께 전달한다.
- ACCEPT를 정상 발음으로, 후보 없음을 오류 없음으로 바꾸지 않는다.
- REJECT/INCONCLUSIVE/시스템 실패는 기존 오류/총평 영역으로 전달한다.
  실패를 발음 탓으로 표현하거나 canComplete=false에서 학습을 완료하지 않는다.
- 별도 evidence 카드, raw ID 화면, v4 상태 패널, 선택 화면을 다시 만들지 않는다.

**점수·문장별 판단은 여전히 제공되지 않는다.**
현재 public v4는 overallScore=null / NO_APPROVED_SCORING_CONTRACT이고,
문장 식별자·문장별 판정·STT를 제공하지 않는다. 따라서 기존 점수는 ‘—’,
문장 영역은 기존 ‘데이터 미제공’ 상태를 유지한다. 음소 후보를 문장 segment로 위장하거나,
MFA wordIndex를 문장 번호로 치환하지 않는다. 필요한 점수·문장 계약을 Backend/AI에
정의하기 전에는 FE 어댑터만으로 이 두 기능을 완성할 수 없다.

## 운영 범위와 안전 경계

Backend 대조 기준: VC-BE `a241a99`의 CanonicalActionPolicy / CanonicalRequestScope.
현 배포 v4 admission은 품질 PASS인 단독 음성 PRONUNCIATION만 허용한다.
BOTH 콘텐츠는 기존과 같이 발음 범위로 요청한다. 클래스·시험은 기존 화면을 보존하되
업로드 전에 기존 오류 화면에서 미지원으로 알린다. v3로 우회하지 않는다.
이는 클래스·시험의 v4 구현 완료를 뜻하지 않는다. 영상/억양 범위도 확대하지 않았다.

로그인 변경 시 결과 메모리를 폐기하고 기존 인증 세대 fence를 유지한다.
canonical 결과를 persistent UI cache에 쓰지 않는다. 이력 조회/삭제의 abort 및 stale 응답
차단은 보존한다. 실제 mutation은 Backend가 소유권·선택 녹음·상태를 다시 검증한다.
상대 업로드 URL은 Backend 프록시로, 외부 presigned URL은 JWT 없이 처리한다.

## 확인과 인계

TypeScript 컴파일, 포맷, diff와 API/화면 구조 정적 확인만 수행한다.
자동 회귀 테스트, fixture 생성, 브라우저 자동화, 실제 녹음/core/GPT 실행,
배포 빌드 및 FE 운영 배포는 하지 않는다. FE 개발자가 기존 화면과 v4 요청·재시도·
non-ACCEPT 재녹음·이력·인증 변경·삭제를 수동 확인해야 한다.
PR 병합·FE 배포는 별도이며, RunPod 실행기 장애 복구와 혼동하지 않는다.
