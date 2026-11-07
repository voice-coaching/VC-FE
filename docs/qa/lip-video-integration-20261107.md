# 영상 입술 분석 연결 검증 — 2026-11-07

## Summary

최신 main `53842c95ab088b594ef855ec962802b17ce16545`를 기준으로 실제 영상 업로드·정책별 동의·입술 응답 표시를 구현했다.
공유 reader 패치의 PROVISIONAL/COMPARE_REFERENCE/선택 subScores/nullable calibration 계약을 반영하고,
소비 계약에 명시된 subScore status와 숫자/null 관계도 검증한다. Frontend는 종합점수를 재계산하지 않는다.

자동 회귀 검사 43개, 변경 파일 ESLint, TypeScript, 프로덕션 빌드가 통과했다.
브라우저에서는 가상 카메라의 실제 MediaRecorder Blob과 모의 Backend/스토리지 API를 사용했다.
이 검증은 운영 Backend·AI·DB 확인을 뜻하지 않는다.

## Environment

- URL: `http://127.0.0.1:3107/lip-practice`
- Viewport: 모바일 390×844, 데스크톱 1280×900
- Browser: Chromium headless, 가상 카메라/마이크
- Browser plugin not available: 저장소가 사용하는 Playwright 방식을 따르되, 설치된 공용 런타임의 Playwright와 기존 Chromium을 사용했다. 의존성/lockfile은 변경하지 않았다.
- 실행: 저장소 `npm run dev -- --webpack --hostname 127.0.0.1 --port 3107`. 별도 worktree의 의존성 symlink 때문에 webpack 모드로 검사했다.
- 모든 사용자·녹음·분석 응답은 모의 데이터다. 실제 사용자 녹음·자격 증명·운영 inference는 사용하지 않았다.

## Changes Verified

| 경계 | 확인한 내용 |
| --- | --- |
| 캡처/업로드 | 브라우저가 생성한 video/mp4 bytes(최초 전체 촬영 약 1.1MB), 정규화 MIME, 동일 파일 크기·길이 등록, 별도 PCM 없음 |
| 정책 | VIDEO 미지원 시 업로드 0회, 이전 audio-only 로컬 동의 무시, 필요한 두 동의 전 제출 비활성, 정책 v1→v2 변경 시 신규 요청 0회 및 재동의 후 1회 전송 |
| 동의 분리 | recording의 영상 true/revision 필드와 analyze의 음성 accepted/policyRevision body 분리 |
| 결과 | 73.6점, 0점, null, 하위 항목 없는 과거 응답, PROVISIONAL·calibrationRevision=null·COMPARE_REFERENCE 표시 |
| 국소 근거 | 전체 입술 점수 null이어도 전체 점수와 위치별 0점·측정 근거 유지, subScore null을 0으로 바꾸지 않음 |
| 안전한 상태 전이 | 실제 업로드 중 대기 중단 시 등록/analyze 0회, 동일 촬영본 이중 analyze 방지, VIDEO가 AUDIO_ONLY로 등록되면 선택 중단 |
| 결과 정합성 | 다른 recordingId/executionId 거부, 기존 v6 헤더·v3 조회 유지, 실패/대기/거절 결과에 숫자 입술 점수 숨김 |
| 화면 경계 | 카메라 외의 영상 피드백 숨김 회귀 검사 유지 |

## Checks

| Check | Result | Evidence |
| --- | --- | --- |
| Page Identity | Pass | `/lip-practice`, `입 모양 연습 · SpeakAI` |
| Blank Page | Pass | 촬영 안내, 권한, 촬영 확인, 동의, 결과 단계 렌더링 |
| Framework Overlay | Pass | 최종 실행에 오류 overlay 없음 |
| Console | Pass | 최종 정상/0/null/과거 응답/정책 변경/취소 실행의 console error와 pageerror 없음 |
| Screenshot Evidence | Pass | 모바일 동의·점수·국소 피드백 및 데스크톱 배치 확인 |
| Interaction Proof | Pass | 가상 카메라 녹화 → 두 동의 → 실제 MP4 PUT → 등록/선택 → analyze 1회 → 서버 점수/피드백 표시 |

촬영 카운트다운 숫자 0과 문장 index 0이 같은 sibling key를 사용하던 경고를 재현해 key prefix를 분리했다.
수정 후 동일 흐름에서 콘솔 오류가 사라졌다. 업로드 직전 정책 변경·접수 중단·중단 버튼·0/null·과거 응답을 별도 실행했다.
모바일 동의 화면의 버튼·체크박스가 잘리지 않고, 결과의 긴 설명과 위치별 근거가 스크롤로 확인됨을 캡처에서 검수했다.

## Commands

```sh
node --import tsx --test src/lib/canonical-lip.test.ts src/lib/lip-analysis.test.ts src/lib/lip-practice.test.ts scripts/video-feedback-visibility.test.tsx scripts/lip-camera.test.ts scripts/recording-upload.test.ts scripts/canonical-completion.test.ts scripts/canonical-transport.test.ts
npx tsc --noEmit
npm run build -- --webpack
```

위 테스트 43개 전체 통과. 변경한 TS/TSX 파일을 지정한 ESLint 및 `git diff --check`도 통과했다.
임시 Playwright 스크립트/캡처/요청 증거는 `/private/tmp/lip-video-qa/`에 두고 저장소에 커밋하지 않는다.
주요 시나리오는 normal, policy, zero, historical, disabled, null, cancel 7개다.

## Remaining Risk

실제 로그인 소유권·영상 저장·서버 PCM 정규화·AI 내부 요청·운영 공개 조회·DB 저장은 Backend/AI 운영자와 확인해야 한다.
운영 VIDEO 접수를 활성화하거나 배포 성공을 주장하지 않는다. 물리 Android/iOS 카메라의 코덱·마이크·권한 조합은 별도 기기 검증이 필요하다.
기존 서버가 영상 등록을 AUDIO_VISUAL로 반환하지 않거나 새 public 필드를 전달하지 못하면 분석을 시작할 수 없다.
향후 인앱 Browser 연동을 설치하면 화면·콘솔·동작 증거를 같은 도구에서 확인하기 쉽다.

최종 원격 확인 중 main에 추가된 승급 시험 보완(`53842c9`)도 fast-forward로 포함했다.
위 43개와 `scripts/title-exam-api.test.ts`, `scripts/title-exam-resume.test.ts`의 20개를 함께 실행해 **63/63 통과**했고,
갱신된 main 기준 프로덕션 빌드도 다시 통과했다.
