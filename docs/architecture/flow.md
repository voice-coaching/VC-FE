# 흐름 문서 - VC-FE

2026-11-08: 기존 결과 조회 → 선택 `score.details` parser → canonical/Direct 화면 모델 → 6항목 표시.
선택 필드가 없거나 해석할 수 없으면 세부점수 미제공으로 표시하며 기존 총점·피드백을 유지한다.
0점·평가 불가·미제공을 구분하고, 세부점수 누락 때문에 분석 POST를 다시 보내지 않는다. [계약](../api/score-details.md).

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

## 카메라 촬영본 분석 (2026-11-08)

카메라/마이크 → 단일 원본 Blob → AI 전송/분석 동의 → 로그인 소유권·원고를 확인할 세션/권한 발급 → AI 원본 PUT → start → 같은 AI UUID로 상태/결과 조회 → bytes digest·시도/원본 연결 검사 → 종합점수·총평·입술 근거 표시.

`browser-video-practice.ts`가 같은 촬영본의 orchestration을, 전용 API client가 grant 갱신·업로드·조회·검증을 담당한다.
UI는 촬영·동의·진행·결과를 조립한다. Backend VIDEO gate/영상 저장/정규화/결과 수집을 호출하지 않는다.
대기 중단은 요청 중단이며 이미 접수한 AI 작업 취소와 다르다. 같은 촬영본에서 기존 시도를 재확인한다.
이력 수집은 아직 연결되지 않았으므로 Backend 저장/학습 완료나 저장 dialog를 성공으로 표시하지 않는다.
입술 점수가 없어도 실제 총점·유효한 국소 관찰을 유지한다. [계약·검증 범위](../api/direct-video-upload.md).
