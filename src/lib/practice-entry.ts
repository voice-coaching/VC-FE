import type { Id } from "./api/types";
import { readSentenceAdmissions } from "./sentence-sequence";
import type { SentenceAnalysisAdmission } from "./sentence-sequence";

export function practiceDetailHref(id: Id, returnTo: string) {
  return `/practice/${encodeURIComponent(String(id))}?${new URLSearchParams({ returnTo })}`;
}

/** Only URLs marked by an admitted run may recover the device's sequence cache. */
export function sentenceResumeRequested(params: Pick<URLSearchParams, "get">) {
  return params.get("resumeSequence") === "1";
}

export function practiceStartsImmediately(
  params: Pick<URLSearchParams, "get">,
) {
  return (
    params.get("start") === "1" ||
    sentenceResumeRequested(params) ||
    Boolean(params.get("exampleId") || params.get("sessionId"))
  );
}

export function initialSentenceAdmissions(
  resumeRequested: boolean,
  saved: unknown,
  count: number,
  active?: (SentenceAnalysisAdmission | null)[],
) {
  if (active) return readSentenceAdmissions(active, count);
  return resumeRequested ? readSentenceAdmissions(saved, count) : [];
}

export function admittedSequenceHref(currentHref: string) {
  const url = new URL(currentHref);
  url.searchParams.set("resumeSequence", "1");
  return `${url.pathname}${url.search}${url.hash}`;
}
