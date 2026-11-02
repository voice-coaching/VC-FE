# 결과 조회 실패와 최근 72시간 PR 감사 — 2026-11-02

## 범위와 결론

감사 창은 2026-10-30 06:55:00 ~ 2026-11-02 06:55:45 UTC다. 해당 창의 FE 병합 PR
19개와 통합 범위의 중복 제거 commit 42개를 확인했다. PR 작성자·병합 SHA·변경 파일
목록·commit 기록을 조사하고, 녹음/요청/결과 계약 관련 diff와 양쪽 현행 소스를 대조했다.
뉴스·디자인·기능 전체의 동작 QA를 수행했다는 뜻은 아니다.

조회 clone이 shallow여서 처음에는 11월 1일 merge가 검증 코드를 만든 것처럼 blame에
표시됐다. 전체 이력을 가져와 그 오판을 제거했다. 결과 parser의 마지막 내용 변경은
10월 7일이며 이번 72시간 FE PR에서 parser는 변경되지 않았다.

이번 원인을 특정 최근 FE 작성자의 결함으로 단정할 근거는 없다. 직접 충돌을 만든 변경은
[Backend PR #165](https://github.com/voice-coaching/VC-BE/pull/165)의
`e597761266d36c9373a4e8d1c38fa8417f8b3118`이다.
GitHub/commit 작성자 기록은 `intelligent04`, commit 시각은 2026-11-02 01:10:50 UTC,
병합 시각은 03:27:45 UTC다. 제목은 `refactor: remove backend admission security and integrity guards`다.

충돌하는 FE 과거 전제는 [FE PR #33](https://github.com/voice-coaching/VC-FE/pull/33)의
`c48b2a6ccabdec006d682c6af2fe0b0330fd7265`에서 시작됐다. Git author는 `이총명`,
PR 작성자는 `intelligent04`, 병합 시각은 2026-10-02 04:19:50 UTC다.
이는 감사 창 밖의 과거 계약 구현이며 당시부터 잘못됐다는 판정이 아니다.

PR 계정과 git author, merge 작성자를 구분한다. `Codex` author인 여러 최근 수정은
이 대화에서 에이전트가 작성한 기록이다. 계정 하나가 PR을 생성했다는 사실만으로
실제 작업 지시자나 키보드 사용자를 판정하지 않는다. 앞선 #84/#86은 입력 검사 두 곳을
고쳤지만 결과 조회의 전체 계약 변경을 함께 대조하지 못한 대응 범위의 누락이 있었다.

## 동일 Backend commit의 계약 변경과 FE 충돌

| Backend 변경 | 기존 FE 전제 | 영향 |
|---|---|---|
| MIME을 audio/*, video/*로 응답 | 허용 목록 문자열 완전 일치 | WAV 거부; FE #84/6cf1ddd에서 보정 |
| 동의 required=false, revision=null | revision 항상 필수 | 분석 제출 차단; FE #86/f88fc73에서 보정 |
| action 네 개 모두 true, 사유 배열 모두 빈 배열 | canRegenerate=false, regenerate 사유 최소 1개 | pending 응답부터 projection parse 실패 |
| permission=true를 결과 상태와 무관하게 반환 | canRetry는 FAILED만, canComplete는 성공 완료만이라는 read-time 단정 | 파싱 단계에서 전체 결과 거부 |
| root rawResult 추가 | root strict object | 완료 결과까지 추가 필드 때문에 거부 |
| persistenceStatus=AVAILABLE | NONE/SAVING/SAVED/RETRYING만 허용 | 완료 결과 거부 |
| binding 없으면 pending requestId/executionId=null | UUID가 즉시 배정됐다는 전제 | 정상 실행 배정 대기도 형식 오류로 표시 |
| FAILED document가 없으면 failure=null 가능 | FAILED면 failure 항상 존재 | 실패 상태 자체를 형식 오류로 오인 |

이번 사용자의 특정 analysis 응답 원문은 로그인 자격이 없어 읽지 않았다. 위 판정은
실제 capability 응답, 오류 발생 지점, 해당 commit diff 및 현재 producer/consumer의
구체적 모순에 근거한다. 모든 실행 실패 원인을 확인했다거나 실제 분석 성공을
입증했다는 뜻은 아니다.

## 선택적 무효화 commit의 범위

이력을 rewrite하거나 최근 PR 전체를 git revert하지 않는다. n개 파일 녹음·백그라운드
제출·일시정지·로딩 복원과 MIME/선택 동의 수정은 사용자 요구이므로 보존한다.
과거 client의 서버 action 정책 단정과 추가 envelope 필드 거부만 새 commit으로 무효화한다.

- action 값은 boolean으로 읽고 사유 배열이 비어 있어도 정상 응답을 버리지 않는다.
- root 추가 필드는 parse 결과에서 제거한다. rawResult를 화면에 표시하거나 private callback을
  public 결과로 변환하지 않는다. canonical 내부·점수·근거 schema는 유지한다.
- AVAILABLE을 별도 상태로 수용하며 SAVED로 조작하지 않는다.
- 아직 UUID가 없는 pending은 analysisId/recordingId/profile을 확인한 뒤 기존 polling의
  retry 가능한 대기로 분류한다. UUID를 만들지 않으며 이미 pin된 시도의 UUID가 없어지거나
  바뀐 경우는 계속 거부한다.
- 서버의 넓은 canComplete=true가 실패/진행 중 결과를 성공 완료로 만들지 않도록 실제
  complete 호출부에서 COMPLETED/ACCEPT/INLINE/feedback 가능·저장 대기 아님을 확인한다.
  retry는 실제 FAILED에만 호출한다. 결과 읽기와 명령 가능 판단을 분리한다.
- FAILED를 응답 형식 오류 대신 실제 실패 상태로 전달한다. 점수·STT·교정을 만들지 않는다.
- 인증·선택 녹음·analysis/recording/request/execution ID 일치와 근거 연결 검증은 유지한다.

Backend의 광범위한 정책 변경 전체를 되돌리거나 서버에 새 정책 revision을 넣지 않는다.
완료 결과의 public canonicalAnalysis 자체가 없거나 실제 점수/근거가 잘못된 경우는
추가 필드 호환성으로 숨기지 않는다. 서버의 유효한 public projection이 필요하다.

## 최근 FE PR 전체 목록

아래 작성자는 GitHub PR 작성자다. 통합 파일/commit 수는 merge의 첫 parent 대비 범위이며,
release PR에는 이전 기능 PR이 중복 포함될 수 있다. 파일 수를 개인 작성량으로 해석하지 않는다.

| PR | GitHub 작성자 | 병합 UTC | merge SHA | 파일/commit 수 | 제목 |
|---|---|---|---|---|---|
| [#69](https://github.com/voice-coaching/VC-FE/pull/69) | intelligent04 | 2026-11-01T10:29:46Z | 7431f834a | 6/2 | fix: display supplied results in the practice report |
| [#70](https://github.com/voice-coaching/VC-FE/pull/70) | intelligent04 | 2026-11-01T10:49:49Z | e19487c90 | 14/3 | feat: record each sentence and await all feedback together |
| [#71](https://github.com/voice-coaching/VC-FE/pull/71) | intelligent04 | 2026-11-01T10:57:01Z | a6889eec2 | 15/6 | Dev |
| [#73](https://github.com/voice-coaching/VC-FE/pull/73) | youngwooke | 2026-11-01T11:11:29Z | 9edb8243d | 7/4 | Restore personal script library with authenticated backend APIs |
| [#72](https://github.com/voice-coaching/VC-FE/pull/72) | intelligent04 | 2026-11-01T11:12:20Z | 2643e3137 | 8/2 | fix: keep sentence recording continuous during background analysis |
| [#74](https://github.com/voice-coaching/VC-FE/pull/74) | intelligent04 | 2026-11-01T11:56:29Z | 23024c6dd | 11/3 | fix: apply continuous recording to all active sentence practice flows |
| [#75](https://github.com/voice-coaching/VC-FE/pull/75) | intelligent04 | 2026-11-01T12:24:47Z | 7231a90ea | 1/2 | FIX: 승급시험 진입 시 현재 시험 세션 복원 |
| [#76](https://github.com/voice-coaching/VC-FE/pull/76) | intelligent04 | 2026-11-01T13:26:53Z | 175a5be79 | 3/3 | fix: keep recording visible and reveal feedback before history completion |
| [#77](https://github.com/voice-coaching/VC-FE/pull/77) | youngwooke | 2026-11-01T13:45:38Z | a528d8ca1 | 10/5 | Add swipeable daily popular news top ten |
| [#79](https://github.com/voice-coaching/VC-FE/pull/79) | intelligent04 | 2026-11-01T13:47:03Z | f1311aaee | 11/2 | fix: 녹음 일시정지/재개 분리 및 기존 분석 로딩 복원 |
| [#80](https://github.com/voice-coaching/VC-FE/pull/80) | youngwooke | 2026-11-01T13:51:14Z | 9d566db01 | 1/2 | Verify shared analysis loader in sentence page tests |
| [#78](https://github.com/voice-coaching/VC-FE/pull/78) | youngwooke | 2026-11-01T13:52:01Z | 0a44c3a5f | 22/12 | Release daily news rankings and recording flow fixes |
| [#82](https://github.com/voice-coaching/VC-FE/pull/82) | youngwooke | 2026-11-01T15:13:28Z | 5eeb79269 | 23/4 | Show coaching usage and handle admission limits |
| [#83](https://github.com/voice-coaching/VC-FE/pull/83) | youngwooke | 2026-11-01T15:15:21Z | bc848ff50 | 23/4 | Release coaching usage and admission limit UI |
| [#81](https://github.com/voice-coaching/VC-FE/pull/81) | intelligent04 | 2026-11-01T15:55:30Z | a660036e9 | 5/2 | FIX: 기존 승급시험 녹음의 자동 진행을 막고 재개·새 시작 선택 제공 |
| [#84](https://github.com/voice-coaching/VC-FE/pull/84) | intelligent04 | 2026-11-02T06:24:23Z | b96e6fda5 | 10/5 | fix: audio/* 허용 정책에서 WAV 녹음이 거부되는 문제 수정 |
| [#85](https://github.com/voice-coaching/VC-FE/pull/85) | intelligent04 | 2026-11-02T06:24:46Z | 07819d1ab | 5/3 | Dev |
| [#86](https://github.com/voice-coaching/VC-FE/pull/86) | intelligent04 | 2026-11-02T06:35:08Z | 4dea84ca0 | 7/3 | fix: 선택적 음성 동의 정책에서 분석 제출이 차단되는 문제 수정 |
| [#87](https://github.com/voice-coaching/VC-FE/pull/87) | intelligent04 | 2026-11-02T06:41:44Z | 684af2f5f | 7/3 | Dev |

## 관련 최근 commit 판정

- #69 `13b7b1347`(Codex): 공급된 연습 결과 표시. 현재 projection parser 변경 없음.
- #70 `016d19c42`(Codex): 문장별 파일·결과 집계. parser 변경 없음.
- #72 `77c9bf7ef`(Codex), #74 `09b43bba2`(Codex): 연속 캡처/활성 인증 경로 적용. 사용자 흐름은 유지.
- #76 `e0e15f438`(Codex): 결과 공개/저장 분리. parser 규칙 도입 commit이 아님.
- #79 `37a255b9a`(Codex): pause/resume·로딩. parser 변경 없음.
- #82/#83 `88b830c07`(Youngwook Lee): canonical transport에서 usage 갱신 hook을 추가했으나
  결과 parser 조건은 변경하지 않았다. 현재 projection 거부의 원인으로 판정하지 않는다.
- #84/#85 `6cf1ddd9a`(Codex): MIME range 호환. 현재 오류를 새로 도입한 diff가 아님.
- #86/#87 `f88fc736b`(Codex): 선택 동의 본문. 결과 parser 변경 없음.
- 뉴스·스크립트·시험 UI·release 통합 PR의 관련 변경 파일에서도 이번 parser 규칙 변경은 없었다.

## 중복 제거 commit 기록

아래 git author는 PR 작성자와 별개다. merge commit도 포함한다.

| SHA | git author | authoredAt | subject |
|---|---|---|---|
| 13b7b1347 | Codex | 2026-11-01T19:05:52+09:00 | fix: display supplied utterance results in practice reports [skip ci] |
| 7431f834a | 이총명 | 2026-11-01T19:29:45+09:00 | Merge pull request #69 from voice-coaching/fix/sentence-practice-results-20261101 |
| 016d19c42 | Codex | 2026-11-01T19:47:03+09:00 | feat: record and submit each sentence before collecting all feedback [skip ci] |
| c01e45c02 | Codex | 2026-11-01T19:48:19+09:00 | fix: finish restoring pending audio before enabling recording [skip ci] |
| e19487c90 | 이총명 | 2026-11-01T19:49:48+09:00 | Merge pull request #70 from voice-coaching/feat/sentence-batch-practice-20261101 |
| a6889eec2 | 이총명 | 2026-11-01T19:57:00+09:00 | Merge pull request #71 from voice-coaching/dev |
| e69b8496e | Youngwook Lee | 2026-11-01T20:04:23+09:00 | feat: restore personal script library using authenticated backend APIs |
| ac2a1fdf2 | Youngwook Lee | 2026-11-01T20:06:39+09:00 | Merge latest main into script library feature before integration checks |
| 77c9bf7ef | Codex | 2026-11-01T20:08:38+09:00 | fix: keep sentence capture continuous while uploads run in background [skip ci] |
| c39db17c3 | Youngwook Lee | 2026-11-01T20:10:55+09:00 | test: align practice recovery checks with current sentence batch flow |
| 9edb8243d | Youngwook Lee | 2026-11-01T20:11:28+09:00 | Merge pull request #73 from voice-coaching/feat/script-library-20261101 |
| 2643e3137 | 이총명 | 2026-11-01T20:12:20+09:00 | Merge pull request #72 from voice-coaching/fix/continuous-sentence-recording-20261101 |
| 0cd5c0084 | Youngwook Lee | 2026-11-01T20:25:26+09:00 | Merge dev into main for sentence category code correction |
| 09b43bba2 | Codex | 2026-11-01T20:55:40+09:00 | fix: apply continuous capture to all active sentence practice flows [skip ci] |
| 23024c6dd | 이총명 | 2026-11-01T20:56:29+09:00 | Merge pull request #74 from voice-coaching/fix/all-sentence-practice-capture-20261101 |
| e246a43ab | intelligent04 | 2026-11-01T21:15:21+09:00 | FIX: restore title exam sessions without a session URL parameter |
| e0e15f438 | Codex | 2026-11-01T21:22:58+09:00 | fix: preserve recording screen and reveal received feedback before persistence [skip ci] |
| 7231a90ea | 이총명 | 2026-11-01T21:24:46+09:00 | Merge pull request #75 from voice-coaching/fix/title-exam-session-recovery-20261101 |
| d76232a12 | Youngwook Lee | 2026-11-01T22:02:03+09:00 | Merge dev into main for Korean copy proofreading |
| dc8391ef0 | 이총명 | 2026-11-01T22:26:43+09:00 | Merge branch 'dev' into fix/sentence-background-request-flow-20261101 |
| 175a5be79 | 이총명 | 2026-11-01T22:26:53+09:00 | Merge pull request #76 from voice-coaching/fix/sentence-background-request-flow-20261101 |
| ed7197a0f | Youngwook Lee | 2026-11-01T22:34:28+09:00 | Add shared swipeable daily news top ten |
| e595d6ce5 | Youngwook Lee | 2026-11-01T22:34:29+09:00 | Merge remote-tracking branch 'origin/dev' into feat/daily-popular-news-20261101 |
| 0e713f704 | Youngwook Lee | 2026-11-01T22:37:28+09:00 | Fix sentence completion declarations after dev integration |
| a528d8ca1 | Youngwook Lee | 2026-11-01T22:45:38+09:00 | Merge pull request #77 from voice-coaching/feat/daily-popular-news-20261101 |
| 37a255b9a | Codex | 2026-11-01T22:45:48+09:00 | fix: pause recording without ending practice and restore analysis loader [skip ci] |
| f1311aaee | 이총명 | 2026-11-01T22:47:03+09:00 | Merge pull request #79 from voice-coaching/fix/recording-pause-and-loading-20261101 |
| 94476d7e5 | Youngwook Lee | 2026-11-01T22:50:47+09:00 | Verify shared analysis loader in sentence page regression tests |
| 9d566db01 | Youngwook Lee | 2026-11-01T22:51:14+09:00 | Merge pull request #80 from voice-coaching/feat/daily-popular-news-20261101 |
| 0a44c3a5f | Youngwook Lee | 2026-11-01T22:52:00+09:00 | Merge pull request #78 from voice-coaching/dev |
| feb970e6a | intelligent04 | 2026-11-01T23:07:33+09:00 | FIX: require resume or restart choice for existing title exam recordings |
| 88b830c07 | Youngwook Lee | 2026-11-02T00:07:41+09:00 | Integrate coaching usage and admission limit guidance |
| 6b3fe9439 | Youngwook Lee | 2026-11-02T00:11:26+09:00 | Render submitted clip status from React state |
| 5eeb79269 | Youngwook Lee | 2026-11-02T00:13:28+09:00 | Merge pull request #82 from voice-coaching/feat/coaching-usage-ui-20261101 |
| bc848ff50 | Youngwook Lee | 2026-11-02T00:15:21+09:00 | Merge pull request #83 from voice-coaching/dev |
| a660036e9 | Youngwook Lee | 2026-11-02T00:55:30+09:00 | Merge pull request #81 from voice-coaching/fix/title-exam-resume-choice-20261101 |
| 6cf1ddd9a | Codex | 2026-11-02T15:17:41+09:00 | fix: accept capability MIME wildcards for audio and video recordings [skip ci] |
| b96e6fda5 | 이총명 | 2026-11-02T15:24:23+09:00 | Merge pull request #84 from voice-coaching/fix/recording-mime-wildcard-20261102 |
| 07819d1ab | 이총명 | 2026-11-02T15:24:45+09:00 | Merge pull request #85 from voice-coaching/dev |
| f88fc736b | Codex | 2026-11-02T15:32:09+09:00 | fix: honor optional voice consent policy before analysis submission [skip ci] |
| 4dea84ca0 | 이총명 | 2026-11-02T15:35:07+09:00 | Merge pull request #86 from voice-coaching/fix/optional-analysis-consent-20261102 |
| 684af2f5f | 이총명 | 2026-11-02T15:41:44+09:00 | Merge pull request #87 from voice-coaching/dev |

## 확인·인계

PR/Git 기록과 소스·diff·문서 링크만 정적으로 확인한다. 자동 테스트·브라우저 자동화·
실제 녹음·분석 POST·GPT 생성·컴파일은 실행하지 않는다. 사용자별 결과 원문을 dump하지 않는다.
개발자는 현재 permissive actions의 pending/완료 응답, AVAILABLE, rawResult 추가,
UUID 배정 전/후, 실제 ID 불일치, 실패 시 성공 완료 방지를 직접 QA해야 한다.
commit/push/PR과 배포·실제 분석 성공은 별도다.
