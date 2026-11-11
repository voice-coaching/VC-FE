import { notFound } from "next/navigation";
import { Suspense } from "react";
import { NewsResultPreview } from "./preview";

export default function Page() {
  if (process.env.NODE_ENV !== "development") notFound();
  return (
    <Suspense>
      <NewsResultPreview />
    </Suspense>
  );
}
