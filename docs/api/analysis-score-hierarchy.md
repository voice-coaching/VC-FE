# 음소별 계층형 평가 연동

BE `scoreHierarchy`가 있으면 11대분류/49소분류를 표시하고 없으면 기존 scoreBreakdown을 표시한다. 소분류는 각100점 진단값이며 총점에 더하지 않는다. 부모 점수는 기존 배점 기준이다.

SCORED는 실제0점 포함, NOT_APPLICABLE은 문장에 없음, NOT_PROVIDED는 영상없음, UNAVAILABLE은 계측불가, NOT_VALIDATED는 기준미검증이다. 영상 관측값은 선택 구간에만 해당하며 점수가 아니다. 미검증 관측에 막대 점수나 평균을 만들지 않는다.

대분류 및 소분류를 클릭/Enter/Space로 펼쳐 설명을 확인한다. 항목에 마우스를 올리면 title 설명도 제공한다. `attention`은 CLOVA가 선택한 우선 확인 음성 항목이며 새로운 오류 판정이나 영상 교정 지시가 아니다.

기존 결과에는 음소별 원시 근거가 없어 scoreHierarchy=null일 수 있다. 새 worker v3와 BE 호환 배포 후 생성한 결과부터 사용할 수 있다. 실제 음성 추론·브라우저 E2E는 이 변경의 로컬 빌드로 검증한 것이 아니다.
