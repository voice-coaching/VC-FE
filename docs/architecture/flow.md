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
