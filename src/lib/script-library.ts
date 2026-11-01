import { createHttpClient } from "./api/client";
import type { PracticeContent } from "./api";

const client = createHttpClient("/api/backend");
const base = "/api/users/me/script-library";
export const SCRIPT_LIBRARY_AVAILABLE = true;
export const SCRIPT_LIBRARY_UNAVAILABLE_MESSAGE =
  "보관함에 연결하지 못했어요. 잠시 후 다시 시도해 주세요.";
export type ScriptTopic = { id: number; name: string };
export type ScriptLibrary = {
  items: PracticeContent[];
  topics: ScriptTopic[];
  assignments: Record<string, string>;
};
export const scriptLibrary = {
  list: () => client.request<ScriptLibrary>(base),
  save: (
    id: string | number | null,
    input: { title: string; scriptText: string; topicId: number | null },
    key: string,
  ) =>
    id == null
      ? client.request<PracticeContent>(base, {
          method: "POST",
          body: input,
          headers: { "Idempotency-Key": key },
        })
      : client.request<PracticeContent>(
          `${base}/${encodeURIComponent(String(id))}`,
          {
            method: "PUT",
            body: input,
            headers: { "Idempotency-Key": key },
          },
        ),
  remove: (ids: (string | number)[]) =>
    client.request<void>(`${base}/delete`, {
      method: "POST",
      body: { ids: ids.map(Number) },
    }),
  createTopic: (name: string) =>
    client.request<ScriptTopic>(`${base}/topics`, {
      method: "POST",
      body: { name },
    }),
  renameTopic: (id: number, name: string) =>
    client.request<ScriptTopic>(`${base}/topics/${id}`, {
      method: "PUT",
      body: { name },
    }),
  removeTopic: (id: number) =>
    client.request<void>(`${base}/topics/${id}`, { method: "DELETE" }),
};
