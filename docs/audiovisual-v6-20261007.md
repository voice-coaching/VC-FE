# 영상 연습 v6 연결

2026-11-07 최신 main 기준 구현. 운영 배포와 AI 영상 접수 활성화는 별도다.

## 촬영·동의·업로드

- `/lip-practice`는 카메라와 마이크를 하나의 MediaRecorder 영상에 담는다. 별도의 PCM, MFA receipt, 다른 녹음 ID를 만들지 않는다.
- 로컬 촬영·재생은 서버 접수 중단 중에도 가능하다. 진입 시 지원 정보를 읽고 업로드 직전에 `requireAnalysisScope("VIDEO")`로 지원·admission·v6를 재확인한다.
- `src/lib/lip-analysis.ts`가 최신 capability, 영상 MIME, 최대 bytes, 최소/최대 길이, 필요한 음성 트랙과 정책 버전을 검사한다. 촬영 상한은 로컬 12초와 확인한 서버 상한 중 작은 값이다. 업로드 때 다시 길이를 검증한다.
- 선택한 촬영본의 얼굴·입술 영상과 내장 음성을 발음·입술 분석 목적으로 서버에 전송한다고 안내한다. 영상/음성 동의는 각각 현재 정책 revision에 연결한다. 기존 `audio-only-v1` 로컬 저장값을 읽지 않는다. 로그인 변경·페이지 재진입 시 새 동의가 필요하고 정책 변경 시 이전 동의는 유효하지 않다.
- 필요한 영상 동의만 recording 등록의 `videoProcessingConsentAccepted=true`와 `videoProcessingConsentPolicyRevision`으로 보낸다. 비활성 정책은 두 필드를 생략한다. analyze의 기존 음성 `{accepted, policyRevision}` body와 분리한다.
- `prepareVideoForAnalysis(reportClip.blob, acceptedVideoMimeTypes)`의 실제 영상 bytes를 기존 URL 발급 → PUT → 등록 흐름으로 전송한다. codec parameter만 정규화하며 인코딩을 가장하지 않는다.
- 등록 결과의 `analysisMediaType=AUDIO_VISUAL`과 동일 recording ID의 품질 PASS를 확인한 뒤 선택하고 분석한다. capability scope 명칭 VIDEO와 recording DTO의 AUDIO_VISUAL은 서로 다른 enum이다.
- `X-Analysis-Result-Schema: voice-coaching.runpod-analysis-result.v6`와 `/api/v3/analyses/{analysisId}` 조회를 유지한다. 응답 래퍼는 기존 client에서 해제하고 요청/실행/녹음 identity 검사와 서버 소유권 검사를 유지한다.

## 취소·실패·재시도

- 제출 잠금과 촬영 영상 Blob의 WeakSet을 사용한다. analyze 요청 직전에 제출 표시를 남긴다. 통신 단절·취소로 접수 여부가 불명확하면 새 분석을 자동 생성하지 않고 기록 확인을 안내한다.
- 명확한 admission 거절만 재요청을 허용한다. 업로드 URL의 401/403 만료 시에만 기존 URL 재발급을 1회 수행하며, 같은 영상 Blob을 전송한다.
- 분석 대기 중단은 AbortSignal로 PUT·분석 요청·폴링을 중단한다. 진행 중인 등록/품질 조회가 돌아와도 다음 단계로 가지 않는다. 이미 서버가 접수한 분석의 취소 완료를 주장하지 않는다.
- 지원/정책 누락, 동의 불일치, 크기·길이·MIME·음성 트랙 위반, AUDIO_ONLY 등록이면 분석 요청을 보내지 않는다.

## 점수와 표시 경계

[공유 소비 계약](contracts/lip-provisional-score-v1.md)을 따른다.
`canonicalAnalysis.score.overallScore`는 서버 값 그대로 표시하고 0은 유효, null은 미제공이다. 실패·대기·평가 제외 결과에 오래된 숫자 점수를 표시하지 않는다.
입술 총점과 루트/위치별 선택 subScores는 별도 근거로 표시한다. PROVISIONAL은 “임시 참조 적합성”, COMPARE_REFERENCE는 “참조 비교 연습”으로 표시한다.
전체 입술 점수가 보류돼도 음성 종합점수·유효한 국소 관찰/피드백을 유지한다. Frontend 재합산·검산·추가 GPT 호출은 없다.

영상 관련 문구는 현재 `/lip-practice` 카메라 결과에만 표시한다. 일반 음성 연습·클래스·시험·기록·Direct 음성 화면은 응답에 visual이 있어도 해당 문구를 렌더링하지 않는다.
전체 좌표·receipt·원본 CORE를 노출하지 않는다. 기존 coverage·시간 범위·식별자 검사는 유지한다.

## 운영 확인

Frontend 검증 결과는 이 변경의 QA 기록을 참고한다. 실제 영상의 Backend 저장·내장 음성 정규화·AI 내부 요청·운영 공개 조회 및 DB 저장은 Backend/AI 담당자와 확인해야 한다.
Frontend 구현·빌드 성공만으로 VIDEO 접수를 활성화하지 않는다. 모든 한국어 문맥에서 입술 총점이 나온다고 안내하지 않는다.

Frontend 검증: [2026-11-07 QA 기록](qa/lip-video-integration-20261107.md). 43개 자동 검사와 TypeScript/변경 파일 ESLint/프로덕션 빌드, 가상 카메라·모의 API를 사용한 7개 브라우저 시나리오를 통과했다. 운영 Backend/AI/DB 확인은 포함하지 않는다.
