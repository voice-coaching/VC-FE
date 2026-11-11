import { notFound } from "next/navigation";
import { AnalysisLoadingPreview } from "./preview";

export default function Page() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <AnalysisLoadingPreview />;
}
