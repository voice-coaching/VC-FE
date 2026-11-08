# 업로드·분석 연결 복구

백엔드 PR #218의 계약을 사용한다. 기존 V6 분석 요청/결과 스키마와 canonical 저장 확정·학습 완료·승급 채점 순서는 유지한다.

## 요청과 파일 보관

`practice-recovery-store.ts`는 IndexedDB `speakai-practice-recovery-v1`의 `attempts`에 사용자 ID와 연습 시도를 복합 키로 보관한다. 원본 Blob, 변환한 업로드 Blob, 세션 생성 본문, 단계별 UUID, sessionId/recordingId/analysisId, objectKey, 등록 본문, 분석/재시도 동의 본문을 함께 저장하고 **트랜잭션 완료 후 POST**한다. 보관 실패 시 서버 요청을 시작하지 않는다. 토큰, AI grant, presigned URL은 보관하지 않는다.

단일 녹음 화면의 `recordingAttempt` URL 값과 문장별 녹음의 기존 runId/문장 인덱스로 시도를 식별한다. 로그인 변경이나 다른 원문/분석 스키마/선택 녹음/분석 번호가 확인되면 복구를 중단한다. 재녹음/새 연습을 명시적으로 선택하면 이전 로컬 시도를 정리한다. 새로고침이나 일시적 화면 해제만으로 서버 세션을 취소하지 않는다.

다음 POST에 저장한 `Idempotency-Key`를 보낸다.

| 경로                                                       | 키와 본문                                                                     |
| ---------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `/api/training-sessions`                                   | 세션 생성 UUID와 동결한 생성 본문                                             |
| `/api/training-sessions/{sessionId}/recordings/upload-url` | 업로드 UUID와 동일 이름/MIME/크기                                             |
| `/api/training-sessions/{sessionId}/recordings`            | 등록 UUID와 동결한 객체/MIME/크기/길이                                        |
| `/api/training-sessions/{sessionId}/analyze`               | 분석 UUID와 최초 동의 본문                                                    |
| `/api/training-sessions/{sessionId}/analysis/retry`        | 명시적인 실패 분석 재시도마다 새 UUID. 응답 유실 복구는 그 UUID/본문을 재사용 |

승급시험 진입 중 서버 연결 세션을 복구하는 POST에도, 조회가 성공할 때까지 보관하는 별도 생성 키를 전달한다. 조회 응답이 확인된 뒤 정리하며 다음 명시적 세션 교체에는 새 키를 쓴다.

## 서버 상태에 따른 처리

알고 있는 세션은 먼저 `GET /api/training-sessions/{sessionId}/recovery`를 `no-store`로 조회한다. 공통 `{result,message,data}` 응답을 검증하며 uploads에서 **보관한 objectKey와 같은 항목**을 찾는다.

| 상태                    | 처리                                                                                         |
| ----------------------- | -------------------------------------------------------------------------------------------- |
| `UPLOAD_REQUIRED`       | 보관한 동일 파일을 처음부터 PUT. 바이트 단위 이어 올리기는 제공하지 않는다.                  |
| `READY_TO_REGISTER`     | PUT 없이 같은 등록 키/본문으로 등록한다.                                                     |
| `REGISTERED`            | 해당 recordingId가 실제 목록에 있는지 확인하고 재사용한다.                                   |
| `EXPIRED`               | 파일을 유지하고 업로드/등록 키를 새로 보관한 뒤 새 객체를 발급한다. 세션/분석 키는 유지한다. |
| `RECORDING_UNAVAILABLE` | 복구 불가를 표시한다. 자동 새 분석은 만들지 않는다.                                          |

최근 20개 목록에 없다고 파일이 없다고 판단하지 않는다. 같은 발급 키를 재전송해 원래 객체를 식별한다. 숨겨진 기존 객체는 같은 등록 키/본문으로 등록 결과를 복원할 수 있으며, 실제 저장소 검증은 백엔드 등록 API가 수행한다. `UPLOAD_INTENT_NOT_ACTIVE`에서 이미 보관한 등록 요청은 같은 키로 재전송한다. 객체/등록 상태를 확인할 수 없으면 멈추며 임의로 파일을 덮어쓰지 않는다.

네트워크 오류/503 `ANALYSIS_INTEGRATION_UNAVAILABLE`은 조회 실패다. 422 `ANALYSIS_SOURCE_NOT_READY`도 파일 부재의 증거로 취급하지 않는다. MIME/크기 불일치, 권한 상실, 실제 시도 변경에는 새 키/새 세션을 자동 생성하지 않는다.

분석 접수/재시도 응답은 최초 영수증일 수 있으므로 성공 후에도 recovery GET을 읽는다. `PENDING`/`PROCESSING`은 기존 상태/결과 GET으로 기다린다. `ANALYSIS_ALREADY_RUNNING`/`ANALYSIS_ALREADY_REQUESTED`도 상태 조회로 처리한다. 분석 실패를 연결 복구로 자동 재실행하지 않는다. 원본이 없으면 새 녹음이 필요하다고 안내한다.

브라우저 online 이벤트와 새로고침으로 기존 음성 작업을 복원한다. 온라인 이벤트는 일시적인 연결 오류에만 반응한다. 저장 확정과 학습 완료/승급 제출은 기존 canonical 계약을 그대로 사용한다.

## AI 직접 영상

영상은 별도 `/browser/v1/video-analysis-jobs` 계약을 유지한다. `videoAttempt` URL, 문장, 사용자로 보관 위치를 구분한다. 원본 영상 Blob, clientRequestId, 콘텐츠/세션 번호, 세션 생성 키, jobId/executionId/sequence를 저장한다. 재접속·새로고침 후 촬영본을 복원하고 사용자 동의/상태 재확인으로 동일 clientRequestId를 먼저 조회한다. 원본 영상의 해시는 복원한 동일 바이트로 계산한다.

알고 있는 jobId가 404이거나 작업/실행 ID 또는 sequence가 달라졌으면 다른 작업을 만들지 않는다. 새 grant는 필요할 때 발급하며 기기에 저장하지 않는다. 서버 녹음 복구 endpoint를 AI 직접 영상 작업 조회 대신 사용하지 않는다.

## 검증과 한계

- `node --import tsx --test scripts/training-recovery.test.ts scripts/browser-video-recovery.test.ts scripts/recording-submission.test.ts scripts/canonical-persistence.test.ts scripts/canonical-completion.test.ts scripts/canonical-transport.test.ts scripts/title-exam-api.test.ts scripts/title-exam-resume.test.ts`
- 로컬 Next 서버 실행 후 `node scripts/verify-training-recovery.mjs`: 실제 IndexedDB, 페이지 새로고침, PUT/분석 응답 유실, 503 후 online 이벤트. 서버/저장소는 Playwright 대역이다.
- 실기기 Wi-Fi 전환, 운영 S3/AI 실행은 위 자동 검증에 포함하지 않는다. `docs/qa/training-reconnection-20261108.md`의 실기기 항목으로 별도 확인한다.
- 이 기기의 브라우저 저장소가 삭제되거나 원본이 보관되지 않았다면 파일 복원은 불가능하다. 다른 기기로 파일을 동기화하지 않는다. 미완료 작업은 로컬에 남으므로 공용 기기에서는 브라우저 사이트 데이터를 정리해야 한다.
