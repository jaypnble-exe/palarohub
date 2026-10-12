"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { setPaymentPolicy } from "@/app/(admin)/admin/[league]/payments/actions";
import type { PaymentPolicy } from "@/lib/domain/payments";
import { Button } from "@/components/ui/button";
import {
  ScheduleFeedback,
  useScheduleMutation,
} from "@/components/schedule/mutation";

/** League rule for teams that are behind: warn the scorer, or block the game. */
export function PolicyForm({
  slug,
  initial,
}: {
  slug: string;
  initial: PaymentPolicy;
}) {
  const t = useTranslations("Payments");
  const mutation = useScheduleMutation();
  const [policy, setPolicy] = useState(initial);
  return (
    <form
      className="space-y-3 rounded-2xl border bg-card p-5"
      onSubmit={(event) => {
        event.preventDefault();
        mutation.run(() => setPaymentPolicy(slug, policy));
      }}
    >
      <h2 className="font-display text-xl font-semibold">{t("policyTitle")}</h2>
      <div
        role="radiogroup"
        aria-label={t("policyTitle")}
        className="space-y-2"
      >
        {(["warn", "block"] as const).map((option) => (
          <label
            key={option}
            className="flex min-h-11 cursor-pointer items-start gap-3 rounded-xl border-2 p-3 has-[:checked]:border-navy"
          >
            <input
              type="radio"
              name="payment-policy"
              checked={policy === option}
              onChange={() => setPolicy(option)}
              className="mt-1 size-5 accent-primary"
            />
            <span>
              <span className="block font-semibold">
                {t(`policy.${option}`)}
              </span>
              <span className="block text-sm text-muted-foreground">
                {t(`policyHelp.${option}`)}
              </span>
            </span>
          </label>
        ))}
      </div>
      <Button
        variant="outline"
        disabled={mutation.pending || policy === initial}
      >
        {t(mutation.pending ? "saving" : "savePolicy")}
      </Button>
      <ScheduleFeedback result={mutation.result} message={(key) => t(key)} />
    </form>
  );
}
