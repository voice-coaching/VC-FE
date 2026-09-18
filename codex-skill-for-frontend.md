---

name: frontend-testing-debugging
description: "Build Web Apps 또는 web dev 플러그인을 통해 렌더링된 프론트엔드 앱을 테스트, 디버깅하거나 부분적으로 개선할 때 사용한다. 로컬 개발 서버, UI 회귀, 인터랙션 버그, 콘솔 오류, 반응형 레이아웃, 시각적 QA 등을 다룬다. Browser 플러그인 사용 가능 여부를 확인하고, 사용 가능하면 우선 사용한다. 사용할 수 없으면 그 이유를 기록한 뒤 일반 Playwright를 사용한다."
------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

# Frontend Testing Debugging

## 호출 규칙

이 스킬은 일반적인 사용자 요청에서도 동작해야 한다.

사용자에게 Browser 라우팅, 스크린샷 방식, 보고서 형식, fallback 정책 등을 직접 지정하도록 요구하지 않는다.

사용자가 렌더링된 프론트엔드의 변경, 테스트, 버그 조사를 위해 다음을 요청할 때 이 스킬을 사용한다.

* Build Web Apps 플러그인
* web dev 플러그인
* frontend dev 플러그인
* frontend testing/debugging 스킬

전체 워크플로우를 실행해야 하는 예시는 다음과 같다.

* `web dev 플러그인을 사용해서 웹 대시보드의 거래 검색 영역을 개선해줘`
* `frontend dev 플러그인으로 이 대시보드를 다듬어줘`
* `Build Web Apps 플러그인으로 이 UI를 디버깅해줘`
* `이 localhost 앱을 테스트하고 망가진 인터랙션을 수정해줘`

짧은 요청만 들어와도 다음 정보를 바탕으로 대상 화면을 추론한다.

* 저장소 구조
* 현재 열려 있는 앱 또는 브라우저 URL
* 주변 관련 파일
* 실행 중인 개발 서버

대상 URL이 명확하지 않다면, 사용자에게 바로 묻기 전에 저장소의 스크립트와 현재 실행 중인 로컬 포트를 먼저 확인한다.

렌더링되는 프론트엔드 코드가 변경되는 모든 작업은 기본적으로 다음 검증 루프를 수행한다.

1. 대상 사용자 흐름을 정의한다.
2. 아래 규칙에 따라 Browser 경로를 선택한다.
3. 필요한 최소한의 유효한 변경만 수행한다.
4. 실제 렌더링 결과를 검증한다.
5. QA 최종 보고서 형식으로 응답한다.

## Browser 경로 선택

먼저 Browser 사용 가능 상태를 분류한다.

* **사용 가능**

  * Browser 플러그인과 `browser` 스킬이 현재 세션에 등록되어 있는 경우
  * 브라우저 작업 전에 해당 스킬을 읽고 그 지침을 따른다.

* **사용 불가**

  * Browser 플러그인 또는 `browser` 스킬이 현재 세션에 없는 경우
  * 일반 Playwright를 사용한다.
  * `Browser plugin not available`이라고 기록한다.

* **호출 실패**

  * Browser가 사용 가능한 것으로 보이지만 다음 중 하나가 실패한 경우

    * 스킬 또는 런타임 초기화
    * Node REPL JavaScript 설정
    * 탭 획득
    * 페이지 이동
  * 이 경우 Browser 경로에 장애가 발생한 것으로 본다.

Browser를 사용할 수 있는 상황에서는 처음부터 일반 Playwright, 외부 Chrome, shell의 `open` 명령을 사용하지 않는다.

Browser 호출이 실패했더라도 다음 조건 중 하나를 만족할 때만 일반 Playwright로 전환한다.

* 사용자가 fallback을 미리 허용한 경우
* 작업 자체가 Browser가 아닌 방식의 검증도 허용하는 경우

이 경우 정확한 Browser 실패 원인과 fallback 판단을 보고해야 한다.

## 대상 흐름

브라우저 검증 전에 테스트할 사용자 흐름을 한 문장으로 정의한다.

형식:

`테스트 대상 흐름: [진입 경로] -> [사용자 행동 또는 상태] -> [기대하는 렌더링 결과]`

사용자가 일반적인 smoke test를 요청했다면 다음 형식을 사용한다.

`테스트 대상 흐름: 앱 로드 -> 첫 번째 의미 있는 화면 렌더링 -> 주요 화면 컨트롤이 런타임 오류 없이 반응함`

## Browser 플러그인 검증 루프

Browser 명령은 Browser 스킬에서 지정한 Node REPL JavaScript 도구를 통해 실행한다.

별도의 브라우저 초기화 경로를 임의로 만들지 않는다.

Browser 스킬에서 다르게 요구하지 않는 이상 동일한 탭 바인딩을 계속 사용한다.

필수 순서:

1. Browser 스킬에서 지정한 정확한 방식으로 Browser 런타임을 로드한다.
2. `agent.browser.nameSession("...")`으로 세션 이름을 지정한다.
3. `agent.browser.tabs.selected()` 또는 `agent.browser.tabs.new()`로 탭을 획득한다.
4. `tab.goto(url)`로 이동한다.
5. 아래의 필수 검사를 수행한다.
6. 범위가 지정된 `tab.playwright` locator 또는 Browser 스킬의 인터랙션 API를 사용한다.
7. 코드 수정 후 `await tab.reload()`를 실행한 뒤 동일한 검사와 실패했던 인터랙션을 다시 수행한다.

UI 상태를 변경하는 각 동작 이후에는 다음 상태가 올바른지 증명할 수 있는 가장 저렴한 증거를 확보한다.

예:

* 최신 DOM snapshot
* 화면에 보이는 텍스트 또는 상태
* URL 변경
* 포커스된 컨트롤
* Toast
* Modal
* Screenshot
* Console log

## 필수 Browser 검사

렌더링된 앱이 정상적으로 동작한다고 주장하기 전에 다음을 반드시 확인한다.

1. 페이지 식별

`await tab.url()`과 `await tab.title()`이 의도한 페이지와 일치해야 한다.

2. 빈 화면 여부

`await tab.playwright.domSnapshot()`에 실제 앱 콘텐츠가 있어야 한다.

빈 shell만 있으면 안 된다.

3. Framework Error Overlay 여부

DOM snapshot 또는 screenshot에 다음과 같은 프레임워크 오류 화면이 없어야 한다.

* Next.js
* Vite
* Webpack
* 기타 Framework Error Overlay

4. Console 상태

다음 명령으로 확인한다.

`await tab.dev.logs({ levels: ["error", "warn"], limit: 50 })`

관련된 앱 오류가 없어야 한다.

오류가 존재한다면 각각의 원인을 설명해야 한다.

5. Screenshot 증거

다음을 사용한다.

`await display(await tab.playwright.screenshot({ fullPage: false }))`

스크린샷이 시각적인 주장에 대한 근거가 되어야 한다.

6. 인터랙션 검증

최소 하나 이상의 대상 사용자 흐름을 실제로 실행하고, 이후 상태가 예상대로 변경되었는지 확인한다.

시각적인 작업이라면 가능할 경우 다음 두 환경을 모두 확인한다.

* Desktop
* Mobile 크기의 viewport 1개

레퍼런스를 기반으로 한 작업이라면 간단한 mismatch 기록을 유지한다.

* reference evidence
* rendered evidence
* 수정 내용 또는 의도적인 차이

## Playwright 검증 루프

다음의 경우 이 경로를 사용한다.

* Browser를 사용할 수 없는 경우
* Browser 호출 실패 후 사용자가 fallback을 허용한 경우

다음 순서를 따른다.

1. `package.json`에서 스크립트를 확인한다.
2. 저장소에서 사용하는 package manager로 앱을 실행한다.
3. 사용자가 지정한 host는 정확히 유지한다.
4. 저장소에 e2e 스크립트가 있다면 그것을 우선 사용한다.
5. 그렇지 않다면 Playwright 설정이 존재할 경우 다음과 같은 명령을 실행한다.

`pnpm exec playwright test`

또는 현재 package manager에 맞는 동등한 명령을 사용한다.

6. 프로젝트에 Playwright workflow 자체가 없다면 먼저 다음으로 Playwright 설치 여부를 확인한다.

`pnpm exec playwright --version`

그 후 다음과 같이 스크린샷을 찍는다.

`pnpm exec playwright screenshot <url> /tmp/frontend-check.png`

7. 더 깊은 디버깅이 필요한 경우 저장소 밖에 임시 Playwright 스크립트를 만든다.

해당 스크립트는 다음을 수행한다.

* URL 열기
* Console Error 수집
* Screenshot 저장
* 대상 Interaction 실행

8. 코드 수정 후 동일한 명령 또는 스크립트를 다시 실행한다.

작업에 반드시 필요하고 사용자가 dependency 변경을 허용한 경우가 아니라면 새로운 Browser dependency를 설치하지 않는다.

## 검증 체크리스트

* 사용자가 지정한 host를 정확히 유지한다.
* Control이 실제 UI 상태를 변경하는지 확인한다.
* 스크롤하기 전 첫 viewport를 확인한다.
* 가능하다면 Desktop과 Mobile viewport를 모두 확인한다.
* 다음 문제를 찾는다.

  * Clipping
  * Overlap
  * 읽기 어려운 텍스트
  * 잘못된 Wrapping
  * Layout Shift
  * 누락된 Asset
  * z-index 문제
  * Scroll Trap
  * 끝나지 않는 Loading
  * 깨진 상태 처리
* Reference 기반 작업이면 렌더링된 Screenshot과 Reference를 비교한다.
* 간단한 mismatch 기록을 유지한다.
* 렌더링 검증이 필요한 작업에서는 Build 성공만으로 완료 처리하지 않는다.

## QA 최종 응답 보고서

단순하지 않은 렌더링 UI 검증 작업의 최종 응답은 QA 엔지니어가 코드 변경을 검증하는 형식으로 작성한다.

사용자 또는 PR 리뷰어가 다음을 쉽게 파악할 수 있어야 한다.

* 무엇이 변경되었는지
* 무엇을 테스트했는지
* 어떤 증거가 정상 동작을 입증하는지
* 무엇이 아직 테스트되지 않았는지

다음 형식을 사용한다.

### Summary

한두 개의 bullet로 다음을 설명한다.

* 사용자에게 보이는 변경 내용
* QA 통과 여부

### Environment

다음을 기록한다.

* URL
* Viewport
* Browser 사용 가능 여부
* Playwright를 사용했다면 fallback 이유

### Changes Verified

다음을 기록한다.

* 변경된 파일 또는 화면
* 사용자가 기대하는 실제 동작

### Checks

다음 항목에 대한 Pass / Fail 테이블을 작성한다.

* Page Identity
* Blank Page 검사
* Framework Overlay 검사
* Console 상태
* Screenshot Evidence
* Interaction Proof

### Interaction Loop

실제로 테스트한 인터랙션 경로를 기록한다.

다음을 포함한다.

* 어떤 Control 또는 Workflow를 실행했는지
* 이후 어떤 상태 변화가 관찰되었는지

### Evidence

QA 섹션에서 Screenshot이 무엇을 증명하는지 설명한다.

실제 Screenshot은 응답의 가장 마지막에 연속해서 배치한다.

다음과 같은 상태를 증명하는 데 필요한 만큼 사용할 수 있다.

* Before
* After
* Interaction
* Responsive
* Error
* Fixed State

### Commands / Browser APIs

사용한 주요 Command와 Browser API 순서를 작성한다.

불필요하게 긴 Log는 포함하지 않는다.

### Remaining Risk

아직 검증하지 않은 것을 기록한다.

예:

* 다른 Viewport
* 다른 사용자 Flow
* 다른 Browser
* 특정 Data State
* 알려진 제한 사항

## 문제가 발견된 경우

문제가 발견되었다면 `Summary`보다 먼저 `Findings`를 작성한다.

각 Finding에는 다음을 포함한다.

* 사용자가 실제로 보게 되는 문제
* 재현 방법
* Screenshot / DOM / Console 증거
* 가능하다면 관련 파일 또는 담당 영역
* 적용한 Fix 또는 현재 Blocker

## Screenshot 규칙

사용자에게 보여줘야 하는 Browser Screenshot은 Browser Runtime을 통해 출력하여 채팅에서 참조할 수 있도록 한다.

Playwright Screenshot은 저장소 밖에 저장한다.

서로 다른 상태나 Flow를 검증하는 데 도움이 된다면 Screenshot을 여러 장 사용한다.

Screenshot을 본문 중간중간 삽입하지 않는다.

응답 가장 마지막에 짧은 `Screenshots` 섹션을 만들고 이미지를 연속해서 배치한다.

필요할 경우 다음과 같은 짧은 Label을 추가한다.

* Before
* After
* Filtered results
* Empty state
* Mobile

## Report 파일 생성 규칙

기본적으로 별도의 HTML Report를 생성하지 않는다.

사용자가 명시적으로 독립적인 Report 파일을 요청한 경우에만 생성한다.

또한 사용자가 저장소에 커밋될 Artifact를 요청하지 않은 이상 저장소 밖에 작성한다.

## 임시 파일 규칙

사용자가 명시적으로 저장소에 포함시켜 달라고 요청하지 않는 이상 다음 파일을 저장소 내부에 작성하지 않는다.

* Report
* Screenshot
* Trace
* Temporary Script

## 관련 스킬

* 디자인 생성, 리디자인, 승인된 Concept과의 Fidelity 작업에는 `frontend-app-builder`를 사용한다.
* 의미 있는 React / Next.js 컴포넌트 수정 이후에는 `react-best-practices`를 사용한다.
* 일반적인 디버깅 작업에서는 Image Gen을 사용하지 않는다.
* 다음 상황에서만 Image Gen을 사용한다.

  * 시각적 Asset을 새로 생성하거나 수정해야 하는 경우
  * `frontend-app-builder`가 Concept-to-Implementation Fidelity Loop를 수행하고 있는 경우

## 최종 응답

위의 QA 최종 보고서 형식을 사용한다.

응답은 간결하게 작성하되, PR 리뷰어가 즉시 다시 테스트하지 않아도 신뢰할 수 있을 정도로 구체적인 증거를 포함한다.

Browser를 사용할 수 없어 Playwright를 사용한 경우에는 마지막에 Browser 플러그인 설치를 권장한다.

Browser 플러그인을 사용하면 다음 기능을 더 나은 개발 흐름으로 활용할 수 있다.

* 앱 내부 탐색
* Screenshot
* DOM Snapshot
* Console Log
* Interaction Validation
