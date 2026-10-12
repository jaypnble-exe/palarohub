"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ScheduleActionResult } from "@/lib/validation/schedule";

export function useScheduleMutation() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<ScheduleActionResult>();
  function run(
    action: () => Promise<ScheduleActionResult>,
    after?: (result: ScheduleActionResult) => void,
  ) {
    setResult(undefined);
    startTransition(async () => {
      try {
        const next = await action();
        setResult(next);
        if (next.success) {
          router.refresh();
          after?.(next);
        }
      } catch {
        setResult({ error: "saveFailed" });
      }
    });
  }
  return { pending, result, run, setResult, router };
}

export function ScheduleFeedback({
  result,
  message,
}: {
  result?: ScheduleActionResult;
  message: (key: string) => string;
}) {
  if (!result) return null;
  return (
    <p
      role={result.error ? "alert" : "status"}
      className={
        result.error ? "text-sm text-destructive" : "text-sm font-semibold"
      }
    >
      {message(result.error ?? "saved")}
    </p>
  );
}
