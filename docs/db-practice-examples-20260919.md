# 예문·연습 데이터 DB 전환

> 운영 FE 배포 및 DB 예문 5개 등록 완료. 2026-09-19 TTS 자동 생성까지 연결했으며 청취 승인은 대기 중이다. [최신 운영 인계](tts-operations-20260919.md)를 따른다.

2026-09-19. 브랜치 `feat/db-practice-examples-tts`, 기준 `dev@b59135a`.

## 변경 결과

- 코스 예문: `api.examples.list(courseId, stepId)`가 반환하는 발행 DB 예문을 표시한다. 정적 35개 예문 선택, 제목 정규식에 의한 예문 분류, 가짜 `example:*` 콘텐츠 생성 경로를 제거했다.
- 코스 연습: 선택한 `practiceContentId`로 이동한다. 진입 시 예문 ID·코스·단계·revision·본문이 일치하는지 검증한다. 기존 세션 재개 시 sessionId를 예문 API에 전달해 서버가 고정한 revision을 사용한다.
- 내 문장: 서버 custom content API에 저장하고 GET으로 조회한 실제 콘텐츠 ID로 녹음·분석한다. 동일 본문 재시도에는 동일 Idempotency-Key를 사용한다. 입력 공백/줄바꿈은 서버 계약에 맞춰 공백으로 정규화한다. 녹음 시작 전에 서버 저장 안내를 표시한다.
- 예시 음성: 인증된 `/api/practice-examples/{id}/audio`의 MP3를 재생한다. JSON API와 토큰 refresh를 공유하고 MIME·빈 응답·2MB 상한을 검사한다. 문장 전환/언마운트 때 요청 중단 및 object URL 회수를 수행한다. 자동 기기 음성 대체는 제거했다.
- 기존 `/api/tts`는 DB ID용 backend proxy adapter로 남긴다. FE에서 Google에 직접 합성 요청하거나 정적 ID로 문장을 찾지 않는다.
- 일반 문장·뉴스·아나운서 목록은 기존 DB API 구현을 유지한다. 개발자 모드·별도 프로토타입의 가상 사용자·기록은 사용자 확정 범위에 따라 유지한다. 개발자 API의 신규 예문/사용자 문장 저장 호출은 가짜 성공 대신 실제 로그인 필요 오류를 반환한다.

정적 원문은 [DB 등록 후보 자료](migration/legacy-practice-examples.ts)로 보존했다. 앱에서 import하지 않는다. 실제 course/step/교육 revision과 매핑한 뒤 정식 발행 절차로 등록할 자료이며, 실행되는 seed나 운영 DB에 등록됐다는 증거가 아니다.

## API 계약

| 용도 | 호출 |
| --- | --- |
| 발행 예문 | `GET /api/courses/{courseId}/steps/{stepId}/practice-examples?sessionId=...` |
| 원본 콘텐츠 | `GET /api/practice-contents/{practiceContentId}` |
| 음성 | `GET /api/practice-examples/{exampleId}/audio` → 200 audio/mpeg |
| 내 문장 저장 | `POST /api/practice-contents/custom`, Idempotency-Key, `retention=SESSION_HISTORY`, `locale=ko-KR`, `learningFocus=PRONUNCIATION` |

## 전환 시 확인할 사항

백엔드 API와 실제 발행 예문이 준비되어 있어야 한다. 현재 서버는 해당 세트가 없으면 503을 반환한다. 그때 프론트는 정적 예문 대신 오류·재조회 안내를 표시한다. 빈 목록과 로딩 상태도 분리했다.

기존 정적 exampleId 링크나 무인증 `/api/tts` caller는 새 계약과 호환되지 않는다. 배포 시 클라이언트 새로고침과 코스에서 예문 다시 선택하기를 안내한다. 서버 TTS가 준비되지 않았으면 음성 재생은 사용 불가 안내를 보이며 문장 연습 선택은 가능하다.

운영 DB 삽입, RunPod 설치/합성, push/배포, 실제 로그인·녹음·브라우저 오디오 E2E는 이번 변경에서 실행하지 않았다. 자동 생성 outbox·worker·approval 테이블 설계는 VC-BE의 `docs/architecture/db-example-tts-automation-plan-20260919.md`에 있다.

## 검증

API·인증·예문 revision/본문 연결·분석 polling·코스 진도 테스트 44개 통과. API 계약 검사 62개와 token refresh 검사, TypeScript 검사, 변경 파일 ESLint 및 diff 공백 검사를 수행했다. Next production build(`next build --webpack`)도 성공했다.
