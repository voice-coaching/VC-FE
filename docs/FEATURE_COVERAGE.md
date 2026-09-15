# 기능 및 API 연동 현황

현재 구현은 2026-08-25 재확인한 **운영 Swagger 53개 operation**에 신규 프로필 사진·칭호 계약 8개를 추가한 총 61개 프론트 계약을 사용합니다. Notion API 데이터베이스는 기존 계약 중 3개가 빠진 50개이므로 보조 자료로 사용합니다.

- 53개 전체 엔드포인트의 구현·화면 연결·검증 현황은
  [API_INTEGRATION_REPORT_2026-08-08.md](./API_INTEGRATION_REPORT_2026-08-08.md)를 확인하세요.
- 로컬 실행 환경, 인증/쿠키 정책, 실서버 점검 절차는
  [API_INTEGRATION.md](./API_INTEGRATION.md)를 확인하세요.

- 현재 서버에 없는 사용자 입력 문장 API는
  [API_INTEGRATION_GAPS.md](./API_INTEGRATION_GAPS.md)를 확인하세요.
- 첨부 FigJam과 실제 웹앱 흐름의 차이는
  [FIGJAM_FLOW_COVERAGE_2026-08-25.md](./FIGJAM_FLOW_COVERAGE_2026-08-25.md)를 확인하세요.

이 문서가 이전에 참조하던 PDF 기반 상태표와 mock API는 더 이상 현재 구현의
기준이 아닙니다. 사용자 정의 문장은 생성 엔드포인트가 없어 `/my-script`에서
로컬 녹음과 예시 분석 결과를 제공하며, `/practice/custom`도 이 화면으로 이동합니다.
실제 서버 학습 기록에는 저장하지 않습니다. 디자인 적용 범위는
[Frame 5 적용 기록](./FRAME5_DESIGN_COVERAGE.md)을 참고하세요.
