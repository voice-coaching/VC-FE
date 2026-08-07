"use client";

import { useEffect } from "react";
import { reportLovableError } from "@/lib/lovable-error-reporting";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    reportLovableError(error, { boundary: "next_global_error_component" });
  }, [error]);

  return (
    <html lang="en">
      <body>
        <div className="flex min-h-screen items-center justify-center px-4">
          <div className="text-center">
            <h1 className="text-xl font-semibold">This page didn&apos;t load</h1>
            <button onClick={reset} className="mt-6 rounded-md bg-black px-4 py-2 text-white">
              Try again
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
