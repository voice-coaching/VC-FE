# GOP/GPT 점수와 총평 표시

`phone-rubric-gop-ctc-af-sd-v1`을 수용하고 기존과 같은 9개 배점으로 GPT가 반환한 단계를 표시한다. FE는 음향 근거로 점수를 다시 계산하거나 overallScore를 바꾸지 않는다.

직접 RunPod 결과와 AWS 이력 응답의 `coaching.feedback`을 표시한다. 새 응답은 교정 후보 목록이 비어 있고 `selection=null`이어도 총평을 표시한다. UNSCORABLE은 0점으로 바꾸지 않고 피드백을 계속 보여준다. 구형 이력의 후보별 화면은 유지한다.

이 변경의 PR 대상은 dev다. BE develop과 AI main의 계약 변경에 앞서 호환 FE를 배포할 수 있다. 이 PR 생성 작업에서는 병합·Vercel 배포·브라우저 QA를 수행하지 않는다. 확인 범위는 TypeScript 컴파일과 변경 파일 정적 확인이다.
