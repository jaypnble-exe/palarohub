"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { setPaymentPolicy } from "@/app/(admin)/admin/[league]/payments/actions";
import type { PaymentPolicy } from "@/lib/domain/payments";
import { Button } from "@/components/ui/button";
import { cardVariants } from "@/components/ui/card";
import { ChoiceCard } from "@/components/ui/chip";
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
      className={`${cardVariants()} space-y-3`}
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
          <ChoiceCard
            key={option}
            name="payment-policy"
            checked={policy === option}
            onChange={() => setPolicy(option)}
            title={t(`policy.${option}`)}
            description={t(`policyHelp.${option}`)}
          />
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
