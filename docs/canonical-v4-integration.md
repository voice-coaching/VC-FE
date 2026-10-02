# Canonical v4 프론트엔드 연결

## 범위와 기준

2026-10-02, `dev`의 `d54ceae5065880ccabd8f00ffe83500ab9077dfd`를 기준으로 만든
`feat/canonical-v4-fe-integration-20261002` 변경이다. `main` 전체를 병합하지 않았다.
Backend 대조 기준은 `voice-coaching/VC-BE`의
`a241a99ca0fd6abcdff6abfc5f23c47ce170757e`에 포함된
`CanonicalAnalysisView`, `CanonicalAnalysisQueryService`, `CanonicalActionPolicy`,
`CanonicalRequestScope` 및 `docs/api/canonical-analysis-view-v1.md`다.

이 변경은 FE 소스 통합이며 FE 배포나 실제 녹음/추론/브라우저 QA 완료를 뜻하지 않는다.
FE는 RunPod에 직접 연결하지 않고 기존 `/api/backend` 프록시와 사용자 JWT를 사용한다.
RunPod/B2/GPT 서버 키를 FE에 주입하지 않는다. Backend의 public view 및 v4 admission
구현이 필요하며, 기존 capabilities의 CONFIGURED만으로 canonical readiness를 단정하지 않는다.
실제 요청은 서버 admission 검사를 받는다.

## 진입과 기존 계약 보존

- 일반 단독 발음 연습에서 사용자가 기존 분석 또는 v4 분석을 명시적으로 선택한다.
  v4 새 세션은 `PRONUNCIATION`, 음성만 사용한다. BOTH 콘텐츠도 발음 범위로만 요청한다.
- 코스/코스 단계/승급 시험/CLASS_PRACTICE/localOnly와 억양 전용 연습은 기존 경로를 유지한다.
  v4 점수를 만들거나 코스·승급 시험 완료 실적으로 변환하지 않는다.
- 기존 영상·TTS·legacy coaching 메서드, 요청 body 및 전역 헤더는 바꾸지 않는다.
  dev에 이미 있는 legacy coaching 렌더링을 유지하고 학습 이력 상세에도 연결한다.
- 기존 `sessionId`가 있으면 resumeType 문자열에만 의존하지 않고 서버의 현재 분석을 확인한다.
  홈에서 FAILED를 RECORDING으로 연결해도 현재 canonical 결과를 읽는다.
- 세션 자체의 분석 상태 GET이 정확히 `404 ANALYSIS_NOT_FOUND`이고 상태가
  RECORDING/UPLOADING이면 아직 분석 없는 세션이다. 이것은 canonical 결과의 legacy fallback이 아니다.
  기본은 기존 경로이며, v4 화면이 제공한 `analysisMode=canonical` 이어가기 링크는
  허용 범위의 세션만 v4 화면으로 복귀시킨다. URL 값은 서버 권한 검사를 대체하지 않는다.

## API 경계

| 작업             | Backend 경로                                      | FE 처리                                           |
| ---------------- | ------------------------------------------------- | ------------------------------------------------- |
| 새 분석          | `POST /api/training-sessions/{id}/analyze`        | 기존 동의 body + 해당 요청에만 v4 헤더            |
| 실패 분석 재시도 | `POST /api/training-sessions/{id}/analysis/retry` | 현재 actions 재확인, 기존 동의 body + v4 헤더     |
| 진행 상태        | `GET /api/training-sessions/{id}/analysis/status` | 현재 analysisId 확인; FAILED도 상세 조회          |
| canonical 결과   | `GET /api/v2/analyses/{id}`                       | public view v1 검증, no-store                     |
| legacy 결과      | `GET /api/analyses/{id}`                          | canonical GET의 정확한 fallback 코드에만 사용     |
| 재녹음           | 기존 upload-url → PUT → recordings → select       | 새 녹음 생성, PASS 확인, 명시적 v4 요청           |
| 학습 절차 완료   | 기존 세션 complete                                | 최신 canComplete와 선택 녹음 확인; 점수/합격 아님 |

v4 헤더는 `X-Analysis-Result-Schema: voice-coaching.runpod-analysis-result.v4`다.
기존 동의 body의 `accepted: true`, 현재 capabilities의 `policyRevision`을 유지한다.
Next 프록시는 해당 헤더를 이미 전달하므로 프록시 계약 변경은 없다.
토큰 갱신 이후 원래 요청을 재전송하는 기존 HTTP 처리는 이 헤더를 보존한다.

canonical 결과에서 **오직 `404 CANONICAL_ANALYSIS_NOT_FOUND`만** legacy 조회를 허용한다.
일반 404, 401/403, 409, 503, 네트워크 오류와 형식/ID 불일치에는 이전 결과를 보여주지 않는다.
로그인 갱신 endpoint의 오류는 별도 코드로 분리하여 legacy fallback으로 오인하지 않는다.

상대 upload URL은 `/api/backend` 아래로 해석하고 이 Backend 경로에만 JWT를 추가한다.
외부 presigned URL에는 로그인 JWT를 추가하지 않으며 발급된 requiredHeaders는 유지한다.
공개 `uploadRecording` 호출 형식은 그대로다. 이는 main에 있는 상대경로 업로드 대응과
같은 목적의 최소 보완이며, main의 다른 API/화면 변경을 함께 반입하지 않는다.

## 근거 표시와 상태 처리

- Zod strict allowlist로 public view만 읽는다. private callback/raw core/B2 pointer는 받지 않는다.
- analysisId/recordingId와 전체 requestId/executionId를 분리·검증한다.
  attemptScope 및 scoped candidate/evidence ID를 줄이거나 재정렬하지 않는다.
- candidate 최대 3개, coverage 순서, evidence membership, expression의 candidate/guidance
  연결을 검증한다. G2P role을 철자 role과 동일하게 표시하지 않는다.
- MFA word/phone 위치는 원래 초 단위로 표시한다. 소스 음성과 시간축 대응이 없어
  구간 seek는 비활성화한다. 전체 녹음 재생을 MFA 구간 재생이라고 부르지 않는다.
- jobStatus와 ACCEPT/REJECT/INCONCLUSIVE/SYSTEM_FAILURE 및 생성 상태를 별도로 표시한다.
  ACCEPT는 정상 발음 판정이 아니며, 후보 없음도 정상 판정이 아니다.
- 기본 연습 fallback, pre-core 실패, RETAINED_ONLY, FAIL_CLOSED를 성공 결과로 바꾸지 않는다.
  점수는 제공하지 않고 visual NOT_CONNECTED / correctiveClaimsAllowed=false를 명시한다.
- 완료·재시도·재녹음 클릭 직전에 전체 시도 ID를 고정해 다시 GET하고 actions를 확인한다.
  실제 command의 서버 재검증이 최종 권한이다. regenerate는 호출하지 않는다.
- timeout/응답 유실 시 자동 분석 재요청을 하지 않는다. GET으로 현재 상태를 다시 확인한다.
  선택된 PASS 녹음에 정확히 ANALYSIS_NOT_FOUND가 확인된 경우에만 별도 명시적 제출 버튼을
  제공하며, 클릭 시에도 상태를 다시 조회한다. 이미 생성된 분석은 조회만 한다.
- canonical 분석 화면 이탈은 작업 취소 API를 자동 호출하지 않는다. 이력 삭제는 기존
  사용자 확인과 기존 삭제 API를 유지한다.

## 메모리·이력

canonical 원문/결과를 localStorage 등 영속 캐시에 저장하지 않는다. 로그인·로그아웃·다른 탭의
인증 토큰 변경, 콘텐츠/경로/세션 변경 시 화면을 다시 마운트하여 결과 메모리를 폐기한다.
진행 중 조회는 abort 및 인증 세대 검사로 차단한다. 조회 시작·오류·삭제 시 이전 결과를 비운다.
다른 기기에서 발생한 변경을 실시간 push로 감지하는 구현은 아니다. GET 재조회 및 command
시 서버의 현재 선택/소유/삭제 상태를 다시 적용한다.

이력 상세는 현재 GET을 거쳐 canonical/legacy 표시를 분기한다. canonical에 기존 overallScore,
STT 오인 문구, NORMAL/개선 필요 segment 판정을 끼워 넣지 않는다. 현재 분석 화면으로 이동해
서버가 허용하는 후속 작업을 수행할 수 있다.

## 확인 범위와 FE 개발자 인계

수행 범위는 TypeScript 컴파일(`tsc --noEmit --incremental false`), 변경 파일 포맷 및
diff/계약 정적 확인이다. 자동 회귀 테스트·브라우저 자동화·fixture 생성·실제 추론 요청·
Next 배포 빌드는 수행하지 않는다. 다음은 완료 증빙이 아닌 개발자 수동 확인 항목이다.

- 기존 단독/코스/시험/영상/TTS 경로와 기존 coaching 출력 보존.
- 명시적 v4 선택, 동의, 마이크 권한/길이/MIME/용량, 상대·외부 URL 업로드.
- pending/FAILED 및 모든 canonical 판정·fallback/후보 없음의 표시와 학습 이력 재진입.
- 현재 actions에 따른 retry/re-record/complete 및 admission 거부, quality 실패, timeout 후 조회.
- REJECT/INCONCLUSIVE 재녹음 후 새 시도 생성과 이전 선택 근거 비노출.
- 401 갱신/로그아웃/탭 간 계정 변경, 404/409/503, 삭제/선택 변경 시 이전 결과 비노출.
- MFA/ID/후보 순서 보존, 점수·개인 입술/억양 교정 생성 금지, 전체 녹음과 구간 재생 구분.
- 실제 사용 브라우저/모바일 접근성·레이아웃과 FE 배포 환경의 Backend 프록시 설정.

merge 및 FE 운영 배포는 이 PR에 포함되지 않는다.
