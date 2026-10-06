# 직접 분석 PCM 입력 계약

RunPod `/direct/api/v1/analyses`는 mono 16kHz PCM16 WAV를 받는다. 기존 브라우저/네이티브 녹음은 기기 샘플레이트를 그대로 WAV에 기록해 44.1kHz 또는 48kHz 녹음이 `422 INVALID_PCM_WAV`로 거부될 수 있었다.

직접 분석 제출 전 `direct-audio.ts`에서 Web Audio로 디코딩하고 OfflineAudioContext로 16kHz mono 리샘플링한 후 PCM16 WAV로 인코딩한다. 헤더만 변경하지 않는다. 기존 AWS 업로드 경로는 그대로다. 서버의 알려진 422 오류는 해당 입력 문제를 표시한다.

Seungun → GPT 채점·코칭 전환은 RunPod에서 수행하며 기존 9항목 점수/코칭 응답 모양은 유지된다. 서버가 보정 정책 때문에 GPT 호출을 막지 않는다.

검증 범위: TypeScript 컴파일 및 포맷·정적 확인. 브라우저 녹음 QA와 자동 회귀 테스트는 실행하지 않는다.
