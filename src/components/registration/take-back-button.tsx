"use client";
import { useTranslations } from "next-intl";
import { withdrawRegistration } from "@/app/(team)/team/[league]/actions";
import { Button } from "@/components/ui/button";
import { cardVariants } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useRegistrationMutation } from "./mutation";
import { RegistrationFeedback } from "./feedback";

/** Lets a manager pull back a registration still waiting for review. */
export function TakeBackButton({
  slug,
  registrationId,
}: {
  slug: string;
  registrationId: string;
}) {
  const t = useTranslations("Registration");
  const mutation = useRegistrationMutation();
  return (
    <div className={cn(cardVariants(), "space-y-3")}>
      <p className="text-sm text-muted-foreground">{t("takeBackHelp")}</p>
      <Button
        variant="outline"
        className="w-full"
        disabled={mutation.pending}
        onClick={() =>
          mutation.run(() => withdrawRegistration(slug, registrationId))
        }
      >
        {t(mutation.pending ? "saving" : "takeBack")}
      </Button>
      <RegistrationFeedback result={mutation.result} successKey="takenBack" />
    </div>
  );
}
