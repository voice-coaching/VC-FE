# 컴포넌트 및 모듈 문서 - VC-FE

## 관리자 클래스 편집

`CoursesPanel`은 실제 클래스별 목록, `CourseDetail`/`CourseEditor`는 같은 페이지의 문장 편집 상태와 UI를 맡는다. `course-services.ts`는 문장 배열·클래스 소속·기대 버전을 검증하고 기존 `adminApi` adapter로 저장한다. 변경 후 캐시 갱신·권한 변경·중복 실행 차단은 기존 관리자 hooks를 사용한다. [계약과 배포 순서](../admin-class-contents.md).

## 브라우저 영상 직접 업로드

`LipPractice`는 촬영과 화면 조립, `BrowserVideoConsent`는 현재 동의 입력을 맡는다.
`BrowserVideoPracticeAttempt`는 같은 촬영본의 UUID·권한 문맥·업로드/조회 재개를 소유하고,
`video-upload-authorizations.ts`와 `BrowserVideoClient`가 각각 Backend 권한/AI HTTP 및 DTO 검증을 담당한다.
`browserVideoPresentation`은 공개 AI DTO를 화면 모델로 옮긴다. `BrowserVideoAnalysisResult`는 기존 AnalysisView와
`LipScoreSummary`로 요약 입술점수를 표시하며 Backend canonical wrapper·정수 ID를 생성하지 않는다.
요약 전용 score DTO는 숫자/null과 의미 문자열을 읽고 전체 결과용 canonical 점수 조건을 재사용하지 않는다.
영상 화면은 `AnalysisView.plainFeedback` → `AnalysisSummary.plainText`로 서버 피드백을
공백·기호·줄바꿈 포함 일반 텍스트로 표시한다. 기존 음성 총평의 표시 방식은 유지한다.

## 홈 관리자 공지

`HomePopup`은 `/home`에서만 마운트하고 기존 Dialog로 제목·본문·확인/이동 버튼을 렌더링한다.
HTTP와 외부 DTO 검증·허용 목적지 변환은 `lib/home-popup.ts`에 둔다. 기존 홈 카드·헤더 CSS는 수정하지 않는다.

`score-details.ts`는 외부 표시 점수의 구조와 화면 변환을 맡고, `AnalysisScoreDetails`는 전달된 값을 렌더링한다.
HTTP 호출·추론·합산 로직은 UI에 추가하지 않는다. canonical/Direct adapter와 AnalysisView에서 공통으로 사용한다.

프로젝트 단위를 어떻게 분리하고 재사용하는지 기록한다.

## 분리 기준
- 공통 단위:
- 기능 전용 단위:
- Service/Application 단위:
- Repository/Adapter 단위:
- UI 또는 Presentation 단위:

## 계약 규칙
- Props 또는 입력 모델 규칙:
- 출력/result 모델 규칙:
- 재사용 기준:
- 소유 경계:

## 프로필 메모

### FastAPI
- APIRouter는 라우팅과 의존성 연결만 담당한다.
- Service가 FastAPI Response, Depends, Request에 직접 의존하지 않게 한다.
- Repository는 SQLAlchemy, SQLModel 등 실제 저장소 API를 감싸는 경계로 둔다.
- 예외는 도메인/서비스 예외로 먼저 표현하고 controller에서 HTTP 상태로 변환한다.
- 배경 작업, 외부 호출, 긴 작업은 service 하위의 명시적 adapter/client로 분리한다.
