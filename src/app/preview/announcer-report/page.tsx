import { notFound } from "next/navigation";
import { ReportPreview } from "@/components/report-preview";
export default function Page() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <ReportPreview variant="announcer" />;
}
