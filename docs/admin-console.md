# SpeakAI 관리자 UI

## 기준과 구현 범위

프론트 origin/main **0a44c3a**에서 분리한 **feat/admin-console** 브랜치다. `/admin`을 별도 운영 콘솔로 추가했다. 기존 서비스의 파란색·둥근 카드·한글 글꼴을 사용하고 데스크톱은 좌측 메뉴, 모바일은 가로 메뉴와 단일 열로 배치한다. 기존 사용자 화면의 레이아웃·분석 경로·결제 흐름은 변경하지 않는다.

이 화면은 백엔드 관리자 1차·아나운서 음성·알림 확장 API를 사용한다. 백엔드 V62/V63/V64 및 해당 관리자 API가 배포되어 있어야 실제 데이터가 보인다. **프론트 배포만으로 API나 실제 관리자 계정이 생성되지 않는다.**

## 화면

| URL                                                                       | 기능                                                              |
| ------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| /admin                                                                    | 서버 목록 총건수 기반 운영 현황, 최근 접수 문의·작업 이력         |
| /admin/users                                                              | 회원 검색·상태/권한 필터·페이지, 분석 UUID→회원 조회              |
| /admin/users/{id}                                                         | 회원 상세·등급·코칭 현황, 13개 분류별 소유 기록 탭                |
| /admin/contents                                                           | 콘텐츠 유형·상태·제목 검색                                        |
| /admin/contents/new                                                       | 서버 등록 카테고리 기반 공용 초안 생성                            |
| /admin/contents/{id}                                                      | 미공개 초안 편집, 명시적 공개/숨김, 공개 원문 복사 후 새 초안     |
| /admin/announcer                                                          | 아나운서 문장 목록                                                |
| /admin/announcer/new                                                      | ANNOUNCER 초안 작성 후 음성 등록 화면으로 이동                    |
| /admin/announcer/{id}                                                     | 기준 음성 업로드·등록·미리듣기·대표 지정                          |
| /admin/notices, /admin/notices/new, /admin/notices/{id}                   | 구역·문단 공지 작성, 공개 예약·비공개·상단 고정                   |
| /admin/inquiries, /admin/inquiries/{id}                                   | 문의 조회·답변·처리 시작·종료                                     |
| /admin/notifications, /admin/notifications/new, /admin/notifications/{id} | 전체/선택 회원·일반/요금제 안내 초안 → 내용·대상 검토 → 수동 발송 |
| /admin/popups, /admin/popups/new, /admin/popups/{id}                      | 시작 시각·1~365일·우선순위·활성 설정, 문구 미리보기               |
| /admin/audit                                                              | 관리자·작업·대상·기간별 성공 변경 기록 조회                       |

없는 하위 경로·잘못된 ID는 404다. 회원 ID는 기존 숫자 userId이며 UUID는 분석 연결 검색에만 쓴다. 결제/취소·환불 기록은 TEST 원장으로 명시한다. raw 점수 전문·개인 원문·비밀번호·토큰·원본 음성 URL을 임의 조회하는 UI는 만들지 않았다.

팝업 메뉴는 관리용 등록/편집 화면이다. 기존 사용자 화면에 `/api/users/me/popup`을 호출하여 실제 모달을 표시하는 변경은 이번 UI 범위에 포함하지 않았다. 알림함은 기존 `GET /api/notifications`와 string type 계약으로 ADMIN_GENERAL/ADMIN_PLAN 항목을 받는다. 브라우저 푸시·이메일·결제 자동 알림·회원 강제 등급/권한 변경 기능은 추가하지 않았다.

## 접근과 세션

- 별도 관리자 비밀번호를 만들지 않고 기존 로그인·토큰 갱신·`/api/backend` 프록시를 재사용한다.
- 먼저 `GET /api/admin/me`를 확인하고, role이 실제 ADMIN일 때만 하위 화면을 표시한다. membershipType=admin은 권한 판정에 쓰지 않는다.
- 401/403이면 관리 화면을 숨긴다. 인증 실패 후 무한 refresh를 반복하지 않는다. 로그인 버튼은 검증된 내부 next 경로로 돌아온다.
- 쿼리 키에 로그인 세션 버전을 포함하고 계정 전환 시 화면을 다시 마운트한다. 관리자 응답은 no-store이고 완료 캐시는 유지하지 않는다.
- UI 차단은 편의 기능이다. 실제 접근 통제·상태 전이·수신 대상·동시성 검증은 각 백엔드 API가 수행한다.

## 변경·오류·업로드

공개·숨김·알림 발송·대표 음성 변경·문의 상태 전이는 사유를 입력하는 확인 대화상자를 사용한다. 다른 저장 폼도 사유를 필수로 받는다. 버튼은 처리 중 중복 실행을 막고 변경 요청을 자동 재시도하지 않는다.

409에서는 입력을 유지하고 최신 상세를 다시 검토하도록 안내한다. 응답 유실·시간 초과는 성공/실패를 단정하지 않으며, 새 POST 전에 목록·상세에서 반영 여부를 확인한다. 편집 폼은 창 포커스만으로 서버 값으로 교체하지 않는다.

기준 음성은 파일 전체 SHA-256을 계산하고 서버 발급 URL·필수 헤더로 직접 PUT한다. 그 요청에는 백엔드 JWT·쿠키를 보내지 않는다. HTTP·사용자정보 포함 URL이나 인증 헤더가 섞인 업로드 계약은 거절한다. 음성은 등록 완료 전 연결됐다고 표시하지 않는다.

같은 업로드 ID와 원본 File을 현재 화면 메모리에 보존하여 등록 확인·동일 파일 재전송을 제공한다. PUT 412는 덮어쓰지 않고 같은 ID로 서버 검증을 받는다. 새 업로드를 준비하기 전 등록 목록을 확인한다. 페이지 종료나 새로고침 시 이 복구 상태는 사라지고 서명 URL도 만료된다. 미리듣기는 필요할 때 새 URL을 받고 만료 시 제거한다. 프론트 확장자·크기 검사는 보조이며 실제 오디오 디코딩·원문/버전 검증은 백엔드 책임이다.

## 로컬 실행

```powershell
npm ci
npm run dev -- --hostname 127.0.0.1 --port 3100
```

기존 환경 설정의 API_BASE_URL을 연결할 백엔드 루트 주소로 지정하고, 실제 role=ADMIN 계정으로 로그인한 뒤 `http://127.0.0.1:3100/admin`에 접근한다. DB 비밀번호·서버 비밀키를 NEXT_PUBLIC 환경변수에 넣지 않는다. 운영 주소나 비밀번호를 이 문서에 저장하지 않는다.

## 검증

```powershell
npm run verify:admin
npm run verify:api
npx tsc --noEmit
npx eslint src/features/admin src/app/admin scripts/verify-admin-browser.mjs
npm run build
```

브라우저 검증은 별도 터미널에서 위 로컬 개발 서버를 실행한 상태로 진행한다.

```powershell
npx playwright install chromium
npm run verify:admin:browser
```

설치된 Chrome을 사용하는 Windows 예시:

```powershell
$env:ADMIN_BROWSER_EXECUTABLE_PATH='C:/Program Files/Google/Chrome/Application/chrome.exe'
npm run verify:admin:browser
```

ADMIN_TEST_BASE_URL 기본값은 http://127.0.0.1:3100이며 localhost만 허용한다. 브라우저 테스트는 API·S3 응답을 테스트 전용으로 대체하며 실제 회원·결제·알림 발송을 변경하지 않는다. 이 응답은 테스트 스크립트에만 있고 제품 코드에는 mock fallback이 없다. 스크린샷의 회원·건수는 테스트 자료이며 운영 DB 수치가 아니다. 산출물은 ignored `test-artifacts/admin-ui/`에 저장한다.

확인한 결과: 관리자 계약·보안 테스트10개 통과, 브라우저 시나리오15개 통과, 기존 API 계약90개 및 토큰 갱신·온보딩 계약 통과. 브라우저에서는 모든 메뉴, 입력 409 보존, 문장 공개, 음성 PUT 인증 분리, 발송 전 검토, 팝업 기간, 공지 문단, 문의 종료, 모바일 너비, 권한 회수·비로그인을 확인했다. 실제 관리자 계정·백엔드 통합, S3 CORS·유효한 음성 디코딩·재생, 최종 운영 발송은 환경 배포 후 검증이 남는다.

## 파일 구조

- src/app/admin: App Router 경로·metadata·layout. params는 현재 Next.js 계약에 따라 await한다.
- src/features/admin/api.ts: 기존 인증 HTTP client를 사용하는 관리자 전용 adapter.
- src/features/admin/services.ts: 요청 검증·시각/입력 변환·업로드 유스케이스.
- src/features/admin/types.ts: 관리자 API 계약 타입.
- src/features/admin/hooks.ts: 세션별 조회·중복 없는 변경 실행.
- src/features/admin/components: 메뉴·목록·폼·상세·확인 대화상자.
- src/features/admin/admin.module.css: 관리자 전용 반응형 스타일.
- src/features/admin/services.test.ts, scripts/verify-admin-browser.mjs: 제품 코드와 분리한 검증.

검증일: 2026-11-02. TypeScript 검사, 관리자 변경 파일 ESLint, 프로덕션 next build가 통과했다. 관리자 브라우저 검증15개와 요청·보안 테스트10개가 모두 통과했다. 개발 서버는 검증 후 종료했으며 실제 운영 배포는 수행하지 않았다.

## 최신 main 및 기존 디자인 적용

프론트 main `799af4c`에서 `feat/admin-api-integration` 브랜치를 만들었다. 기존 서비스의 글로벌 글꼴, 파란색·문자색·구분선 디자인 변수, 흰색 카드와 둥근 버튼을 사용한다. 일반 학습 화면의 배치는 유지하고, 설정에 서버의 `/api/admin/me` 검사에 성공한 계정만 보이는 관리자 진입 항목을 추가했다. 직접 `/admin`에 접근해도 별도로 권한을 검사한다. 테스트 이용등급이나 이메일로 접근 여부를 추정하지 않는다.

백엔드 PR #172의 관리자 API와 V62~V64 적용이 선행되어야 한다. 운영에 관리 API가 없거나 접근이 거부되면 화면에 가짜 데이터를 표시하지 않는다. 현재 main의 일반 기준 음성 조회는 초안도 반환할 수 있으므로, 초안 등록이 일반 사용자에게 비공개임을 보장한다고 안내하지 않는다.

최신 main 대조 후 재검증: 관리자 서비스 테스트 10개, 브라우저 15개, 기존 API 계약 90개가 통과했다. 설정 진입 항목의 서버 권한 확인과 테스트 이용등급만 있는 계정의 진입 숨김도 브라우저에서 검증했다. TypeScript와 변경 파일 ESLint가 통과했다. 이 검증의 브라우저 API/S3 응답은 테스트용 대체 응답이며 실제 운영 계정으로 글 등록·음성 업로드·알림 발송을 수행하지 않았다.

이번 화면은 관리자용 팝업 등록·편집·기간 관리까지 제공한다. 일반 회원 화면에서 `/api/users/me/popup`을 읽어 모달을 표시하는 기능은 이번 관리자 UI 변경에 포함하지 않는다.

최신 main 위 프로덕션 빌드도 성공했다. 빌드가 생성한 next-env.d.ts 변경은 원래 내용으로 복원했다.
