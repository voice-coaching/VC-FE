# FigJam 플로우 커버리지 점검

점검일: 2026-08-25  
기준: 사용자가 첨부한 FigJam 전체 화면 이미지와 `src/app` 라우트, 인증 게이트, API 호출 흐름

## 판정

첨부 FigJam은 로그인 → 온보딩 → 홈 → 주요 메뉴로 이어지는 상위 사이트맵은 담고 있지만, 웹앱의 모든 플로우차트는 담고 있지 않습니다.

## 이미지에 포함된 상위 흐름

- Login → OAuth Login / Email Login → Onboarding → Home
- Home → 아나운서 따라하기 / Class / MyPage / Daily News / Sentence Practice / Accent Test / Pronounce Class
- MyPage → Settings / Onboarding 및 라벨이 없는 하위 노드

## 추가해야 할 실제 흐름

- 랜딩과 인증: `/`, 로그인·회원가입 모드 전환, 이메일 중복 확인, 약관 동의, Google·Kakao·Naver 콜백, OAuth 취소·state 오류, 로그인 후 원래 경로 복귀
- 세션: 보호 경로 진입, 세션 복원, 401 토큰 갱신과 원 요청 재시도, 비로그인·온보딩 미완료 리다이렉트
- 온보딩: 단계별 선택, 이전 단계, 유효성 검사, 전체 저장, 실패 재시도
- 콘텐츠: 뉴스·문장·아나운서 목록, 필터·페이지네이션, 상세 조회, 기준 음성 재생
- 클래스: 목록, 상세, 시작·이어하기·재학습, 단계 선택, 진도 수정, 완료
- 음성 연습: 세션 생성, 녹음·재녹음, 업로드 URL 발급, 업로드, 녹음 등록·음질 검사·선택·삭제, 분석·상태 폴링·재시도, 결과·구간·AI 코칭·유사/다음 콘텐츠, 이탈 취소
- 마이페이지: 통계, 점수 추이, 강점·약점, 약점 추천, 기록 목록·필터·페이지네이션, 기록 상세·재생·삭제
- 설정: 닉네임, 학습 목표 수정, 로그아웃, 회원 탈퇴
- 공통 예외: 404, 전역 오류, 요청 실패·빈 목록·로딩 상태, `/practice/custom` 대체 이동

## 라우트 명칭 보정

- FigJam의 `Accent Test`는 실제 `/class/intonation`과 의미가 다르므로 `억양 클래스`로 명확히 해야 합니다.
- `Pronounce Class`는 실제 `/class/pronunciation`에 맞춰 `발음 클래스`로 통일해야 합니다.
- MyPage 아래 라벨 없는 노드는 실제 `/mypage/history`라면 `학습 기록`으로 표시해야 합니다.
- `/mypage/history/[sessionId]`, `/practice/[id]`, OAuth callback, 오류/복구 분기는 별도 노드가 필요합니다.
