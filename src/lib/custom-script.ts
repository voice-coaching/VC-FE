/** Local prototype segmentation; keeps decimals and the user's original text. */
export function splitCustomScript(script: string): string[] {
  const segmenter = new Intl.Segmenter("ko", { granularity: "sentence" });
  return script
    .split(/\n+/)
    .flatMap((line) =>
      [...segmenter.segment(line)]
        .map(({ segment }) => segment.trim())
        .filter(Boolean),
    );
}
