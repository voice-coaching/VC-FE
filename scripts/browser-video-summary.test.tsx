import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  BrowserVideoClient,
  browserVideoSha256,
  type BrowserVideoJob,
  type BrowserVideoResult,
} from "../src/lib/api/browser-video";
import { saveAccessToken } from "../src/lib/api/client";
import { browserVideoPresentation } from "../src/lib/browser-video-presentation";
import { LipScoreSummary } from "../src/components/lip-score-summary";
import { readFileSync } from "node:fs";
import ts from "typescript";

// Use the real feedback component; only CSS and Next's image renderer are stubbed for Node.
const AnalysisSummary = new Function(
  "React",
  "Image",
  "styles",
  "const { useId, useState } = React;\n" +
    ts.transpile(
      readFileSync("src/components/analysis-summary.tsx", "utf8")
        .replace(/^import.*;$/gm, "")
        .replace("export function", "function"),
      { target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React },
    ) +
    "\nreturn AnalysisSummary;",
)(
  React,
  (props: React.ImgHTMLAttributes<HTMLImageElement>) =>
    React.createElement("img", props),
  {},
);

const jobId = "10000000-0000-4000-8000-000000000001";
const executionId = "10000000-0000-4000-8000-000000000002";
const attempt = "10000000-0000-4000-8000-000000000003";
function result(): BrowserVideoResult {
  return {
    schemaVersion: "voice-coaching.browser-video-summary.v1",
    jobId,
    executionId,
    clientRequestId: attempt,
    status: "COMPLETED",
    failure: null,
    score: {
      overallScore: 76.1,
      validity: "RUBRIC_COMPUTED",
      reason: "EVIDENCE_BOUND_PRACTICE_SCORE",
    },
    coaching: {
      feedback: "* 입술 → 안내된 소리를 읽으며 입모양을 확인하세요.",
    },
    visual: {
      score: 51,
      scoreKind: "PROVISIONAL",
      scoreScope: "ASSESSED_PHONES_ONLY",
    },
  };
}

for (const scenario of [
  "success",
  "wrong-digest",
  "wrong-etag",
  "wrong-attempt",
  "wrong-job",
  "wrong-execution",
  "zero",
  "null-lip",
  "new-score-metadata",
  "null-overall",
  "long-feedback",
  "failed-feedback",
  "wrong-score",
] as const) {
  test(`summary ${scenario}: uses its own digest and preserves attempt binding`, async () => {
    const originalFetch = globalThis.fetch;
    saveAccessToken("login-fixture");
    const value = result();
    if (scenario === "wrong-attempt") value.clientRequestId = jobId;
    if (scenario === "wrong-job") value.jobId = attempt;
    if (scenario === "wrong-execution") value.executionId = attempt;
    if (scenario === "zero") {
      value.score.overallScore = 0;
      value.visual.score = 0;
    }
    if (scenario === "null-lip") {
      value.visual.score = null;
      value.visual.scoreKind = "NONE";
      value.visual.scoreScope = "UNAVAILABLE";
    }
    if (scenario === "new-score-metadata") {
      value.score.validity = "NEW_AI_VALIDITY";
      value.score.reason = "NEW_AI_REASON";
    }
    if (scenario === "null-overall") {
      value.score.overallScore = null;
      value.score.validity = "UNSCORABLE";
      value.score.reason = "INSUFFICIENT_AUDIO";
    }
    if (scenario === "long-feedback")
      value.coaching.feedback = "가".repeat(4001);
    if (scenario === "failed-feedback") {
      value.status = "FAILED";
      value.failure = { code: "EXECUTION_INTERRUPTED" };
      value.score.overallScore = null;
      value.score.validity = "NOT_AVAILABLE";
      value.score.reason = "EXECUTION_INTERRUPTED";
    }
    if (scenario === "wrong-score") value.score.overallScore = 101;
    const raw = new TextEncoder().encode(JSON.stringify(value));
    const pin = await browserVideoSha256(raw);
    let summaryGets = 0;
    const source = {
      sha256: "a".repeat(64),
      fileSizeBytes: 100,
      mimeType: "video/mp4" as const,
    };
    globalThis.fetch = async (input, options) => {
      const url = String(input);
      if (url.includes("video-analysis-upload-grants"))
        return Response.json({
          result: true,
          data: {
            schemaVersion: "voice-coaching.browser-video-grant.v1",
            aiBaseUrl: "https://ai.example",
            jobsPath: "/browser/v1/video-analysis-jobs",
            grantToken: "fixture-grant",
            expiresAt: Math.floor(Date.now() / 1000) + 300,
            metadata: {
              clientRequestId: attempt,
              scriptText: "시험 문장",
              contentId: 1,
              source,
            },
          },
        });
      assert.equal(
        url,
        `https://ai.example/browser/v1/video-analysis-jobs/${jobId}/summary`,
      );
      assert.equal(options?.method, "GET");
      assert.equal(options?.credentials, "omit");
      assert.equal(
        (options?.headers as Record<string, string>).Authorization,
        "Bearer fixture-grant",
      );
      summaryGets++;
      return new Response(raw, {
        headers: {
          "X-Result-SHA256": scenario === "wrong-digest" ? "b".repeat(64) : pin,
          ETag: scenario === "wrong-etag" ? '"bad"' : `"${pin}"`,
        },
      });
    };
    try {
      const client = new BrowserVideoClient(
        {
          sessionId: 1,
          clientRequestId: attempt,
          source,
          scriptText: "시험 문장",
          contentId: 1,
        },
        { jobId, executionId, sequence: 1 },
      );
      // The retained full-result digest intentionally differs from the summary.
      const job = {
        jobId,
        executionId,
        clientRequestId: attempt,
        status: value.status,
        resultSha256: "c".repeat(64),
      } as BrowserVideoJob;
      if (scenario.startsWith("wrong-"))
        await assert.rejects(client.result(job, new AbortController().signal));
      else {
        const actual = await client.result(job, new AbortController().signal);
        assert.deepEqual(actual, value);
        assert.equal(
          browserVideoPresentation(actual).overallScore,
          value.score.overallScore,
        );
        assert.equal(
          browserVideoPresentation(actual).summaryFeedback,
          value.coaching.feedback,
        );
      }
      assert.equal(summaryGets, 1);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
}

test("lip summary displays partial zero and omits all phone diagnostics", () => {
  const visual = {
    score: 0,
    scoreKind: "PROVISIONAL",
    scoreScope: "ASSESSED_PHONES_ONLY",
  } as const;
  const html = renderToStaticMarkup(<LipScoreSummary visual={visual} />);
  assert.match(html, /0점 \/ 100점/);
  assert.match(html, /관찰된 부분 기준/);
  assert.doesNotMatch(html, /발음별|프레임|평가 정보 부족|음소/);
});

test("missing lip score keeps valid overall score and feedback", () => {
  const value = result();
  value.visual = { score: null, scoreKind: "NONE", scoreScope: "UNAVAILABLE" };
  const view = browserVideoPresentation(value);
  assert.equal(view.overallScore, 76.1);
  assert.equal(view.summaryFeedback, value.coaching.feedback);
  assert.match(
    renderToStaticMarkup(<LipScoreSummary visual={value.visual} />),
    /점수를 제공하기 어려워요/,
  );
});

test("video feedback remains literal text including markup and line breaks", () => {
  const value = result();
  const feedback =
    "  * 입술 → **안내**를 읽어 보세요.\n\n<script>example</script>  ";
  value.coaching.feedback = feedback;
  const view = browserVideoPresentation(value);
  assert.equal(view.summaryFeedback, feedback);
  const html = renderToStaticMarkup(
    <AnalysisSummary text={view.summaryFeedback} plainText />,
  );
  assert.match(html, /  \* 입술 → \*\*안내\*\*를 읽어 보세요\.\n\n/);
  assert.match(html, /&lt;script&gt;example&lt;\/script&gt;  /);
  assert.doesNotMatch(html, /더 보기|<strong>|<script>/);
});
