# DB 예문·TTS 운영 인계

관측: 2026-09-19 16:46 KST. FE 운영 revision `dda4cf9104f41c151189fde486dd37294f6dc07e` (PR 23/24), BE 운영 revision `87d5a9b6fb960aaca569eff16a9bbcb72c9d7113` (PR 85).

프론트는 DB 발행 예문 목록의 ID·본문·practiceContentId·revision을 사용한다. 코스 301의 연습 단계 303에 예문 `course301-step303-r1-1`~`5`, 콘텐츠 ID 3~7이 등록돼 있다. 그 외 정적 원문은 docs/migration에 보존했으며 실제 코스 매핑 없이 임의 등록하지 않았다.

재생 경로는 `/api/backend/api/practice-examples/{exampleId}/audio`다. 사용자 JWT와 기존 refresh를 사용하고 성공 응답은 `audio/mpeg` MP3 바이트로 처리한다. 프론트는 RunPod를 직접 호출하지 않으며 TTS 서비스 토큰을 보유하지 않는다. `/api/tts` 호환 route도 DB ID용 backend adapter다.

AWS→nginx→전용 SSH 터널→RunPod Melo 합성 연결을 적용했다. 기존 예문 5개 모두 첫 시도에 생성·검증·DB 저장됐고 새 예문은 DB outbox/worker로 생성된다. 화면에서 재생을 눌러 합성을 시작하는 방식이 아니다.

**음성 생성과 공개 승인은 별개다. 현재 검수 기록은 0건이다.** 승인되지 않은 음성은 재생 API에서 사용 불가로 처리한다. 503을 생성 성공이나 곧 준비된다는 약속으로 표시하지 않고, 무한 재시도·기기 음성 자동 대체를 하지 않는다. 승인 후 실제 로그인 상태의 브라우저 재생 검증이 남아 있다.

운영 설정·nginx·rollback 정본은 VC-BE `docs/architecture/example-tts-operations-20260919.md`다. FE에는 서버 전용 토큰이나 모델 설정을 추가하지 않았다. 이번 작업의 FE 변경은 문서뿐이며 추가 FE 배포는 하지 않았다.
