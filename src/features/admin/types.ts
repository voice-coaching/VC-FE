export type AdminAccess = { id: number; nickname: string; role: "ADMIN" };
export type AdminPage<T> = {
  items: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  hasNext: boolean;
};
export type Member = {
  id: number;
  maskedEmail: string | null;
  nickname: string;
  status: string;
  role: string;
  createdAt: string;
  membershipType: string;
  membershipExpiresAt: string | null;
  membershipEnvironment: string | null;
  loginProviders: string[];
};
export type ContentType = "SENTENCE" | "ANNOUNCER" | "NEWS" | "CLASS_PRACTICE";
export type Content = {
  id: number;
  version: number;
  type: ContentType;
  focus: string;
  category: string | null;
  difficulty: string;
  title: string;
  description: string | null;
  scriptText: string;
  targetPronunciations: string[] | null;
  estimatedSeconds: number | null;
  status: string;
  publishedAt: string | null;
  updatedAt: string;
};
export type ContentDeletion = {
  id: number;
  version: number;
  deletedAt: string;
};
export type Category = {
  type: ContentType;
  code: string;
  label: string;
  sortOrder: number;
};
export type Notice = {
  id: number;
  version: number;
  title: string;
  summary: string;
  sections: { title: string; paragraphs: string[] }[];
  pinned: boolean;
  published: boolean;
  publishedAt: string;
};
export type Inquiry = {
  id: number;
  version: number;
  userId: number;
  category: string;
  subject: string;
  body?: string;
  relatedSessionId?: number | null;
  replyEmail?: string | null;
  status: string;
  answer?: string | null;
  createdAt: string;
  answeredAt?: string | null;
};
export type Campaign = {
  id: number;
  version: number;
  audience: "ALL_ACTIVE" | "SELECTED_USERS";
  kind: "GENERAL" | "PLAN";
  title: string;
  body: string;
  deepLink: string;
  userIds: number[];
  status: "DRAFT" | "SENT";
  audienceCount: number;
  sentCount: number;
  createdAt: string;
  sentAt: string | null;
};
export type Popup = {
  id: number;
  version: number;
  title: string;
  body: string;
  deepLink: string | null;
  priority: number;
  startsAt: string;
  endsAt: string;
  enabled: boolean;
  createdAt: string;
};
export type Audit = {
  id: number;
  actorId: number;
  action: string;
  targetType: string;
  targetId: string;
  reason: string;
  changedFields: string;
  outcome: string;
  correlationId: string;
  createdAt: string;
};
export type Audio = {
  audioId: number;
  contentId: number;
  speakerName: string;
  speakerType: string;
  durationMs: number | null;
  primary: boolean;
  contentVersion: number;
  createdAt: string;
};
export type AudioList = { items: Audio[]; contentVersion: number };
export type AudioIntent = {
  uploadId: string;
  uploadUrl: string;
  requiredHeaders: Record<string, string>;
  expiresAt: string;
};
export type AudioRegistration = {
  uploadId: string;
  version: number;
  speakerName: string;
  primary: boolean;
  reason: string;
};
export const USER_RESOURCES = [
  "TRAINING_SESSIONS",
  "RECORDINGS",
  "ANALYSES",
  "PAYMENTS",
  "CANCELLATIONS",
  "INQUIRIES",
  "NOTIFICATIONS",
  "COURSE_PROGRESS",
  "TITLES",
  "TITLE_EXAMS",
  "DIRECT_ANALYSES",
  "COACHING_USAGE",
  "PRIVATE_CONTENTS",
] as const;
export type UserResource = (typeof USER_RESOURCES)[number];
export type MemberOverview = {
  user: Member;
  counts: { resource: UserResource; count: number }[];
  coachingUsage: {
    membershipType: string;
    environment: string | null;
    unlimited: boolean;
    startsAt: string;
    expiresAt: string | null;
    limit: number | null;
    used: number;
    reserved: number;
    remaining: number | null;
    canRequestCoaching: boolean;
  } | null;
  usageUnavailableReason: string | null;
};
export type MemberRecord = {
  fields: Record<string, string | number | boolean | null>;
};
export type IdentifierMatch = { userId: number; source: string };
export type Query = Record<
  string,
  string | number | boolean | null | undefined
>;
