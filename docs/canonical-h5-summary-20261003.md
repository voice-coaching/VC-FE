# Canonical H5 총평 표시

H5 서버는 후보당 action을 한 문장·UTF-16 140 이하로 검증하며 최대 3개 후보를 유지한다. 기존 canonical 표시 adapter는 설명·행동·연습·자가 확인과 모델 관측 안내를 모두 총평에 붙여 이 제한이 화면에서 사라졌다.

`src/lib/canonical-presentation.ts`에서 총평을 action만 원래 순서대로 줄바꿈하도록 수정했다. 화면 구성·v4 API·완료 조건은 유지한다. 설명·연습·자가 확인·scoped ID·MFA 근거는 `canonical` 원본 객체에 보존하며 잘라내거나 재생성하지 않는다.

이 표시 규칙은 기존 S7 결과 조회에도 적용되지만 과거 action의 길이까지 소급 수정하지 않는다. 실패·REJECT·INCONCLUSIVE·허용 후보 없음은 기존 안내를 유지한다.

`tsc --noEmit --incremental false` 컴파일 통과. 동일 package-lock의 기존 의존 설치본을 사용했다. 브라우저·자동 회귀·실제 분석 QA는 미수행이다. dev PR 인계이며 운영 FE 배포는 별도다.
