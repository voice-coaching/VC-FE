# Direct RunPod independent voice practice

2026-10-05 implementation, not deployed. Build flags: `NEXT_PUBLIC_DIRECT_ANALYSIS_ENABLED=true` and an absolute HTTPS `NEXT_PUBLIC_DIRECT_ANALYSIS_ORIGIN`. Defaults OFF. These are public configuration only; never put service/API secrets in NEXT_PUBLIC variables.

The new client sends raw prepared mono 16kHz 16bit PCM WAV directly to RunPod with base64 JSON metadata. It uses credentials=omit and no Authorization header or AWS proxy. No gateway or user authentication is added to RunPod. Upload, status, SSE, cancellation and recovery all use that public origin.

Each attempt has a UUID stored before submission. Lost POST responses are recovered by the same clientAttemptId; reconnection never automatically starts new inference. The random history-link value is also saved before submission; RunPod receives only its SHA256. Local storage is scoped by current account/content and the practice component remounts when authentication changes.

SSE completion contains the validated result. The screen renders score breakdown, correction instructions and scoped evidence IDs/MFA positions immediately. Background history linking uses the existing authenticated AWS client only after result readiness. AWS/B2 errors do not replace a visible result with an analysis failure. If the browser closes before linking, reentering the same attempt resumes linking; deleting browser storage can lose that link value.

`DirectHistory` adds an independent analysis section to MyPage history via `/api/direct-analysis-history`. It displays saved results without starting analysis. It is distinct from training sessions, course completion and streak aggregates.

New independent practice uses the direct component. Requests carrying courseId/courseStepId/titleExamId or an existing sessionId keep their original flow; there is no automatic retry through AWS when direct submission fails. The existing course/exam completion contract is not changed.

Changed paths: `src/lib/direct-analysis.ts`, `src/components/direct-practice-session.tsx`, `src/components/direct-analysis-result.tsx`, `src/components/direct-history.tsx`, `src/components/practice-session.tsx`, `src/routes/mypage/history.tsx`. `canonical-analysis.ts` exports the existing candidate validator so direct results preserve evidence constraints.

TypeScript noEmit and formatting checks passed. No browser automation, regression tests, Vercel deployment or inference QA ran. RunPod must have approved Native artifacts and working HTTPS/CORS/SSE before enabling the build flag. Native DRAFT changes inherited in this worktree are not an approved production model release.
