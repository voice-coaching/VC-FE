# 디렉토리 문서 - VC-FE

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
