import { createHttpClient } from "./api/client";
const client = createHttpClient("/api/backend");
export type ReportSource = "SESSION" | "DIRECT";
export type ReportSave = {
  source: ReportSource;
  referenceId: string;
  saved: boolean;
};
const path = (source: ReportSource, id: string | number) =>
  `/api/users/me/report-saves/${source}/${encodeURIComponent(String(id))}`;
export const reportSaves = {
  list: () => client.request<ReportSave[]>("/api/users/me/report-saves"),
  get: (source: ReportSource, id: string | number) =>
    client.request<ReportSave>(path(source, id)),
  set: (source: ReportSource, id: string | number, saved: boolean) =>
    client.request<ReportSave>(path(source, id), {
      method: "PUT",
      body: { saved },
    }),
};
