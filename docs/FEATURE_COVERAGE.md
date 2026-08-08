# 기능 및 API 연동 현황

현재 구현 기준은 Notion의 **API 명세서(ver.08/07)** 입니다.

- 53개 전체 엔드포인트의 구현·화면 연결·검증 현황은
  [API_INTEGRATION_REPORT_2026-08-08.md](./API_INTEGRATION_REPORT_2026-08-08.md)를 확인하세요.
- 로컬 실행 환경, 인증/쿠키 정책, 실서버 점검 절차는
  [API_INTEGRATION.md](./API_INTEGRATION.md)를 확인하세요.

이 문서가 이전에 참조하던 PDF 기반 상태표와 mock API는 더 이상 현재 구현의
기준이 아닙니다. 사용자 정의 문장 생성은 ver.08/07 명세에 생성 엔드포인트가
없으므로, 임의의 `contentId`를 만들어 전송하지 않고 화면에서 지원 범위를
안내합니다.
