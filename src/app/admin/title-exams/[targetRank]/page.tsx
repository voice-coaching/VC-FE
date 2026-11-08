import { notFound } from "next/navigation";
import { TitleExamPolicyEditPage } from "@/features/admin/components/title-exam-policies";
import { titleRankSchema } from "@/features/admin/title-exam-policies";

export default async function TitleExamEditPage({
  params,
}: {
  params: Promise<{ targetRank: string }>;
}) {
  const rank = titleRankSchema.safeParse((await params).targetRank);
  if (!rank.success) notFound();
  return <TitleExamPolicyEditPage key={rank.data} targetRank={rank.data} />;
}
