import { notFound } from "next/navigation";
import { Suspense } from "react";
import { SentenceResultsPreview } from "./preview";

export default function Page() {
  if (process.env.NODE_ENV !== "development") notFound();
  return (
    <Suspense>
      <SentenceResultsPreview />
    </Suspense>
  );
}
