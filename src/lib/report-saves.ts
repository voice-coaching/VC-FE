import { getAuthenticatedUserId } from "./auth-session";
export type ReportSource = "SESSION" | "DIRECT";
export type ReportSave = {
  source: ReportSource;
  referenceId: string;
  saved: boolean;
};
// VC-BE stores analysis history, but has no report-saves endpoint. This is a
// device-local bookmark preference; it never deletes the server's recordings.
const key = () => {
  const userId = getAuthenticatedUserId();
  if (!userId || typeof window === "undefined")
    throw new Error("로그인 후 리포트를 다시 열어 주세요.");
  return `speakai.report-bookmarks.v1.${encodeURIComponent(userId)}`;
};

function read(storageKey: string): ReportSave[] {
  const raw = window.localStorage.getItem(storageKey);
  if (!raw) return [];
  const value: unknown = JSON.parse(raw);
  if (!Array.isArray(value))
    throw new Error("리포트 저장 정보를 확인할 수 없습니다.");
  return value.filter(
    (item): item is ReportSave =>
      item !== null &&
      typeof item === "object" &&
      (item.source === "SESSION" || item.source === "DIRECT") &&
      typeof item.referenceId === "string" &&
      typeof item.saved === "boolean",
  );
}

export const reportSaves = {
  list: async () => read(key()),
  get: async (source: ReportSource, id: string | number): Promise<ReportSave> =>
    read(key()).find(
      (item) => item.source === source && item.referenceId === String(id),
    ) ?? { source, referenceId: String(id), saved: true },
  set: async (source: ReportSource, id: string | number, saved: boolean) => {
    const storageKey = key();
    const referenceId = String(id);
    const next = read(storageKey).filter(
      (item) => item.source !== source || item.referenceId !== referenceId,
    );
    const choice = { source, referenceId, saved };
    next.push(choice);
    // Let storage failures reach the dialog. Never claim an unsaved choice stuck.
    window.localStorage.setItem(storageKey, JSON.stringify(next));
    return choice;
  },
};
