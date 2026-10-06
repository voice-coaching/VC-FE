# DLPC 이전 시 직접 분석 주소

`src/lib/direct-analysis.ts`의 기본 공개 origin을 RunPod 개별 주소에서
`https://ai.voice-coaching.site/direct`로 변경한다. 사용자 인증·서버 토큰을
추가하지 않고 기존 요청·조회·취소·SSE 계약을 보존한다.

## 배포 순서

1. AWS nginx에 `/direct/` 전용 20MiB 업로드 경로와 SSE 응답 버퍼링 비활성화를 준비한다.
   AI의 최대 WAV 크기는 20MiB다. 내부 JSON API용 64KiB 제한을 공유하면 안 된다.
2. DLPC에서 `AI_DIRECT_ENABLED`, origins, spool/workspace, history·archive 전달 설정을
   준비하고 운영 release의 readiness를 확인한다. 현재 프론트 origin은
   `https://vc-fe.vercel.app`이며 AI CORS 설정과 맞춘다.
3. 기존 직접 분석·결과 전달을 drain하고 기존 job/attempt 조회 데이터를 이전한다.
   주소 변경으로 기존 결과가 사라지거나 같은 attempt가 중복 실행되지 않아야 한다.
4. AWS upstream 전환 후 프론트의 `NEXT_PUBLIC_DIRECT_ANALYSIS_ORIGIN`을 위 주소로
   설정해 새로 빌드·배포한다. 배포 환경에 기존 값이 있으면 코드 기본값보다 우선한다.
5. 프론트의 실제 배포 번들 URL과 공개 readiness를 확인한 뒤 RunPod 사용을 종료한다.

`NEXT_PUBLIC_*`는 빌드 시 고정된다. 실행 환경변수만 수정해 이미 배포한 브라우저
번들의 주소가 바뀐다고 간주하지 않는다. 새 주소 준비 전에 본 변경을 운영 배포하지 않는다.

2026-10-06 작성 시점: 코드 준비이며 운영 프론트 배포·브라우저 QA는 미수행이다.
Vercel 배포 설정에 공개 origin override가 있는지는 별도로 확인해야 한다.
