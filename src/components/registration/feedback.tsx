"use client";
import { useTranslations } from "next-intl";
import type { EligibilityIssue } from "@/lib/domain/eligibility";
import type { RegistrationActionResult } from "@/lib/validation/registration";
import { Alert } from "@/components/ui/alert";
import { Icon } from "@/components/ui/icon";

/**
 * Live roster checks. Not announced on every change (it updates as the
 * manager types); `quiet` hides the all-clear when problems are shown
 * elsewhere, e.g. on each player.
 */
export function EligibilityFeedback({
  issues,
  quiet = false,
}: {
  issues: readonly EligibilityIssue[];
  quiet?: boolean;
}) {
  const t = useTranslations("Registration");
  if (!issues.length)
    return quiet ? null : (
      <p className="flex items-start gap-3 rounded-xl bg-success-soft p-4 text-sm font-semibold text-success">
        <Icon name="check" className="mt-0.5 size-5 shrink-0" />
        {t("eligible")}
      </p>
    );
  return (
    <div className="flex items-start gap-3 rounded-xl bg-destructive-soft p-4 text-sm text-destructive">
      <Icon name="alert" className="mt-0.5 size-5 shrink-0" />
      <div className="min-w-0 space-y-2">
        <p className="font-bold">{t("fixBeforeSending")}</p>
        <ul
          className="list-disc space-y-1 pl-4"
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
      </div>
    </div>
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
    <div className="space-y-3">
      <Alert tone={result.error ? "danger" : "success"}>
        {t(result.error ?? successKey)}
      </Alert>
      {result.issues?.length ? (
        <EligibilityFeedback issues={result.issues} />
      ) : null}
    </div>
  );
}
