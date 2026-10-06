# 2026-10-06 23:20–23:30 KST 점수·피드백 누락 조사

운영 읽기 관측: 2026-10-06 23:30 이후. 신규 추론·서비스 재시작·설정 변경은 수행하지 않았다.

## 해당 요청

- RunPod job: `045c4698-070f-403c-a306-e1c66b41acf8`
- execution: `415fada4-0598-47d6-b992-6a12a62e7aa6`
- 연습문: 한국은행은 오늘 기준금리를 동결한다고 발표했습니다.
- 결과 공개: 23:25:18 KST. `decision=ACCEPT`, `score.validity=UNSCORABLE`, `overallScore=null`, `reason=SCORING_FAILED`.
- bridge: `dispatchAttempts=1`, `adapterStatus=READY`, `generationStatus=SCHEMA_AND_STRUCTURAL_SEMANTICS_VALID`, `fallbackReason=null`, `scoring.status=UNSCORABLE`, `items=[]`.
- GPT 단계 7.67초, core 단계 19.65초. 미호출이나 전송 실패가 아니라 채점 불가·빈 항목으로 정상 파싱된 응답이다. 제공자 원문 응답은 이번 조사에서 별도로 확보하지 않았으므로 모델 내부 판단 이유까지 확정하지 않는다.

## 원인

운영 RunPod는 `canonical-seungun-gpt-20261006-v1`을 실행한다. core manifest `20acb7275aa06d0be4aca1a567420ea603c0eec084e50c651c96501903034f1b`, LLM manifest `6a3bf7c872e718086cb9add4d48412c825188310cdc9eb394089301dd784ff57`이다. 새 `canonical-seungun-gop-gpt-20261006-v1`이 아니다.

원본 CORE에 `phonemeAssessment`가 없다. 이전 프롬프트에는 95/80/60/40% 경계가 남아 있고 근거 부족 시 UNSCORABLE을 요구한다. 피드백은 COACHING_VIEW 후보에만 작성하며 후보가 없으면 items=[]를 요구한다. 해당 요청의 evaluatedConsonantPositions는 35, included candidates는 0이고 presentationStateCounts는 NO_FEEDBACK 23 / INSUFFICIENT_EVIDENCE 11 / AMBIGUOUS_CONTRAST 1이다. 별도의 자유 총평 필드도 이전 출력 계약에 없다. 이 조합이 관측된 빈 결과와 일치한다.

AI PR #29는 22:57:42 KST, FE PR #63은 22:58:44 KST, BE PR #112는 23:00:30 KST 병합됐으나 이 요청은 새 RunPod 산출물을 사용하지 않았다. AWS 배포 프로필도 AI `ef789373aac654ce40ac504104478aa3b8f64c24`와 이전 manifest를 가리킨다. Backend 프로세스 시작 시각은 17:07:01 KST다. FE 원격 main은 `dc261398e98ffca930ee4c20ffe88242f525d06d`이며 GOP/feedback 계약은 dev에만 있다. Git 병합과 실제 배포는 별개다.

## AWS 교차 확인

nginx access log에서 해당 job link는 23:25:19/25/30 KST HTTP 200, 내부 history 수신은 23:25:20/25 KST HTTP 202다. `direct_analysis_history` 읽기 전용 조회 결과 created_at은 23:25:20.157293, archived_at은 23:25:24.545614 KST이며 점수 null과 빈 items가 RunPod와 일치한다. AWS 저장 과정에서 점수나 피드백이 사라진 흔적은 없다. 23:24:27 refresh-token 경고는 있으나 이 job의 이력 반영은 성공했다.

근거 위치: RunPod `/workspace/intelligentai/direct-spool/<job>/result.json`, `artifacts/CORE.json`, `artifacts/BRIDGE_RESULT.json`, `artifacts/SELECTION_PROJECTION.json`, `worker-complete.json`; 운영 LLM의 `contracts/llm/llm_system_prompt.txt`; AWS journal/nginx access log 및 해당 job의 DB 행. 비밀값·다른 사용자 자료는 포함하지 않는다.

## UI 복원

별도 Direct 결과 카드·후보 UI를 제거하고 기존 AnalysisView를 재사용한다. 기존 총평, 연습 문장, 내 녹음/가이드 재생, 점수 상세 진입, 완료 버튼을 유지한다. 9항목 점수 계약은 보존한다. 새 feedback은 기존 총평에 바인딩하며 문장별 판정은 추측하지 않는다. 기존 main의 사용자 UI 복원 및 16kHz PCM 변경도 dev로 통합해 후속 병합이 이를 되돌리지 않게 한다.

검증은 TypeScript 컴파일과 diff/포맷 정적 확인만 수행한다. 브라우저 QA·자동 회귀 테스트·운영 배포는 수행하지 않는다. 후속 운영 작업은 새 core/LLM 패키지 설치와 활성화, AWS 배포 프로필/검증기 정합성 확인, FE main 반영이 필요하다. UI 복원만으로 기존 UNSCORABLE 결과가 점수로 바뀌지는 않는다.
