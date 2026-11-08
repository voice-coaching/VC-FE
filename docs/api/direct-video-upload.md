# 원본 영상 직접 업로드 연결 상태

2026-11-08. 사용자가 정한 새 경계는 Backend 인증/권한 발급 → 브라우저의 원본 영상 AI 직접 업로드다.
Backend 영상 capability, S3 업로드, recording/session 생성, 정규화·결과 수집을 새 영상 경로에 사용하지 않는다.

## 확정된 권한 API

`src/lib/api/video-upload-authorizations.ts`는 다음 Backend 후보 계약만 구현한다.

- POST `/api/analysis-authorizations/video`, 기존 Backend Access Token 인증.
- 요청: clientRequestId(UUID), videoSha256, fileSizeBytes(1~100 MiB), mimeType(video/mp4, video/webm, video/quicktime), scriptSha256.
- 응답: tokenType=Bearer, uploadToken, aiOrigin(HTTPS origin), clientRequestId, expiresAt(UTC ISO-8601).
- 기존 client에서 data를 해제하며 UUID와 origin을 확인한다. 로그인 변경·취소 후 반환한 권한을 사용하지 않는다.
- 원본 bytes와 실제 UTF-8 원고를 SHA-256으로 결속한다. Backend에는 metadata만 보낸다.
- 권한을 localStorage/로그/공개 환경변수에 저장하지 않는다. AI 서비스 Bearer와 Backend 로그인 토큰을 AI에 보내지 않는다.
- 권한 재발급에 같은 clientRequestId를 사용한다. 권한 발급 자체는 AI 분석 접수가 아니다.

## 아직 없는 브라우저 접수 계약

확인한 AI main dd6ab067은 `/v2/audiovisual-analysis-jobs`에서 AI 서비스 Bearer와
이미 정규화된 WAV/MP4 및 mediaPreparation receipt를 요구한다. 브라우저 원본 업로드 API가 아니다.
브라우저가 Backend 정규화 receipt를 만들거나 서비스 비밀 토큰을 사용하지 않는다.

J406 담당자가 다음을 확정해야 실제 `/lip-practice` 제출/조회 경로를 교체할 수 있다.

1. Backend RS256 업로드 권한을 검증하는 원본 영상 접수 URL·method·MIME·원고 metadata 형식.
2. 동일 clientRequestId의 응답 유실 조정, 접수 UUID와 job 접근권한.
3. 공개 상태·결과·취소 endpoint 및 응답 DTO. 만료된 업로드 토큰을 장시간 결과 조회 권한으로 재사용하지 않음.
4. 브라우저 origin/Authorization/metadata 헤더에 대한 CORS와 원본 bytes의 최대 크기·시간 제한.
5. AI 내부 정규화·PCM/MP4·시계 receipt 생성. Backend readiness/결과 인수에 의존하지 않음.

현재 권한 client만 추가했으며 기존 화면의 Backend 제출 코드는 아직 교체하지 않았다.
존재가 확인되지 않은 AI endpoint로 영상을 전송하거나 버튼만 열어 복구 완료로 보고하지 않는다.
