# 관리자 승급 시험 관리

최신 main `f26b0c2`에서 분기했다. 일반 사용자 화면은 수정하지 않고 기존 관리자 메뉴에 ‘승급 시험 관리’를 추가한다.

## 이용 순서

1. 학습 콘텐츠에서 유형 ‘문장’, 분류 ‘승급 심사’로 문제를 등록하고 공개한다.
2. 승급 시험 관리에서 목표 칭호의 ‘설정 변경’을 누르면 `/admin/title-exams/{targetRank}` 전용 편집 페이지로 이동한다. 직접 접속·새로고침 시에도 정책을 조회해 해당 시험을 편집한다. 지원하지 않는 칭호는 404로 처리한다.
3. 문제 제목으로 검색하고 문장 원문을 확인해 선택한다.
4. 합격 점수(1~100 정수)와 작업 사유를 입력해 저장한다.
5. 새 설정은 새로 생성하는 시험부터 적용된다. 기존 응시 횟수 정책은 변경하지 않는다.

## API 연동

- GET `/api/admin/title-exam-policies`: 칭호 순서의 정책·문제 미리보기·사용 가능 상태.
- GET `/api/admin/contents?type=SENTENCE&category=TITLE_EXAM&status=PUBLISHED&keyword=...&page=0&size=10`: 선택 후보.
- PATCH `/api/admin/title-exam-policies/{targetRank}`: practiceContentId, contentVersion, passingScore, version, reason.

`version`은 편집을 시작할 때 고정한 시험 설정 버전이다. `contentVersion`은 선택 문장의 버전이다.
백그라운드 조회로 입력이나 버전을 몰래 덮어쓰지 않는다. 409는 자동 재시도하지 않고 입력을 유지한다.
취소·닫기 후 목록을 재조회하고, 새로 편집할 때 최신 버전을 사용한다.
취소·닫기는 `/admin/title-exams` 목록으로 돌아가며 브라우저 뒤로 가기도 지원한다.
저장 응답의 칭호·문제·점수·버전 일치를 확인한다. 저장 후 정책과 작업 이력을 무효화한다.
권한 오류는 기존 관리자 접근 차단·캐시 정리 흐름을 따른다. 누락된 문제나 빈 후보에서 임의 ID를 생성하지 않는다.

정책에 연결되거나 진행 중인 시험에 쓰이는 문제의 원문 변경·숨김·삭제는 백엔드가 거부한다.
`ADMIN_TITLE_EXAM_CONTENT_IN_USE`는 새 문장 등록·정책 교체·진행 시험 종료 후 정리하라는 한글 안내로 표시한다.

## 검증

```bash
node --import tsx --test src/features/admin/title-exam-policies.test.ts src/features/admin/services.test.ts src/features/admin/cache.test.ts
ADMIN_TEST_BASE_URL=http://127.0.0.1:3120 node scripts/verify-admin-title-exams.mjs
```

브라우저 검증은 localhost에서만 실행하며 모든 API를 가짜 응답으로 가로챈다.
메뉴·문장 선택/미리보기·정확한 버전 저장·충돌 시 입력 유지·미연결/빈 목록·권한 거부를 확인한다.
모바일 400×811 화면에서 네 칭호를 표시하고 첫 번째·마지막 카드의 전용 편집 페이지 이동과 제목 노출,
편집 영역 포커스·새로고침·뒤로 가기·취소 후 목록 복귀·잘못된 칭호 404를 확인한다. 기존 한 카드·데스크톱 검증만으로는
목록 아래에 편집 폼이 숨는 문제를 발견하지 못하므로 DOM 존재뿐 아니라 화면 좌표를 검증한다.
서버 실제 동작은 별도 백엔드 통합 및 PostgreSQL 검증 대상이다. V67 포함 백엔드를 먼저 배포해야 한다.
