import { z } from "zod";
import { adminApi } from "./api";

const required = (name: string, max: number) =>
  z.string().trim().min(1, `${name}을 입력해 주세요.`).max(max);
const sentenceSchema = z.object({
  contentId: z.number().int().positive().nullable(),
  contentVersion: z.number().int().nonnegative().nullable(),
  title: required("문장 제목", 255),
  text: required("연습 문장", 10000),
  hint: z.string().max(500).nullable(),
  focus: z.enum(["PRONUNCIATION", "INTONATION", "BOTH"]),
  estimatedSeconds: z.coerce.number().int().min(1).max(3600),
});
const courseSchema = z.object({
  courseType: z.enum(["PRONUNCIATION", "INTONATION"]),
  title: required("클래스 제목", 255),
  description: z.string().max(1000),
  difficulty: z.enum(["BEGINNER", "INTERMEDIATE", "ADVANCED"]),
  status: z.enum(["DRAFT", "PUBLISHED", "HIDDEN"]),
  estimatedMinutes: z.coerce.number().int().min(1).max(3600),
  sentences: z
    .array(sentenceSchema)
    .min(1, "문장을 하나 이상 등록해 주세요.")
    .max(10, "문장은 최대 10개까지 등록할 수 있습니다."),
});
export type AdminCourseSentence = z.infer<typeof sentenceSchema>;
export type AdminCourse = z.infer<typeof courseSchema> & {
  id: number;
  version: number;
  updatedAt: string | null;
};
export const readAdminCourse = (value: unknown): AdminCourse =>
  courseSchema
    .extend({
      id: z.number().int().positive(),
      version: z.number().int().nonnegative(),
      updatedAt: z.string().nullable(),
      description: z
        .string()
        .nullable()
        .transform((value) => value ?? ""),
      sentences: z.array(sentenceSchema).max(10),
    })
    .parse(value);

/** Publish one ordered class revision; sentence deletion is applied only when the whole form is saved. */
export async function saveAdminCourse(
  data: FormData,
  sentences: AdminCourseSentence[],
  current?: AdminCourse,
): Promise<AdminCourse> {
  const course = courseSchema.parse({
    courseType: data.get("courseType"),
    title: data.get("title"),
    description: data.get("description"),
    difficulty: data.get("difficulty"),
    status: data.get("status"),
    estimatedMinutes: data.get("estimatedMinutes"),
    sentences,
  });
  const reason = required("작업 사유", 500).parse(data.get("reason"));
  if (current) {
    const seen = new Set<number>();
    for (const sentence of course.sentences) {
      if (sentence.contentId == null) {
        if (sentence.contentVersion != null)
          throw new Error("문장 연결 정보를 확인해 주세요.");
        continue;
      }
      const original = current.sentences.find(
        (item) => item.contentId === sentence.contentId,
      );
      if (
        !original ||
        original.contentVersion !== sentence.contentVersion ||
        seen.has(sentence.contentId)
      )
        throw new Error(
          "다른 클래스 또는 변경된 문장이 포함되어 있습니다. 최신 상태를 확인해 주세요.",
        );
      seen.add(sentence.contentId);
    }
  } else if (
    course.sentences.some(
      (item) => item.contentId != null || item.contentVersion != null,
    )
  ) {
    throw new Error("새 클래스의 문장 연결 정보를 확인해 주세요.");
  }
  const body = {
    ...(current ? { version: current.version } : {}),
    course,
    reason,
  };
  const saved = readAdminCourse(
    await (current
      ? adminApi.edit(`/courses/${current.id}`, body)
      : adminApi.create("/courses", body)),
  );
  if (current && (saved.id !== current.id || saved.version <= current.version))
    throw new Error(
      "저장 결과를 확인하지 못했습니다. 최신 상태를 확인해 주세요.",
    );
  return saved;
}
