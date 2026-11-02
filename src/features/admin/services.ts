import { z } from "zod";
import { adminApi } from "./api";
import { getAuthSessionVersion } from "@/lib/api/client";
import type {
  Audio,
  AudioIntent,
  AudioRegistration,
  Content,
  ContentDeletion,
  Notice,
  Campaign,
  Popup,
} from "./types";

const required = (label: string, max: number) =>
  z
    .string()
    .trim()
    .min(1, `${label} 입력이 필요합니다.`)
    .max(max, `${label}은 ${max}자 이하입니다.`);
const reasonSchema = required("작업 사유", 500);
const linkSchema = z.enum(["/home", "/notifications", "/mypage"]);
const numberSchema = (label: string, min: number, max: number) =>
  z.coerce
    .number()
    .int(`${label}은 정수로 입력해 주세요.`)
    .min(min, `${label} 최솟값은 ${min}입니다.`)
    .max(max, `${label} 최댓값은 ${max}입니다.`);
const lines = (value: string) =>
  value
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);
const text = (data: FormData, key: string) => String(data.get(key) ?? "");
export function validId(value: string): number {
  const id = Number(value);
  if (!/^[1-9]\d*$/.test(value) || !Number.isSafeInteger(id))
    throw new Error("올바른 항목 ID가 아닙니다.");
  return id;
}
export function localDateTime(value?: string): string {
  const date = value ? new Date(value) : new Date();
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 16);
}
export function offsetTime(value: string): string {
  const date = new Date(value);
  if (!value || !Number.isFinite(date.getTime()))
    throw new Error("시작·게시 시각을 확인해 주세요.");
  return date.toISOString();
}
export function durationDays(popup: Popup): number {
  return Math.round(
    (Date.parse(popup.endsAt) - Date.parse(popup.startsAt)) / 86_400_000,
  );
}
export function parseMemberIds(value: string): number[] {
  const values = value.trim() ? value.trim().split(/[\s,]+/) : [];
  const ids = values.map(validId);
  if (ids.length > 500 || new Set(ids).size !== ids.length)
    throw new Error("대상은 중복 없이 최대 500명까지 지정해 주세요.");
  return ids;
}
export function identifierValue(value: string): string {
  const normalized = value.trim();
  if (
    !/^[1-9]\d{0,18}$/.test(normalized) &&
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      normalized,
    )
  )
    throw new Error("회원 번호 또는 표준 분석 UUID를 입력해 주세요.");
  return normalized;
}
export async function saveContent(
  data: FormData,
  current?: Content,
): Promise<Content> {
  const content = z
    .object({
      type: z.enum(["NEWS", "SENTENCE", "ANNOUNCER", "CLASS_PRACTICE"]),
      focus: z.enum(["PRONUNCIATION", "INTONATION", "BOTH"]),
      category: required("카테고리", 100),
      difficulty: z.enum(["BEGINNER", "INTERMEDIATE", "ADVANCED"]),
      title: required("제목", 255),
      description: z.string().max(1000),
      scriptText: required("연습 문장", 10000),
      targetPronunciations: z.array(required("발음 목표", 200)).max(100),
      estimatedSeconds: numberSchema("예상 시간", 1, 3600),
    })
    .parse({
      type: text(data, "type"),
      focus: text(data, "focus"),
      category: text(data, "category"),
      difficulty: text(data, "difficulty"),
      title: text(data, "title"),
      description: text(data, "description"),
      scriptText: text(data, "scriptText"),
      targetPronunciations: lines(text(data, "targets")),
      estimatedSeconds: text(data, "seconds"),
    });
  const reason = reasonSchema.parse(text(data, "reason"));
  if (current) {
    if (content.type !== current.type)
      throw new Error("등록된 콘텐츠의 유형은 변경할 수 없습니다.");
    return adminApi.edit(`/contents/${current.id}`, {
      version: current.version,
      content,
      reason,
    });
  }
  return adminApi.create("/contents", { content, reason });
}
/** Delete only the selected version and require a matching server receipt before navigating. */
export async function deleteContent(
  current: Content,
  reason: string,
): Promise<ContentDeletion> {
  const receipt = await adminApi.remove<unknown>(`/contents/${current.id}`, {
    version: current.version,
    reason: reasonSchema.parse(reason),
  });
  return z
    .object({
      id: z.literal(current.id),
      version: z.number().int().min(current.version),
      deletedAt: z.string().datetime({ offset: true }),
    })
    .parse(receipt);
}
export function publication(
  content: Content,
  status: "PUBLISHED" | "HIDDEN",
  reason: string,
): Promise<Content> {
  return adminApi.edit(`/contents/${content.id}/publication`, {
    version: content.version,
    status,
    reason: reasonSchema.parse(reason),
  });
}
export async function saveNotice(
  data: FormData,
  current?: Notice,
): Promise<Notice> {
  const raw = z
    .array(
      z.object({
        title: required("구역 제목", 200),
        paragraphsText: z.string(),
      }),
    )
    .min(1)
    .max(30)
    .parse(JSON.parse(text(data, "sections")));
  const sections = raw.map((section) => ({
    title: section.title,
    paragraphs: z
      .array(required("문단", 4000))
      .min(1, "본문을 입력해 주세요.")
      .max(50)
      .parse(lines(section.paragraphsText)),
  }));
  if (
    sections.reduce(
      (total, section) =>
        total + section.paragraphs.reduce((sum, p) => sum + p.length, 0),
      0,
    ) > 30000
  )
    throw new Error("전체 본문은 30,000자 이하입니다.");
  const notice = {
    title: required("제목", 200).parse(text(data, "title")),
    summary: required("요약", 500).parse(text(data, "summary")),
    sections,
    pinned: data.has("pinned"),
    published: data.has("published"),
    publishedAt: offsetTime(text(data, "publishedAt")),
  };
  const reason = reasonSchema.parse(text(data, "reason"));
  return current
    ? adminApi.edit(`/notices/${current.id}`, {
        version: current.version,
        notice,
        reason,
      })
    : adminApi.create("/notices", { notice, reason });
}
export function answerInquiry(
  id: number,
  version: number,
  answer: string,
  reason: string,
) {
  return adminApi.edit(`/inquiries/${id}/answer`, {
    version,
    answer: required("답변", 4000).parse(answer),
    reason: reasonSchema.parse(reason),
  });
}
export function transitionInquiry(
  id: number,
  version: number,
  status: "IN_PROGRESS" | "CLOSED",
  reason: string,
) {
  return adminApi.edit(`/inquiries/${id}/status`, {
    version,
    status,
    reason: reasonSchema.parse(reason),
  });
}
export function createCampaign(data: FormData): Promise<Campaign> {
  const audience = z
    .enum(["ALL_ACTIVE", "SELECTED_USERS"])
    .parse(text(data, "audience"));
  const userIds =
    audience === "ALL_ACTIVE" ? [] : parseMemberIds(text(data, "userIds"));
  if (audience === "SELECTED_USERS" && !userIds.length)
    throw new Error("알림을 받을 회원 번호를 선택해 주세요.");
  return adminApi.create("/notification-campaigns", {
    audience,
    kind: z.enum(["GENERAL", "PLAN"]).parse(text(data, "kind")),
    title: required("제목", 200).parse(text(data, "title")),
    body: required("본문", 1000).parse(text(data, "body")),
    deepLink: linkSchema.parse(text(data, "deepLink")),
    userIds,
    reason: reasonSchema.parse(text(data, "reason")),
  });
}
export function dispatchCampaign(
  campaign: Campaign,
  reason: string,
): Promise<Campaign> {
  return adminApi.create(`/notification-campaigns/${campaign.id}/dispatch`, {
    version: campaign.version,
    reason: reasonSchema.parse(reason),
  });
}
export function savePopup(data: FormData, current?: Popup): Promise<Popup> {
  const popup = {
    title: required("제목", 200).parse(text(data, "title")),
    body: required("본문", 1000).parse(text(data, "body")),
    deepLink: text(data, "deepLink")
      ? linkSchema.parse(text(data, "deepLink"))
      : null,
    priority: numberSchema("우선순위", 0, 100).parse(text(data, "priority")),
    startsAt: offsetTime(text(data, "startsAt")),
    durationDays: numberSchema("노출 일수", 1, 365).parse(
      text(data, "durationDays"),
    ),
    enabled: data.has("enabled"),
  };
  const reason = reasonSchema.parse(text(data, "reason"));
  return current
    ? adminApi.edit(`/popups/${current.id}`, {
        version: current.version,
        popup,
        reason,
      })
    : adminApi.create("/popups", { popup, reason });
}
function assertSession(version: number) {
  if (getAuthSessionVersion() !== version)
    throw new Error("로그인 계정이 변경되어 업로드를 중단했습니다.");
}
export type AudioUploadAttempt = {
  contentId: number;
  registration: AudioRegistration;
  intent: AudioIntent;
  file: File;
  session: number;
};
function uploadTarget(intent: AudioIntent): URL {
  const url = new URL(intent.uploadUrl);
  if (url.protocol !== "https:" || url.username || url.password)
    throw new Error("업로드 URL을 확인하지 못했습니다.");
  for (const name of Object.keys(intent.requiredHeaders)) {
    if (
      [
        "authorization",
        "cookie",
        "proxy-authorization",
        "host",
        "content-length",
      ].includes(name.toLowerCase())
    )
      throw new Error("업로드 헤더를 확인하지 못했습니다.");
  }
  return url;
}
export async function uploadAnnouncerAudio(
  content: Content,
  file: File,
  data: FormData,
  onIssued: (attempt: AudioUploadAttempt) => void,
): Promise<Audio> {
  const session = getAuthSessionVersion();
  const extension = file.name.split(".").at(-1)?.toLowerCase();
  const mime =
    extension === "mp3"
      ? "audio/mpeg"
      : extension === "m4a"
        ? "audio/mp4"
        : null;
  if (!mime || file.size < 1 || file.size > 20 * 1024 * 1024)
    throw new Error("20MiB 이하의 MP3 또는 AAC M4A 파일을 선택해 주세요.");
  const reason = reasonSchema.parse(text(data, "reason")),
    speakerName = required("화자 이름", 255).parse(text(data, "speakerName"));
  const digest = await crypto.subtle.digest(
    "SHA-256",
    await file.arrayBuffer(),
  );
  const sha256 = Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
  assertSession(session);
  const intent = await adminApi.create<AudioIntent>(
    `/contents/${content.id}/reference-audios/upload-url`,
    {
      version: content.version,
      fileName: file.name,
      contentType: mime,
      fileSizeBytes: file.size,
      sha256,
      reason,
    },
  );
  const registration = {
    uploadId: intent.uploadId,
    version: content.version,
    speakerName,
    primary: data.has("primary"),
    reason,
  };
  assertSession(session);
  uploadTarget(intent);
  const attempt = {
    contentId: content.id,
    registration,
    intent,
    file,
    session,
  };
  onIssued(attempt);
  return resumeAnnouncerUpload(attempt);
}
/** Reuse the same bytes and uploadId after an interrupted PUT; a 412 is verified by the backend. */
export async function resumeAnnouncerUpload(
  attempt: AudioUploadAttempt,
): Promise<Audio> {
  const { intent, file, session, contentId, registration } = attempt;
  assertSession(session);
  const url = uploadTarget(intent);
  const response = await fetch(url, {
    method: "PUT",
    headers: intent.requiredHeaders,
    body: file,
    credentials: "omit",
    redirect: "error",
    referrerPolicy: "no-referrer",
    signal: AbortSignal.timeout(120_000),
  });
  assertSession(session);
  if (!response.ok && response.status !== 412)
    throw new Error(
      "파일 전송을 확인하지 못했습니다. 같은 업로드의 등록 상태를 확인하거나 같은 파일 전송을 재시도해 주세요.",
    );
  return registerAnnouncerAudio(contentId, registration);
}
export function registerAnnouncerAudio(
  contentId: number,
  registration: AudioRegistration,
): Promise<Audio> {
  return adminApi.create(
    `/contents/${contentId}/reference-audios`,
    registration,
  );
}
export function makePrimary(audio: Audio, reason: string): Promise<Audio> {
  return adminApi.edit(`/reference-audios/${audio.audioId}/primary`, {
    version: audio.contentVersion,
    reason: reasonSchema.parse(reason),
  });
}

/** The selected route identifies the member; the exact server timestamp still prevents stale deletion. */
export async function deleteMember(
  userId: number,
  updatedAt: string | null,
  reason: string,
) {
  validId(String(userId));
  const receipt = await adminApi.remove<unknown>(`/users/${userId}`, {
    expectedUpdatedAt: updatedAt,
    reason: reasonSchema.parse(reason),
  });
  return z
    .object({
      userId: z.literal(userId),
      deletedAt: z.string().datetime({ offset: true }),
      alreadyDeleted: z.boolean(),
    })
    .parse(receipt);
}
