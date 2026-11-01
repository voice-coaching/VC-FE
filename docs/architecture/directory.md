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
| `src/hooks/use-sentence-batch.ts` | 접수 orchestration, 계정별 복구, polling, 이력 연결 |
| `src/lib/sentence-batch-api.ts` | 익명 AI HTTP client와 결과 schema·identity 검증 |
| `src/lib/sentence-history-links.ts` | 계정별 미완료 이력 연결 claim 영속화·재시도 |
| `src/lib/sentence-recordings.ts` | IndexedDB의 정확한 WAV bytes 보관·재시도 |

UI → hook → HTTP/storage adapter 방향으로 연결한다. 원본 recorder lifecycle은 기존 useAudioRecorder를 사용하며, 문장 완료마다 실제 stop/flush한다. 상태·timeout·실패·저장 흐름은 [계약](../api/sentence-practice-batches.md)을 따른다.
