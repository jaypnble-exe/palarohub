"use client";
import { useTranslations } from "next-intl";
import type { EligibilityIssue } from "@/lib/domain/eligibility";
import type { RegistrationActionResult } from "@/lib/validation/registration";

export function EligibilityFeedback({
  issues,
}: {
  issues: readonly EligibilityIssue[];
}) {
  const t = useTranslations("Registration");
  return issues.length ? (
    <ul
      className="space-y-2 rounded-xl border border-destructive/40 bg-card p-4 text-sm text-destructive"
      aria-label={t("eligibilityTitle")}
    >
      {issues.map((issue, index) => (
        <li key={`${issue.code}-${issue.playerId ?? index}`}>
          {t(`eligibility.${issue.code}`, {
            name: issue.name ?? t("player"),
            rating: issue.rating ?? "",
            maximumRating: issue.maximumRating ?? "",
            min: issue.min ?? 0,
            max: issue.max ?? 0,
          })}
        </li>
      ))}
    </ul>
  ) : (
    <p className="rounded-xl border border-green-700/30 bg-card p-4 text-sm font-semibold text-green-800">
      {t("eligible")}
    </p>
  );
}
export function RegistrationFeedback({
  result,
  successKey = "saved",
}: {
  result?: RegistrationActionResult;
  successKey?: string;
}) {
  const t = useTranslations("Registration");
  if (!result) return null;
  return (
    <div role={result.error ? "alert" : "status"} className="space-y-3">
      <p
        className={
          result.error ? "text-sm text-destructive" : "text-sm font-semibold"
        }
      >
        {t(result.error ?? successKey)}
      </p>
      {result.issues?.length ? (
        <EligibilityFeedback issues={result.issues} />
      ) : null}
    </div>
  );
}
