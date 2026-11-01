# 모든 음성 문장 연습의 연속 녹음 — 2026-11-01

이 문서는 현재 `PracticeSession` 진입 경로의 소스 계약이다. 실제 녹음·배포·운영 QA 관측이 아니다.

## 실제 진입 경로

| 종류 | 진입과 녹음 경로 | 서버 인계 |
|---|---|---|
| 일반 문장 | ContentCatalog(SENTENCE) → /practice/{id} → PracticeSession → SentencePracticeSequence | 인증형 문장별 training session |
| 뉴스 읽기 | ContentCatalog(NEWS) → 같은 PracticeSession | 동일 |
| 아나운서 따라 읽기 | ContentCatalog(ANNOUNCER) → 같은 PracticeSession | 동일 |
| 내 문장 | MyScriptScreen → PracticeSession | 서버 콘텐츠 ID를 가진 문장은 동일 |
| 발음·억양 클래스 | classPracticeHref → PracticeSession → SentencePracticeSequence | 예문별 contentId·courseStepId·sentenceIndex와 learningFocus 유지 |
| 기존 sessionId 재진입 | PracticeSession → RecordingPracticeSession → usePracticeRecorder | 원래 세션·선택 녹음·복구 계약 유지 |
| 로컬 전용 문장 | PracticeSession(localOnly) → RecordingPracticeSession → usePracticeRecorder | 녹음 가능. 서버 콘텐츠 ID를 만들거나 AI 제출하지 않음 |
| 승급 시험 | PracticeSession(titleExamId) → TitleExamSession → RecordingPracticeSession → usePracticeRecorder | 실제 전체 녹음 하나와 기존 analysisId로 채점. 문장 점수를 합산해 시험 결과를 만들지 않음 |

영상 입술 연습의 MediaRecorder·영상 동기화 경로는 별도 계약이며 음성 전용 recorder로 바꾸지 않는다. 기존 Direct 컴포넌트는 현재 일반 문장 연습의 dispatcher가 아니다. 그 컴포넌트만 수정하면 위 활성 경로에 반영되지 않는다.

## 사용자 흐름

일반 문장·뉴스·아나운서·내 문장·클래스·승급 시험의 연습/녹음 화면은 현재 문장 한 개를 한 페이지로 표시한다. 현재 문장 번호와 전체 문장 수를 안내하며, 녹음한 문장을 마무리한 뒤 다음 문장 페이지로 전환한다. 같은 연습 세션과 마이크 스트림에서 페이지를 전환하고, 문장별 분석 결과는 마지막에 모아 확인한다. 원고 보관함의 전체 원고 미리보기는 계속 제공한다.

뉴스 소개에서 `연습 시작하기`를 누르면 첫 문장 페이지로 바로 진입한다. 여러 문장을 나열하는 중간 원고 화면은 생략한다.

처음 마이크를 시작한 뒤 `다음 문장`을 누르면 같은 마이크 스트림에서 PCM을 split/flush하고 다음 문장 녹음을 계속한다. 다음 녹음 위치는 로컬 캡처한 문장 목록과 복구된 기존 접수 내역으로 결정하며, 업로드 응답이나 분석 결과를 기다리지 않는다. 캡처 도중에는 로컬 녹음 진행만 표시한다.

인증형 Sequence는 캡처된 각 WAV를 사용자·연습·문장 index에 묶어 IndexedDB에 보관한다. 파일이 준비되면 UI를 렌더링하지 않는 기존 RecordingPracticeSession 제출 경로가 세션 생성, 파일 업로드, 녹음 등록·음질 확인·선택, 동의 입력, 분석 접수를 수행한다. 접수 후 observeSentenceAnalysis가 결과 저장·완료를 독립적으로 확인한다. 이 작업들은 다음 문장의 캡처를 잠그지 않는다.

마지막 문장을 녹음한 뒤에만 진행·오류·재조회 화면을 보여 주고, 모든 결과가 준비되면 문장별 피드백을 함께 표시한다. 네트워크 응답 유실은 같은 worker의 기존 session/recording/analysis 상태로 조정하며 사용자가 재확인할 수 있다. 자동으로 새 추론을 반복하지 않는다. 녹음 보관 실패는 원본을 메모리에 유지하고 재보관 버튼으로 처리한다. 데이터 부족·미지원 분석·미완료 저장을 성공·0점·정상 발음으로 바꾸지 않는다.

## 일시정지·재개와 분석 대기 화면

가운데 버튼은 녹음 시작 후 일시정지/재개만 수행한다. 일시정지는 AudioWorklet의 샘플 캡처만 멈추며, 파일 분할·분석 제출·마이크 해제·문장 이동을 발생시키지 않는다. 일시정지 시간은 녹음 길이와 문장별 60초 제한에서 제외한다. 오른쪽 `다음 문장`은 현재 문장을 확정하고 다음 녹음을 이어가며, 마지막에는 `녹음 완료`로 표시한다. 일시정지 상태에서도 다음 문장으로 이동하면 새 문장은 녹음을 재개한다.

모든 녹음이 끝난 뒤에는 기존 새 이미지(`newsBird.webp`), `AnalysisLoadingMessage`, 분석 단계 표시로 구성된 화면을 `PracticeAnalysisLoading`으로 공유한다. 일반 Sequence, Direct batch, 기존 세션·로컬·시험의 녹음 경로 모두 같은 조작과 대기 화면을 사용한다. 서버 API·인증·소유 관계는 변경하지 않는다.

이번 일시정지/대기 화면 수정은 소스 연결과 Git diff만 정적으로 확인했다. 테스트·컴파일·브라우저 자동화·실제 녹음은 실행하지 않았으며 개발자가 일시정지 후 재개, 일시정지 상태의 다음 문장 이동, 마지막 완료 후 로딩 화면을 직접 확인해야 한다.

## 계약과 복구

- 기존 인증형 Backend HTTP API, 양의 정수 session/recording/analysis ID와 로그인·소유 관계를 유지한다. 익명 Direct UUID를 대신 넣지 않는다.
- 원고의 sentenceIndex/sentenceText, 클래스 예문 revision, 녹음 실제 길이·음질·최대 크기·지원 형식 검사를 유지한다.
- localStorage에는 계정별 capture run ID와 원고 fingerprint, 별도 기존 cache에는 접수 ID를 보관한다. WAV bytes는 IndexedDB에 둔다. 첫 로컬 캡처 때 resumeSequence를 표시하므로 첫 업로드가 끝나지 않아도 재진입 시 파일을 복구한다.
- 일반 문장·뉴스·아나운서·내 문장·클래스는 모두 같은 Sequence를 사용하며 콘텐츠 종류별 대기 UI를 두지 않는다. 클래스 완료는 각 세션의 실제 완료 뒤에 기존 진도 API로 처리한다.
- 레거시/재진입·승급 시험은 같은 연속 캡처를 사용한다. 기존 서버 계약이 전체 녹음 하나를 요구하므로 실제 문장 PCM을 손실 없이 연결한 WAV를 제출하고, 로컬 재생 경계는 실제 샘플 수에서 계산한다. 시험 grading ID나 종합 점수는 가짜로 생성하지 않는다.
- 로그아웃·소유 세대 변경·화면 해제 뒤에는 후속 업로드/등록/분석 제출과 늦은 접수 callback을 진행하지 않는다. 이미 접수된 서버 작업을 임의 재실행하거나 다른 계정으로 연결하지 않는다.

## 확인 범위

TypeScript noEmit 컴파일, 변경 소스 포맷, 문서 상대 링크·충돌 표식과 Git diff 정적 확인을 수행한다. 자동 테스트·브라우저 자동화·실제 녹음·AI/GPT 생성·품질 QA는 실행하지 않는다. 개발자는 각 표의 경로에서 첫→두 번째 문장, 느린 업로드 중 녹음 지속, 마지막 뒤 결과 대기, 재진입·권한 거부·클래스 완료·시험 채점을 직접 확인해야 한다. PR 생성과 운영 배포는 별도다.
