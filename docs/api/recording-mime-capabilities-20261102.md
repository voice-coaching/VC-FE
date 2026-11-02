# 녹음 MIME capability 와일드카드 처리

## 원인과 관측

2026-11-02 06:15 UTC에 아래 두 URL을 읽기 전용으로 조회했다.

- `https://api.voice-coaching.site/api/analysis-capabilities`
- `https://vc-fe.vercel.app/api/backend/api/analysis-capabilities`

둘 다 HTTP 200, `acceptedAudioMimeTypes=["audio/*"]`, recordingUpload와
analysisRequests는 CONFIGURED였다. Backend main `25119c1`의
AnalysisCapabilitiesReaderImpl도 audio/*와 video/*를 반환한다.
이는 응답/소스 관측이며 Backend의 실제 배포 SHA까지 확인한 것은 아니다.

FE main `a660036`의 prepareAudioForAnalysis는 허용 목록에 source MIME이
문자열 완전 일치로 존재하는지만 검사했다. 따라서 audio/wav가 audio/*에 포함되지
않는다고 판단하고 `이 기기의 녹음 형식(audio/wav)을 서버가 지원하지 않습니다.`를
던졌다. 이 오류는 녹음 업로드 전에 발생하므로 해당 메시지를 AI의 WAV 거부로
해석하면 안 된다. AI의 Backend request v4 계약은 audio/wav를 사용한다.

## 수정

- `src/lib/media-mime.ts`에서 정확한 MIME, type/* 및 */*를 해석한다.
  대소문자·주변 공백·codec parameter를 정규화하고 빈 정책을 허용 정책으로 바꾸지 않는다.
- 음성 업로드 준비와 WAV 변환 가능 여부가 같은 matcher를 사용한다.
  audio/*가 주어지면 실제 WAV를 그대로 전송하며 확장자·MIME만 바꿔 인코딩을 가장하지 않는다.
- 영상 업로드 준비에도 동일 matcher를 적용해 video/* 정책을 해석한다.
  audio/*가 video/mp4를 허용하지는 않는다.
- capability cache key를 `analysis-capabilities:mime-ranges-v2`로 바꾼다.
  기존 클라이언트 cache TTL이 30분이므로 이전 목록을 새 코드가 계속 사용하는 것을 막는다.
- 일반·뉴스·아나운서·내 문장·클래스·기존 세션·시험은 공통 음성 준비 함수를 사용한다.
  Backend upload API와 AI request/result 계약은 변경하지 않는다.

## 확인과 인계

현재 capability 응답, 양쪽 관련 소스, 변경 diff를 정적으로 대조했다.
자동 테스트·브라우저 자동화·실제 녹음·업로드·AI 분석·컴파일은 수행하지 않았다.
개발자는 audio/* + WAV, codec parameter가 있는 MIME, 정확한 MIME 목록,
불일치 목록, video/* 및 기존 cache가 남은 계정에서 실제 녹음 흐름을 확인한다.
코드 수정·PR은 프론트 배포 또는 실제 분석 성공 확인과 별도다.
