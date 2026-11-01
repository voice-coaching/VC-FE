import { z } from "zod";
import { linkDirectHistory } from "./direct-analysis";

const entrySchema = z.object({
  jobId: z.string().uuid(),
  historyClaim: z.string().min(1),
  conflict: z.boolean(),
});
type Entry = z.infer<typeof entrySchema>;

/** Persist claims separately so a new practice cannot discard unsynchronized history. */
export function sentenceHistoryLinks(accountId: string) {
  const key = `sentence-history-links:v1:${accountId}`;
  const read = (): Entry[] =>
    z.array(entrySchema).parse(JSON.parse(localStorage.getItem(key) ?? "[]"));
  return {
    enqueue(jobIds: string[], historyClaim: string): void {
      const entries = read();
      for (const jobId of jobIds) {
        const existing = entries.find((entry) => entry.jobId === jobId);
        if (existing && existing.historyClaim !== historyClaim)
          throw new Error("이력 연결 정보가 달라요.");
        if (!existing) entries.push({ jobId, historyClaim, conflict: false });
      }
      localStorage.setItem(key, JSON.stringify(entries));
    },
    async flush(signal: AbortSignal): Promise<void> {
      const pending = read().filter((entry) => !entry.conflict);
      for (const entry of pending) {
        if (signal.aborted) return;
        try {
          const result = await linkDirectHistory(
            entry.jobId,
            entry.historyClaim,
            signal,
          );
          if (signal.aborted) return;
          if (result.state === "SAVED")
            localStorage.setItem(
              key,
              JSON.stringify(read().filter((row) => row.jobId !== entry.jobId)),
            );
          else if (result.state === "CONFLICT")
            localStorage.setItem(
              key,
              JSON.stringify(
                read().map((row) =>
                  row.jobId === entry.jobId ? { ...row, conflict: true } : row,
                ),
              ),
            );
        } catch {
          if (signal.aborted) return;
        }
      }
    },
    status(jobIds: string[]): string {
      if (!jobIds.length) return "NONE";
      const entries = read().filter((entry) => jobIds.includes(entry.jobId));
      return entries.some((entry) => entry.conflict)
        ? "CONFLICT"
        : entries.length
          ? "RETRYING"
          : "SAVED";
    },
  };
}
