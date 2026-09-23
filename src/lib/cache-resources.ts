import type { ContentType, CourseType, Id } from "./api";

const value = (input: Id) => String(input);

export const cacheResources = {
  contentFacets: (type: ContentType) => `content-facets-${type}`,
  practiceContent: (contentId: Id) => `practice-content-${value(contentId)}`,
  practiceSelection: (
    contentId: Id,
    exampleId: string | null,
    revision: string | null,
  ) =>
    exampleId
      ? `practice-content-${value(contentId)}-example-${exampleId}-revision-${revision ?? "current"}`
      : `practice-content-${value(contentId)}`,
  adjacentContent: (contentId: Id, type: ContentType) =>
    `practice-adjacent-${type}-${value(contentId)}`,
  courseCatalog: (type: CourseType) => `course-catalog-${type}`,
  courseLesson: (courseId: Id, stepId: Id) =>
    `course-lesson-${value(courseId)}-${value(stepId)}`,
  streakMonth: (from: string, to: string) => `streak-month-${from}-${to}`,
  streakWeek: (from: string, to: string) => `streak-week-${from}-${to}`,
  notifications: "notifications-inbox",
  notificationPreferences: "notification-preferences",
  notices: "notices-page-0",
  historyDetail: (sessionId: Id) =>
    `training-history-detail-${value(sessionId)}`,
  referenceAudios: (contentId: Id) => `reference-audios-${value(contentId)}`,
  analysisCapabilities: "analysis-capabilities",
} as const;
