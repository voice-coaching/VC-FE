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

## 관리자 승급 설정 편집 표시 보완 (2026-11-08)

목표 칭호 카드의 설정 변경은 `/admin/title-exams/{targetRank}` 편집 페이지로 이동한다.
서버 라우트는 지원 칭호만 허용하고, 편집 화면은 기존 정책 API에서 해당 칭호의 정책을 조회한다.
폼을 전체 카드 목록 뒤에 추가하지 않는다. 직접 접속·새로고침을 지원하며 취소·닫기 시 목록으로 돌아간다.
후보 문장 조회·버전이 포함된 저장·충돌 시 입력 보존은 기존 서비스 흐름을 사용한다.
문장 원문 편집은 이번 표시 수정 범위에 포함하지 않는다.
