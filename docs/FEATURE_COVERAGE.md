# 기능 및 API 연동 현황

현재 구현 기준은 2026-08-25 재확인한 **운영 Swagger 53개 operation**입니다. Notion API 데이터베이스는 이 중 3개가 빠진 50개이므로 보조 자료로 사용합니다.

- 53개 전체 엔드포인트의 구현·화면 연결·검증 현황은
  [API_INTEGRATION_REPORT_2026-08-08.md](./API_INTEGRATION_REPORT_2026-08-08.md)를 확인하세요.
- 로컬 실행 환경, 인증/쿠키 정책, 실서버 점검 절차는
  [API_INTEGRATION.md](./API_INTEGRATION.md)를 확인하세요.

- 현재 서버에 없는 사용자 입력 문장 API는
  [API_INTEGRATION_GAPS.md](./API_INTEGRATION_GAPS.md)를 확인하세요.
- 첨부 FigJam과 실제 웹앱 흐름의 차이는
  [FIGJAM_FLOW_COVERAGE_2026-08-25.md](./FIGJAM_FLOW_COVERAGE_2026-08-25.md)를 확인하세요.

이 문서가 이전에 참조하던 PDF 기반 상태표와 mock API는 더 이상 현재 구현의
기준이 아닙니다. 사용자 정의 문장 생성은 ver.08/07 명세에 생성 엔드포인트가
없으므로 메뉴에서 노출하지 않으며 기존 주소는 등록된 문장 연습으로 이동합니다.
