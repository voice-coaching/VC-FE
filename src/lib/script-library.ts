import { createHttpClient } from "./api/client";
import type { PracticeContent } from "./api";
const client = createHttpClient("/api/backend");
const base = "/api/users/me/script-library";
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
    client.request<PracticeContent>(id == null ? base : `${base}/${id}`, {
      method: id == null ? "POST" : "PUT",
      body: input,
      headers: { "Idempotency-Key": key },
    }),
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
