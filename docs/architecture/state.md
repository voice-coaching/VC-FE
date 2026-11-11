# 상태 문서 - VC-FE

중요한 상태 모델과 상태 전이를 이 문서에 기록한다.

학습 기록 목록은 COMPLETED 목록 응답을 기준으로 표시하며 분석 상세/피드백 검사로 행을 제거하지 않는다. 문장 분류 실패는 기록 없음과 구분하며 재시도를 제공한다. 분류 조회와 직접 분석 피드백 두 형식, 기존 로컬 북마크의 범위는 [기록 표시 규칙](../history-visibility.md)을 따른다.

## 상태 종류
| State | Owner | Source of Truth | Persisted | Notes |
| --- | --- | --- | --- | --- |

## Enum 값
| Enum | Value | Meaning | Terminal | Notes |
| --- | --- | --- | --- | --- |

## 상태 전이 규칙
| From | To | Trigger | Validator | Side Effects |
| --- | --- | --- | --- | --- |

## 인증 상태
- session, token, role, permission 상태를 여기에 기록한다.

## 영상 처리 동의와 제출 상태 (2026-11-07)

- `LipProcessingConsent`: 현재 화면에서 명시적으로 동의한 `voicePolicyRevision`/`videoPolicyRevision` 또는 null. 서버의 Required=true인 정책 revision과 정확히 일치해야 제출할 수 있다. Required=false이면 요청 필드도 생략한다. 과거 음성 로컬 동의는 사용하지 않는다.
- policyLoading/policyError는 미디어 권한·로컬 촬영과 별개다. 업로드 직전 새 정책으로 재검증하고 변경된 정책에는 다시 동의한다.
- 분석 phase는 idle → preparing → uploading → analyzing → result이며 오류/대기 중단은 error다. 업로드 전 동의·제한 검증 실패는 서버 분석을 만들지 않는다.
- 촬영 Blob별 제출 이력은 analyze 직전에 남긴다. 명확한 접수 거절 외의 불명확한 실패/중단은 기존 분석 확인으로 안내한다. 로그인 변경 시 동의·결과·제출 이력과 이전 계정의 content cache를 비운다.


## Administrator denial and token rotation

Current-session 401/403 latches denial separately from query cache, disables automatic admission checks and discards cached administrator data. Only a manual recheck or new login context resumes admission. USER access claims can reject early; positive admission always requires the server. Rotation preserves UI scope only when issuer/sub/sid/role match. [Contract and reproduction](../admin-access-boundary.md).
