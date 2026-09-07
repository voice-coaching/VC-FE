# 로컬 VC-BE API 점검

## 확인 기준

인접한 `../VC-BE/src/main/java/org/example/voice`의 컨트롤러, DTO, 서비스,
도메인과 공통 응답/예외 처리를 대조했다. 운영 서버의 구현 여부와는 구분한다.
`docs/api/specification.md`는 템플릿이며, `endpoints.md`의 `/health`도
현재 Java 컨트롤러에는 구현이 없다.

실제 메서드 매핑은 아래 3개다. 나머지 인증·사용자·홈·콘텐츠·과정·훈련·분석
컨트롤러에는 클래스 수준 경로만 있고 요청을 처리할 메서드는 없다.

| API | 점검 결과 및 반영 |
| --- | --- |
| GET /api/onboarding/me | 기존 연동 유지. goalText, dailyGoalMinutes, weeklyGoalCount의 null 응답 반영. completedAt은 조회 응답에 필수. |
| PUT /api/onboarding/me | 조회 응답과 저장 입력 타입 분리. currentLevel 및 설문 4개 목록은 필수이고 목록은 비어 있으면 400. 나머지 목표 필드는 생략/null 가능. |
| PATCH /api/onboarding/me | currentLevel/completedAt을 입력 타입에서 제외. 설문 내부 목록별 부분 수정 지원. 계정 설정에 학습 목표 수정 UI 연결. 응답에는 goalText, dailyGoalMinutes, updatedAt만 있음. |

공통 응답은 `{ result, message, data }`. 400/404 오류도 같은 envelope이며
별도 `code` 필드는 없다. 기존 클라이언트의 오류 처리와 일치한다.
PATCH의 null/생략은 기존 값 유지이며, 빈 설문 배열은 현재 백엔드에서 그대로 저장한다.

## 백엔드에서 남은 작업

- `OnboardingService`는 로그인 사용자 대신 `TEMP_LOGIN_USER_ID = 1L`을 사용한다.
- 인증/사용자 API가 구현되지 않아 SessionGate의 사용자 확인과 온보딩 전 닉네임
  저장까지 포함한 로그인→온보딩 흐름은 이 로컬 백엔드만으로 완료할 수 없다.
- 프론트의 53개 API 어댑터 테스트는 요청 경로 검증이다. 53개 백엔드 API의
  구현 또는 운영 통합 테스트 성공을 의미하지 않는다.
- 기존 어댑터를 삭제하거나 인증을 우회하지 않았다. 실제 로그인 사용자 처리와
  나머지 서버 API 구현 후 서버를 통한 종단 검증이 필요하다.

## 함께 복구한 병합 오류

중복/미완성 타입 선언, auth의 중복 import 및 중복 catch, auth/page의 병합 마커,
Providers의 깨진 함수와 삭제된 dev-account 참조, API 생성자의 미정의 개발 함수
참조를 수정했다. 이전 정상 구현을 기준으로 OAuth state 검증, Naver 분기,
리다이렉트 설정, 로그인 후 복귀 경로와 SessionGate를 복구했다.

## startTime 오류

제공된 `et.reportAllChanges (<anonymous>:2:19429)` 및 `n.timeout (...:2:5652)`는
[GoogleChrome/web-vitals #792](https://github.com/GoogleChrome/web-vitals/issues/792)의
Chrome DevTools 주입 스크립트 오류와 위치까지 일치한다. 담당자는 INP entries가
비는 경우 DevTools가 엔트리의 startTime을 읽어서 발생한다고 확인했다.
앱 소스에는 reportAllChanges/startTime 호출이 없고, 확인 당시 열린 운영 탭의
콘솔 수집 로그에서도 해당 오류는 재현되지 않았다.

[2026-09-06 담당자 답변](https://github.com/GoogleChrome/web-vitals/issues/792#issuecomment-5559906393)에
따르면 Chrome 153에 수정이 포함되고 9월 8일부터 정식 배포 예정이다.
Chrome 메뉴 → 도움말 → Chrome 정보에서 153 이상으로 업데이트하고 재시작한다.
업데이트 전에는 DevTools를 닫고 페이지를 새로 열어 사용한다.
앱의 PerformanceObserver나 전역 오류 처리를 덮어써서 숨기지 않는다.
브라우저 설정 URL은 자동화 도구 보안 정책으로 차단되어 업데이트를 자동 수행하지 못했다.
