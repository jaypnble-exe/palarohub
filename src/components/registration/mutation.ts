"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { RegistrationActionResult } from "@/lib/validation/registration";

export function useRegistrationMutation() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<RegistrationActionResult>();
  function run(
    action: () => Promise<RegistrationActionResult>,
    after?: (result: RegistrationActionResult) => void,
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
