# 디렉토리 문서 - VC-FE

## 관리자 클래스 문장 관리

- `src/features/admin/components/courses.tsx`: 클래스별 목록, 같은 페이지의 클래스·문장 편집 UI.
- `src/features/admin/course-services.ts`: 클래스 전체 저장 검증·관리 API 호출·응답 검증.
- `src/features/admin/course-services.test.ts`, `scripts/verify-admin-courses.mjs`: 서비스/브라우저 검증.
- [동작과 백엔드 선행 배포](../admin-class-contents.md).

## 원본 영상 직접 업로드

- `src/lib/api/video-upload-authorizations.ts`: 운영 Ed25519 grant DTO/권한 발급 client.
- `src/lib/api/browser-video.ts`: AI create/원본 PUT/start/상태/결과/취소 client·UUID/digest 검사.
- `src/lib/browser-video-practice.ts`: 한 촬영본의 제출·재확인 orchestration. Backend 영상 bytes 전송 없음.
- `src/lib/browser-video-presentation.ts`: AI 공개 점수/총평의 화면 모델 변환.
- `src/components/browser-video-{consent,analysis-result}.tsx`: 동의와 기존 리포트 연결.
- `src/routes/lip-practice.tsx`: 카메라 촬영·진행·결과 화면. 기존 lip-analysis.ts Backend 경로는 사용하지 않음.

## 홈 관리자 공지

- `src/lib/home-popup.ts`: 사용자 팝업 전용 HTTP 조회·응답 검증·이동 목적지 변환.
- `src/lib/home-popup-preferences.ts`: 같은 브라우저의 사용자·팝업별 7일 숨김 저장·만료 확인. `scripts/home-popup-preferences.test.ts`에서 경계·격리·저장 차단 검증.
- `src/components/home-popup.tsx`: 홈 상단 모달, 현재 방문의 닫기 상태와 인증/언마운트 시 요청 취소.
- `scripts/home-popup.test.ts`, `scripts/verify-home-popup.mjs`: 조회 계약 및 로컬 모의 API 브라우저 검증.

- `src/lib/score-details.ts`: 선택형 6항목 schema·타입·표시 변환. 총점 재계산 없음.
- `src/components/analysis-score-details.tsx`: Backend·Direct·문장별 연습·저장 이력의 공통 세부점수 표시.
- canonical/Direct presentation은 내부 `AnalysisResult.scoreDetails`로 선택 객체를 전달한다.

이 파일은 현재 프로젝트 구조를 설명하는 기준 문서다.

## 필수 작성 항목
- 디렉토리 경로
- 주요 파일 경로
- 책임
- 담당 기능 및 계층
- 중요한 의존성 메모

기능/도메인 폴더를 바깥 경계로 두고, 각 기능 하위의 계층 폴더를 문서화한다.

## 현재 구조
| Path | Type | Responsibility | Owner | Notes |
| --- | --- | --- | --- | --- |
| `app/features/<feature>/controllers` | directory | FastAPI 구조 placeholder | TBD | 실제 프로젝트 역할로 교체 |
| `app/features/<feature>/services` | directory | FastAPI 구조 placeholder | TBD | 실제 프로젝트 역할로 교체 |
| `app/features/<feature>/repositories` | directory | FastAPI 구조 placeholder | TBD | 실제 프로젝트 역할로 교체 |
| `app/features/<feature>/schemas` | directory | FastAPI 구조 placeholder | TBD | 실제 프로젝트 역할로 교체 |
| `app/features/<feature>/entities` | directory | FastAPI 구조 placeholder | TBD | 실제 프로젝트 역할로 교체 |
| `app/core` | directory | FastAPI 구조 placeholder | TBD | 실제 프로젝트 역할로 교체 |
| `app/shared` | directory | FastAPI 구조 placeholder | TBD | 실제 프로젝트 역할로 교체 |


## 독립 문장 녹음 (2026-11-01)

| 경로 | 책임 |
|---|---|
| `src/components/direct-practice-session.tsx` | 기존 독립 연습 진입점 유지 |
| `src/components/sentence-batch-practice-session.tsx` | 문장별 녹음·전송·전체 대기·결과 카드 UI |
| `src/hooks/use-sentence-batch.ts` | 로컬 파일 큐와 독립 백그라운드 전송·복구·polling·이력 연결 |
| `src/hooks/use-sentence-recorder.ts` | 마이크를 유지하는 연속 캡처와 문장별 로컬 진행 |
| `src/lib/sentence-audio.ts` | AudioWorklet PCM 스트림의 문장별 split/flush |
| `src/lib/sentence-batch-api.ts` | 익명 AI HTTP client와 결과 schema·identity 검증 |
| `src/lib/sentence-history-links.ts` | 계정별 미완료 이력 연결 claim 영속화·재시도 |
| `src/lib/sentence-recordings.ts` | IndexedDB의 정확한 WAV bytes 보관·재시도 |

UI → hook → HTTP/storage adapter 방향으로 연결한다. 연속 녹음은 useSentenceRecorder가 마이크/AudioContext를 유지하며 split/flush하고, 녹음 cursor를 서버 접수 상태와 분리한다. 기존 useAudioRecorder의 단일 녹음 경로는 유지한다. 상태·timeout·실패·저장 흐름은 [계약](../api/sentence-practice-batches.md)을 따른다.


## 인증형 문장 연습의 실제 캡처 경계 (2026-11-01)

| 경로 | 책임 |
|---|---|
| `src/components/sentence-practice-sequence.tsx` | 활성 문장/뉴스/아나운서/내 문장/클래스의 로컬 녹음 진행·전체 결과 공개 |
| `src/hooks/use-authenticated-sentence-capture.ts` | 계정별 원본 WAV 보관·복구와 서버 접수와 독립된 로컬 cursor |
| `src/components/recording-practice-session.tsx` | 기존 인증형 업로드·분석·복구; capturedRecording/background로 캡처 UI와 분리 |
| `src/hooks/use-practice-recorder.ts` | 기존 세션·로컬·승급 시험에 공통 연속 PCM 캡처 연결 |
| `src/lib/practice-capture.ts` | 실제 PCM 길이·형식 확인과 필요한 전체 녹음 연결·재생 경계 |

[진입 경로·상태·인증·인계 범위](../api/authenticated-sentence-practice.md)를 따른다. Direct 경로의 독립 batch 계약을 현재 인증형 연습 진입점으로 혼동하지 않는다.

### 영상 입술 분석 (2026-11-07)

| 파일 | 역할 |
| --- | --- |
| `src/lib/lip-analysis.ts` | VIDEO 지원·미디어 제한·revision별 동의 검증, 영상 업로드/등록/품질/선택 유스케이스 |
| `src/components/lip-processing-consent.tsx` | 현재 영상·음성 처리 목적과 필요한 동의 항목 표시 |
| `src/lib/canonical-lip.ts` | 입술 PROVISIONAL·선택 하위 점수와 측정 근거 계약 파싱 |
| `docs/contracts/lip-provisional-score-v1.md` | 서버 소유 종합점수와 입술 근거 소비 계약 |


`src/features/admin/components/member-role.tsx` composes role confirmation UI; `services.ts` validates role requests and receipts. See [management behavior](../admin-management-refinements.md).


`src/features/admin/popup-images.ts` validates image commands and receipts; `components/popup-image-panel.tsx` composes the attachment controls. `src/components/admin-home-popup.tsx` renders administrator notices after the existing premium offer. `popup-picture.tsx` handles signed-image rendering, failures and expiration. `src/lib/popup-image.ts` holds the image contract. [Behavior](../popup-images.md).
# 학습 기록 표시 보완

- `src/lib/history-visibility.ts`: 완료 목록의 분류 조회 중복 제거, 표시 정책 및 직접 분석 피드백 표시 판단.
- `scripts/history-visibility.test.ts`, `scripts/verify-history-visibility.mjs`: 분류 실패·재시도, 두 피드백 형식, 목록 진입 요청 수 및 상세 지연 조회 회귀 검증.
- `docs/history-visibility.md`: 학습 기록 표시와 요청 범위.

알림 UI: `src/lib/notification-link.ts`는 저장된 알림 경로를 실제 페이지로 변환하며, `src/features/admin/recipient-selection.ts`와 `components/campaign-recipient-picker.tsx`는 발송 대상 선택 정책과 활성 회원 체크박스 UI를 담당한다. 상세는 [알림 링크·회원 선택](../notification-links-and-recipients.md)을 따른다.
