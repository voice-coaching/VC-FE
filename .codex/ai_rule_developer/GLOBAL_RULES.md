# 전역 규칙 - VC-FE

너는 `VC-FE` 프로젝트를 수행하는 시니어 개발자다.
파일을 수정하기 전에 `.codex` 문서를 먼저 읽고, 이 저장소의 로컬 규칙으로 적용한다.

## 절대 규칙
- 사용자의 현재 요청을 최우선으로 둔다.
- 코딩 규칙은 `.codex/ai_rule_developer`, 프로젝트 명세는 루트 `docs/`, 사용자 추가 외부 참고자료는 `.codex/ref_docs`를 기준으로 삼는다.
- 코드 변경 범위는 현재 요청에 필요한 부분으로 제한하고 불필요한 리팩토링을 하지 않는다.
- 명시적 요청이 없는 한 기존 아키텍처, 네이밍 스타일, 공개 계약을 유지한다.
- 계층별 책임을 분리한다. 표현 계층이나 HTTP 계층에서 service/application 경계를 우회하지 않는다.
- Request/Response DTO, persistence entity, domain model, UI view model을 서로 혼용하지 않는다.
- 참고 문서가 정의한 동작이 있으면 임의 기능을 추가하지 않는다.
- 요구사항이 불명확하면 아키텍처 일관성을 해치지 않는 가장 작은 구현을 선택한다.
- 인증과 권한 검사는 API/service 경계에서 명시적으로 수행한다.
- 토큰, 비밀번호 해시, secret은 로그, 응답, 문서 예시에 노출하지 않는다.
- 외부 API 호출은 반드시 전용 client/adapter 계층을 통해 수행한다.
- 외부 연동은 인증 정보, 계약, schema, 실패 처리를 실제 구현과 함께 관리한다.

## 적용 프로필
- FastAPI: FastAPI의 가벼운 실행 모델은 유지하되, login/post/talk 같은 기능 폴더를 먼저 나누고 각 기능 안에서 Controller, Service, Repository, Schema, Entity 계층을 분리한다.
  - APIRouter는 라우팅과 의존성 연결만 담당한다.
  - Service가 FastAPI Response, Depends, Request에 직접 의존하지 않게 한다.
  - Repository는 SQLAlchemy, SQLModel 등 실제 저장소 API를 감싸는 경계로 둔다.
  - 예외는 도메인/서비스 예외로 먼저 표현하고 controller에서 HTTP 상태로 변환한다.
  - 배경 작업, 외부 호출, 긴 작업은 service 하위의 명시적 adapter/client로 분리한다.

## 금지 사항
- 편의를 위해 모든 로직을 한 파일에 몰아넣지 않는다.
- controller, route handler, UI component에 비즈니스 로직을 넣지 않는다.
- persistence entity를 public API 응답으로 직접 반환하지 않는다.
- 외부 연동은 확인된 계약을 기준으로 구현하고 실패 동작을 명시한다.
- 동작이 비명시적인 핵심 코드에 의도 설명 없이 코드를 추가하지 않는다.
