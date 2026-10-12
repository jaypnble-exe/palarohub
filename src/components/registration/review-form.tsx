"use client";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import {
  reviewRegistration,
  reviewRosterChange,
} from "@/app/(team)/team/[league]/actions";
import { reviewSchema, type ReviewInput } from "@/lib/validation/registration";
import { Button } from "@/components/ui/button";
import { useRegistrationMutation } from "./mutation";
import { RegistrationFeedback } from "./feedback";

export function ReviewForm({
  slug,
  registrationId,
  changeRequestId,
}: {
  slug: string;
  registrationId: string;
  changeRequestId?: string;
}) {
  const t = useTranslations("Registration");
  const mutation = useRegistrationMutation();
  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<ReviewInput>({
    resolver: zodResolver(reviewSchema),
    defaultValues: { registrationId, decision: "approved", comment: "" },
  });
  const decision = useWatch({ control, name: "decision" });
  const prefix = changeRequestId ?? registrationId;
  return (
    <form
      className="space-y-4 rounded-2xl border bg-card p-5"
      onSubmit={handleSubmit((input) =>
        mutation.run(() =>
          changeRequestId
            ? reviewRosterChange(
                slug,
                changeRequestId,
                input.decision === "approved",
                input.comment,
              )
            : reviewRegistration(slug, input),
        ),
      )}
      noValidate
    >
      <div className="space-y-2">
        <label htmlFor={`decision-${prefix}`} className="font-semibold">
          {t("decision")}
        </label>
        <select
          id={`decision-${prefix}`}
          {...register("decision")}
          disabled={mutation.pending}
          className="min-h-[52px] w-full rounded-xl border-2 bg-card px-3"
        >
          <option value="approved">{t("approve")}</option>
          {!changeRequestId && <option value="returned">{t("return")}</option>}
          <option value="rejected">{t("reject")}</option>
        </select>
      </div>
      <div className="space-y-2">
        <label htmlFor={`comment-${prefix}`} className="font-semibold">
          {t(decision === "approved" ? "optionalComment" : "requiredComment")}
        </label>
        <textarea
          id={`comment-${prefix}`}
          {...register("comment")}
          disabled={mutation.pending}
          rows={3}
          maxLength={1000}
          className="w-full rounded-xl border-2 bg-background p-3"
          aria-invalid={!!errors.comment}
        />
        {errors.comment && (
          <p className="text-sm text-destructive">{t("commentRequired")}</p>
        )}
      </div>
      <Button disabled={mutation.pending} className="w-full">
        {t(mutation.pending ? "saving" : "saveDecision")}
      </Button>
      <RegistrationFeedback result={mutation.result} />
    </form>
  );
}
