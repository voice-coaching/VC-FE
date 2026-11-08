# 클래스 안에서 문장 관리

`/admin/contents`의 상단 클래스 목록은 실제 클래스 ID를 기준으로 한 행씩 표시한다. 개별 CLASS_PRACTICE 콘텐츠는 일반 콘텐츠 목록에서 서버 필터 `excludeClassPractice=true`로 제외한다. 제목 접두사나 현재 페이지에 담긴 일부 문장만 보고 클래스를 추측하지 않는다.

- 클래스의 `설정` → `/admin/courses/{id}`. 제목/소개/유형/난이도/공개 상태/예상 시간과 연결 문장 전체를 한 페이지에서 수정한다.
- 각 문장은 제목, 원문, 안내, 학습 초점, 예상 시간을 편집한다. 문장 추가·삭제는 로컬 폼에만 반영되며 하단 저장 버튼에서 배열 전체를 저장한다.
- 문장 5개가 있으면 같은 페이지에 5개가 표시된다. 1~10개를 지원하며 마지막 문장까지 삭제해 빈 클래스로 저장하지 않는다.
- `클래스 추가` → `/admin/courses/new`. 일반 콘텐츠 작성에서 클래스 문장 유형을 선택해도 이 작성 페이지로 이동한다.
- 저장 사유는 필수다. 처리 중 중복 저장을 막고, 409/응답 유실에서는 자동 재전송하지 않는다. 입력은 유지되며 사용자가 `최신 상태 조회`로 서버 반영 여부를 확인한다.
- 성공 후 클래스/일반 콘텐츠/감사 목록을 갱신한다. 기존 관리 UI 컴포넌트·접근 검사·디자인을 사용한다.

## API 의존성

백엔드 클래스 관리 API를 먼저 배포해야 한다. 없는 API를 임의 데이터로 대체하지 않는다.

- `GET /api/admin/courses?keyword=&page=0&size=20`
- `GET /api/admin/courses/{id}`
- `POST /api/admin/courses`: `{course,reason}`
- `PATCH /api/admin/courses/{id}`: `{version,course,reason}`

course: `{courseType,title,description,difficulty,status,estimatedMinutes,sentences}`.
sentences: `{contentId,contentVersion,title,text,hint,focus,estimatedSeconds}[]`.
새 문장은 contentId/contentVersion=null, 기존 문장은 응답 값을 유지한다. 응답은 course 필드에 `id,version,updatedAt`을 더한 상세다. 목록은 기존 관리자 Page envelope를 사용한다.

저장 시 새 예문 개정을 만들며 기존 학습이 참조하는 콘텐츠/예문은 보존한다. 삭제는 새 구성에서 문장을 제외하는 동작이다. 수정한 원문의 TTS는 새 콘텐츠로 조회하며 AI 분석 스키마는 변경하지 않는다. 신규 Flyway는 필요하지 않다.

## 검증

관리자 관련 서비스 테스트 38개, 새 브라우저 시나리오 5개, TypeScript/변경 파일 ESLint와 webpack 프로덕션 빌드가 통과했다. 백엔드 관리자 관련 통합 테스트 43개는 별도 백엔드 PR에서 검증했다.

- `node --import tsx --test src/features/admin/course-services.test.ts src/features/admin/services.test.ts src/features/admin/cache.test.ts src/features/admin/title-exam-policies.test.ts`
- localhost에서 Next 실행 후 `node scripts/verify-admin-courses.mjs`: 한 클래스/5문장 표시, 수정·삭제·추가를 한 번에 저장, 새 클래스 5문장 등록, 409 입력 보존, 모바일 넘침, 관리자 권한 차단.
- TypeScript, 변경 파일 ESLint, webpack 프로덕션 빌드.

브라우저 테스트는 API 대역을 사용하며 운영 콘텐츠를 수정하지 않는다. 백엔드의 실제 HTTP/JPA/진행 중 학습 개정 보존은 별도 통합 테스트로 확인한다.
