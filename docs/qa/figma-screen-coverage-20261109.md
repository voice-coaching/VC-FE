# 03_Screen 디자인 적용 점검 — 2026-11-09

대상: [SPEAK-AI / 03_Screen](https://www.figma.com/design/ZvdY7HlvuSgSAlg4o9W0JC/SPEAK-AI?node-id=116-520&m=dev). FE 기준은 원격 main `597e8d9`에 이번 P20 변경을 더한 상태, BE 기준은 `10da88e`에 72시간 체험 변경을 더한 상태다.

## 점검 범위와 해석

페이지 전체 메타데이터를 읽어 화면 구성을 확인하고, SCREEN7의 직접 자식 모바일 화면 197개와 Phase 3 결제의 현행 이름 화면 18개를 현재 라우트·컴포넌트·API와 대조했다. 내부 Body/Dim/Scroll을 별도 화면으로 세지 않았다. Phase 2/4, SCREEN, 페이지 최상위에는 중복·이전 시안이 섞여 있으므로 가장 최근 명칭의 대응 화면을 우선했다. `_이전`, `SCREEN7 · 보관 (최종 제외)`, 아카이브는 필수 미구현 목록에서 제외했다.

이 문서는 **기능 및 구성의 코드 대조**다. P20 이외의 197개 상태를 모두 브라우저로 실행하거나 픽셀 비교한 결과가 아니다. 아래 '대응 구현 있음'은 모든 세부 치수가 동일하다는 뜻이 아니다. 기존 9월 문서의 'localStorage 모의 데이터만 존재', '입모양 미연동' 같은 진단은 현재 코드에 그대로 적용할 수 없다.

## 확인된 미적용·부분 적용 및 명세 차이

| 우선순위 | Figma 화면 | 현재 상태와 근거 | 남은 작업 |
| --- | --- | --- | --- |
| 높음 | [P3 구매](https://www.figma.com/design/ZvdY7HlvuSgSAlg4o9W0JC/SPEAK-AI?node-id=2587-6050), [P9 프리미엄](https://www.figma.com/design/ZvdY7HlvuSgSAlg4o9W0JC/SPEAK-AI?node-id=3116-9965), P14 관리 | 디자인은 월 9,900원·무제한·자동 결제. 현재 `payment-views.tsx`는 TEST 일회 결제, 이용기간당 30회, 자동 갱신 없음. 구매/내역/관리 UI와 결제 API는 있으나 상품 조건이 다르다. 신규 P20의 72시간 무제한은 별도 체험 상품이다. | 가격·정기결제·월 무제한 정책 확정 후 FE 표시와 BE 결제/권한 계약을 함께 수정. 문구만 바꾸면 실제 과금과 불일치한다. |
| 높음 | [P15 해지 확인](https://www.figma.com/design/ZvdY7HlvuSgSAlg4o9W0JC/SPEAK-AI?node-id=2637-6055), [P16 해지 완료](https://www.figma.com/design/ZvdY7HlvuSgSAlg4o9W0JC/SPEAK-AI?node-id=2637-6087) | 미적용. `payment-navigation.ts`에 정기결제 해지 상태가 없고 BE는 주문 취소·환불만 제공한다. 현재 자동 갱신이 없으므로 취소/환불을 '자동 결제 해지'로 표시해서는 안 된다. | 정기결제 도입 시 해지 API와 두 화면 연결. |
| 중간 | [입모양 연습 설정](https://www.figma.com/design/ZvdY7HlvuSgSAlg4o9W0JC/SPEAK-AI?node-id=2694-19616) | 부분 적용. 엄격/보통/너그럽게 선택 UI는 있으나 `lip-quick-start.tsx`의 criterion은 컴포넌트 내부 상태에만 저장된다. `onSelect`/`onStart`와 분석 요청에 평가 기준이 전달되지 않는다. | 평가 기준을 API가 지원하는지 확정하고 저장·요청 계약 연결. |
| 중간 | [아나운서 문장별 재녹음](https://www.figma.com/design/ZvdY7HlvuSgSAlg4o9W0JC/SPEAK-AI?node-id=2861-8720), 2861:8561, 2861:8642 | 시안 미적용. `recording-practice-session.tsx` 확인 화면에는 문장별 듣기와 전체 다시 녹음이 있으나 이미 녹음한 특정 문장을 교체하는 조작은 없다. 클래스의 문장 단위 진행은 이 기능과 다르다. | 시안 채택 후 문장별 오디오 교체·경계 재계산·전체 듣기·업로드 구현. |
| 중간 | [입모양 5개 선택](https://www.figma.com/design/ZvdY7HlvuSgSAlg4o9W0JC/SPEAK-AI?node-id=2873-8755), E02~E10 1/5~5/5 | 명세 충돌. 같은 디자인 안에 '5/5', '5문장으로 연습하기'와 '최대 3문장'이 함께 있다. 현재 `lip-quick-start.tsx`는 최대 3개이며 녹화 흐름은 선택 문장 수에 따른다. 따라서 5개 상태는 현재 진입 불가다. | 3개/5개 중 최종 기준을 먼저 정리한 뒤 선택 제한과 카운트 화면 통일. |
| 중간 | [P2 소진 바텀시트](https://www.figma.com/design/ZvdY7HlvuSgSAlg4o9W0JC/SPEAK-AI?node-id=2581-6049), [P18 소진 결제 모달](https://www.figma.com/design/ZvdY7HlvuSgSAlg4o9W0JC/SPEAK-AI?node-id=2669-6056) | 부분 적용. 코칭 소진/기간 종료 오류 분기와 이용권 이동은 `recording-practice-session.tsx`에 있으나 해당 Figma 구매 바텀시트 형태가 아닌 오류 화면+사용량 요약을 사용한다. | 최종 시트 하나를 선택해 공통 소진 컴포넌트로 적용. |
| 낮음 | [P19 오픈 기념 팝업](https://www.figma.com/design/ZvdY7HlvuSgSAlg4o9W0JC/SPEAK-AI?node-id=2669-6104) | 미적용/대체. 월 9,900원 할인·오늘 하루 숨김 프로모션은 최신 요청의 P20 신규 가입 3일 체험과 다른 캠페인이다. 이번 작업에서는 P20을 home 진입 모달로 적용한다. | 별도 운영 필요 시 대상·기간·노출 우선순위를 정의. P20과 동시 자동 노출하지 않음. |
| 낮음 | Phase 2/4 입모양 A1/A2/A3 및 B1/B2 세트/주제 선택 | 대체 흐름. 현행은 SCREEN7의 안내→문장 고르기→권한/녹화 흐름(`lip-quick-start.tsx`, `routes/lip-practice.tsx`). 예전 A/B 선택 화면은 독립 흐름으로 연결되지 않는다. | 이전 대안인지 추가 필수 흐름인지 디자인에서 정리. |

## 이번에 적용한 P20

[신규 가입 · 프리미엄 3일 제공](https://www.figma.com/design/ZvdY7HlvuSgSAlg4o9W0JC/SPEAK-AI?node-id=3126-9836)의 Background, Safe Area Top, Header, Body, Bottom CTA를 하나의 실제 모달로 구현했다. Figma 원본 에셋 5개와 Noto Sans KR을 사용하며 버튼·링크는 독립 요소로 동작한다. 최신 디자인의 X는 닫기로 적용한다(이전 'X 삭제' 요청보다 최신 디자인을 우선).

- home 진입 시 인증된 사용자에 대해 서버 자격을 조회한다. 조회만으로 요금제를 변경하지 않는다.
- 현재 free이고 체험 이력이 없는 활성 계정이 대상이다. 기존 free 계정도 미사용이면 포함한다. 별도 가입일 제한은 요청에 없으므로 추가하지 않았다.
- 시작 버튼은 인증된 본인의 체험을 DB에 생성한다. 서버 시각부터 정확히 72시간, paid/TRIAL 및 코칭 무제한으로 계산한다.
- 이미 활성화된 요청 재전송은 최초 만료 시간을 반환하고 연장하지 않는다. 만료 이력은 남겨 재지급을 막는다. 유료 구매/관리자 권한은 기존 우선순위를 유지한다.
- 만료 후 다른 활성 유료 권한이 없다면 free로 해석한다. 자동 결제나 결제 주문은 만들지 않는다.
- 닫기·자세히 보기로 체험을 부여하지 않는다. 네트워크 실패 시 재시도하며 자격 조회 실패 시 임의 모달을 띄우지 않는다.

## 대응 구현이 확인된 주요 영역

| 디자인 영역 | 현재 구현 근거 | 판정 |
| --- | --- | --- |
| 로그인·약관·가입 완료 | `landing-login-screen.tsx`, `terms-screen.tsx`, `app/terms/complete` | 대응 구현 있음 |
| 온보딩 5단계·계획 항목 수정 | `routes/onboarding.tsx`, `practice-plan-editor.tsx`, `save-onboarding-plan.ts` | 대응 구현 및 API 있음 |
| 홈·연속 연습·월/주 목표 선택 | `routes/home.tsx`, `home-streak.tsx`, `lib/streak.ts` | 대응 구현 있음 |
| 뉴스 랭킹·난이도·문장 카테고리·아나운서 목록 | `routes/news/index.tsx`, `app/sentences/page.tsx`, `routes/announcer/index.tsx`, `news-ranking-carousel.tsx` | 대응 구현 있음 |
| 녹음 준비/중/확인·가이드·권한·나가기·전체 재녹음 | `recording-practice-session.tsx`, `news-recording.tsx`, `sentence-recording-controls.tsx` | 대응 구현 있음. 문장별 교체는 위 차이 참조 |
| 분석 중/실패·리포트·총평·점수 펼침·단어 피드백·음성 재생 | `recording-practice-session.tsx`, `report-score.tsx`, `report-correction.tsx` | 대응 구현 있음. 실제 결과 데이터에 따라 항목 가변 |
| 내 문장 입력·확인·보관함·주제·편집/선택 삭제·중복/빈 상태 | `my-script-screen.tsx`, `script-topic-manager.tsx`, `lib/script-library.ts` | 서버 CRUD 구현 있음 |
| 입모양 권한/카메라/마이크·얼굴 맞추기·녹화·결과 | `routes/lip-practice.tsx`, `lip-capture.tsx`, `canonical-lip-result.tsx` | 대응 구현 있음. 평가 기준·선택 수 차이는 위 참조 |
| 발음/억양 클래스 목록·상세·원리·순차 연습 | `routes/class/index.tsx`, `course-catalog.tsx`, `course-lesson.tsx`, `recording-practice-session.tsx` | 대응 구현 있음 |
| 마이 레벨·승급 시험·요약·계획·약점 연습 | `routes/mypage.tsx`, `title-exam-session.tsx`, `weakness-practice.ts`, `practice-plan-editor.tsx` | 대응 구현 있음 |
| 성장 그래프 주/월/전체·막대 선택·데이터 없음 | `my-growth-chart.tsx`, `score-trend.ts` | 대응 구현 있음. 전체는 조회 가능한 최근 1년 |
| 기록·기록 상세·리포트 저장·완료 | `routes/mypage/history.tsx`, `app/mypage/history/[sessionId]`, `report-save-dialog.tsx` | 대응 구현 있음 |
| 알림 목록/없음·설정·닉네임·알림 환경설정 | `routes/home-notifications.tsx`, `routes/mypage/settings.tsx` | 대응 구현 및 API 있음 |
| P4~P8 결제 확인/결과, P10~P13 내역/상세/환불/설정 | `payment-views.tsx`, `routes/mypage/payments.tsx`, `lib/payment.ts` | 대응 구현 있음. TEST 전액 취소/환불 범위 |

## 별도 기술 확인 사항

BE 기준 main의 `CoachingUsageService.reserve`는 window.limit가 null이면 바로 반환하고, 일반 사용자 경로에서도 횟수/기간/원고·음성 제한을 거부하는 검사가 빠져 있다. 이번 변경 전부터 같은 코드이며 이번 작업에서 수정하지 않았다. 기존 코칭 서비스 테스트 6개 실패와 관련된다. **만료 시 회원 상태가 free로 바뀌는 것과 무료 코칭 제한을 서버가 강제하는 것은 별도**다. P2/P18 소진 화면의 실제 발동 및 상품 정책 검증을 위해 후속 수정이 필요하다.

운영 DB 적용은 BE Flyway V71 및 배포가 필요하다. 로컬 H2 통합 테스트와 애플리케이션 빌드를 검증했으며 운영 계정에 체험을 임의 지급하지 않았다. PostgreSQL 실행 테스트는 로컬 서버/컨테이너 부재로 수행하지 않았다.

## P20 검증 결과

### Summary

P20 모달과 72시간 체험 API의 로컬 QA 통과. FE 단위/계약 테스트 10개, BE 통합·회원권 테스트 12개 통과. FE 프로덕션 빌드와 BE bootJar 성공. 기존 별도 코칭 서비스 테스트의 실패는 위 기술 확인 사항에 명시했다.

### Environment

- URL: http://localhost:3134/home/ (프로덕션 빌드)
- Viewports: 402×874, 320×568, 1280×900
- Browser plugin not available — 저장소 Playwright와 설치된 Chrome 사용.
- FE API는 로컬 fixture, BE 테스트는 실제 H2 트랜잭션. 운영 DB/실제 사용자 혜택 지급은 수행하지 않음.

### Checks

| Check | Result | Evidence |
| --- | --- | --- |
| Page Identity | Pass | /home 및 SpeakAI 제목 |
| Blank Page | Pass | 홈 제목과 체험 dialog 렌더링 |
| Framework Overlay | Pass | 오류 오버레이 없음 |
| Console | Pass | 예외 없음. 장애 시나리오의 의도된 503 응답만 허용 |
| Screenshot Evidence | Pass | 원본 Figma 렌더와 모바일 결과 비교. CTA x20/y750/362×58 일치 |
| Interaction Proof | Pass | 활성화, 중복 클릭 방지, 실패 후 재시도, 닫기 후 재진입, 상세 이동, 유료/만료/조회 실패 제외, 작은 화면 스크롤, 데스크톱 9개 시나리오 |

### Changes Verified

초기 자동 포커스가 X에 원형 외곽선을 만들던 문제를 dialog 자체 포커스로 수정했다. 키보드로 버튼에 이동하면 포커스 표시가 유지된다. 성공 토스트 렌더러를 연결했고, 320px에서 400px glow가 가로 스크롤을 만들던 문제를 장식 영역의 가로 클리핑으로 수정했다. 402px 기준 배치는 유지된다. 높이가 874px보다 작은 화면은 세로 스크롤로 CTA에 접근한다.

정적 에셋 5개 모두 로컬 파일·정상 디코딩·사용 위치·렌더 크기를 확인했다: close 24×24, glow 400×400, mascot 402×558, crown 약22.407×18, sparkle 20×20. 화면 전체에 배경을 채우고 콘텐츠는 최대402px로 중앙 정렬한다.

### Commands

- `node --import tsx --test scripts/premium-trial.test.ts scripts/coaching-usage.test.ts`
- 변경 TS/TSX 및 검증 스크립트 ESLint
- `npm run build -- --webpack` (타입 검사 포함)
- `HOME_TEST_BASE_URL=http://localhost:3134 HOME_BROWSER_EXECUTABLE_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" node scripts/verify-home-popup.mjs`
- BE: `bash gradlew test --tests '*PremiumTrial*Test' --tests '*TestMembershipServiceTest' bootJar --no-daemon --max-workers=2 --no-watch-fs`

### Remaining Risk

운영 PostgreSQL 마이그레이션, 실제 배포 상태, Safari/네이티브 WebView는 이 로컬 QA로 증명하지 않는다. 전체 Figma 화면에 대한 픽셀 QA는 P20 범위 밖이다. 추후 인앱 검증 편의를 위해 Browser integration 설치를 권장한다.

### Screenshots

로컬 증거는 `/tmp/vc-premium-trial-qa/`에 보관했다. `activate.png`는 Figma 기준 모바일, `desktop.png`는 전체화면 배경, `small.png`와 `small-cta.png`는 좁고 짧은 화면의 첫 화면 및 스크롤 후 CTA 접근을 보여 준다. 스크린샷은 저장소에 커밋하지 않았다.


