import { z } from "zod";
import { adminApi } from "./api";
import { getAuthSessionVersion } from "@/lib/api/client";

export const titleRankSchema = z.enum([
  "BEGINNER",
  "LOCAL_ANNOUNCER",
  "ASPIRING_ANNOUNCER",
  "ANNOUNCER",
]);
const contentSchema = z.object({
  id: z.number().int().positive(),
  version: z.number().int().nonnegative(),
  title: z.string(),
  scriptText: z.string(),
  type: z.string(),
  category: z.string(),
  focus: z.string(),
  status: z.string(),
});
export const policySchema = z.object({
  targetRank: titleRankSchema,
  targetTitle: z.string(),
  version: z.number().int().nonnegative(),
  passingScore: z.number().int().min(0).max(100),
  requiredTrainingCount: z.number().int().nonnegative(),
  practiceContentId: z.number().int().positive().nullable(),
  available: z.boolean(),
  content: contentSchema.nullable(),
});
export const policyListSchema = z.object({ items: z.array(policySchema) });
export type TitleExamPolicy = z.infer<typeof policySchema>;

export async function saveTitleExamPolicy(
  current: TitleExamPolicy,
  contentId: number,
  contentVersion: number,
  form: FormData,
  sourceScriptText: string | undefined = current.content?.id === contentId
    ? current.content.scriptText
    : undefined,
) {
  const submittedScript = form.get("scriptText");
  const scriptText =
    submittedScript === null || submittedScript === sourceScriptText
      ? undefined
      : String(submittedScript);
  const input = z
    .object({
      practiceContentId: z
        .number()
        .int()
        .positive("시험 문장을 선택해 주세요."),
      passingScore: z.coerce
        .number()
        .int("합격 점수는 정수로 입력해 주세요.")
        .min(1, "합격 점수는 1점 이상입니다.")
        .max(100, "합격 점수는 100점 이하입니다."),
      version: z.number().int().nonnegative(),
      contentVersion: z.number().int().nonnegative(),
      scriptText: z
        .string()
        .max(10000, "시험 문장은 10,000자 이하입니다.")
        .refine(
          (value) => value.trim().length > 0,
          "시험 문장을 입력해 주세요.",
        )
        .optional(),
      reason: z
        .string()
        .trim()
        .min(1, "작업 사유를 입력해 주세요.")
        .max(500, "작업 사유는 500자 이하입니다."),
    })
    .parse({
      practiceContentId: contentId,
      contentVersion,
      ...(scriptText === undefined ? {} : { scriptText }),
      passingScore: form.get("passingScore"),
      version: current.version,
      reason: String(form.get("reason") ?? ""),
    });
  const session = getAuthSessionVersion();
  const result = policySchema.parse(
    await adminApi.edit(
      `/title-exam-policies/${titleRankSchema.parse(current.targetRank)}`,
      input,
    ),
  );
  if (getAuthSessionVersion() !== session)
    throw new Error("로그인 정보가 변경되었습니다.");
  if (
    result.targetRank !== current.targetRank ||
    result.version !== current.version + 1 ||
    (scriptText === undefined
      ? result.practiceContentId !== contentId
      : result.practiceContentId === contentId ||
        result.content?.scriptText !== scriptText) ||
    result.passingScore !== input.passingScore ||
    !result.available ||
    result.content?.id !== result.practiceContentId
  )
    throw new Error(
      "저장 결과를 확인하지 못했습니다. 최신 시험 설정을 다시 조회해 주세요.",
    );
  return result;
}
