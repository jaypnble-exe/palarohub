"use client";
import { useTranslations } from "next-intl";
import { joinRegistration } from "@/app/(team)/team/[league]/actions";
import { Button } from "@/components/ui/button";
import { useRegistrationMutation } from "./mutation";
import { RegistrationFeedback } from "./feedback";
export function JoinRegistrationButton({
  slug,
  seasonId,
}: {
  slug: string;
  seasonId: string;
}) {
  const t = useTranslations("Registration");
  const mutation = useRegistrationMutation();
  return (
    <div className="space-y-4">
      <Button
        className="w-full"
        disabled={mutation.pending}
        onClick={() =>
          mutation.run(
            () => joinRegistration(slug, seasonId),
            () => mutation.router.push(`/team/${slug}/register/${seasonId}`),
          )
        }
      >
        {t(mutation.pending ? "saving" : "startRegistration")}
      </Button>
      <RegistrationFeedback result={mutation.result} />
    </div>
  );
}
