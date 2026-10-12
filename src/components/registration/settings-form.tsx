"use client";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { configureRegistration } from "@/app/(team)/team/[league]/actions";
import {
  registrationSettingsSchema,
  sarToHalalas,
  type RegistrationSettingsInput,
} from "@/lib/validation/registration";
import {
  fromRiyadhDateTimeInput,
  toRiyadhDateTimeInput,
} from "@/lib/domain/riyadh-time";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useRegistrationMutation } from "./mutation";
import { RegistrationFeedback } from "./feedback";

export function RegistrationSettingsForm({
  slug,
  initial,
  canManage,
}: {
  slug: string;
  initial: RegistrationSettingsInput;
  canManage: boolean;
}) {
  const t = useTranslations("Registration");
  const mutation = useRegistrationMutation();
  const [deadline, setDeadline] = useState(
    toRiyadhDateTimeInput(initial.deadline),
  );
  const [fee, setFee] = useState((initial.feeHalalas / 100).toFixed(2));
  const {
    register,
    setValue,
    handleSubmit,
    formState: { errors },
  } = useForm<RegistrationSettingsInput>({
    resolver: zodResolver(registrationSettingsSchema),
    defaultValues: initial,
  });
  return (
    <form
      className="space-y-5"
      onSubmit={handleSubmit((input) =>
        mutation.run(() => configureRegistration(slug, input)),
      )}
      noValidate
    >
      <fieldset disabled={!canManage || mutation.pending} className="space-y-5">
        <label className="flex min-h-11 items-center gap-3 font-semibold">
          <input
            type="checkbox"
            {...register("isOpen")}
            className="size-5 accent-primary"
          />
          {t("openRegistration")}
        </label>
        <div className="space-y-2">
          <label htmlFor="registration-deadline" className="font-semibold">
            {t("deadline")}
          </label>
          <Input
            id="registration-deadline"
            type="datetime-local"
            value={deadline}
            onChange={(event) => {
              setDeadline(event.target.value);
              setValue(
                "deadline",
                fromRiyadhDateTimeInput(event.target.value) ?? "",
                { shouldValidate: true },
              );
            }}
            aria-invalid={!!errors.deadline}
          />
        </div>
        <div className="space-y-2">
          <label htmlFor="registration-fee" className="font-semibold">
            {t("fee")}
          </label>
          <Input
            id="registration-fee"
            inputMode="decimal"
            value={fee}
            onChange={(event) => {
              setFee(event.target.value);
              setValue("feeHalalas", sarToHalalas(event.target.value) ?? -1, {
                shouldValidate: true,
              });
            }}
            aria-invalid={!!errors.feeHalalas}
          />
          <p className="text-sm text-muted-foreground">{t("feeHelp")}</p>
        </div>
        <label className="flex min-h-11 items-center gap-3 font-semibold">
          <input
            type="checkbox"
            {...register("requireDocuments")}
            className="size-5 accent-primary"
          />
          {t("requireDocuments")}
        </label>
        <p className="text-sm text-muted-foreground">{t("documentsHelp")}</p>
      </fieldset>
      <p className="rounded-xl border bg-card p-4 text-sm">
        {t("registrationSettingsHelp")}
      </p>
      {!!Object.keys(errors).length && (
        <p role="alert" className="text-sm text-destructive">
          {t("invalidForm")}
        </p>
      )}
      {canManage && (
        <Button disabled={mutation.pending}>
          {t(mutation.pending ? "saving" : "saveSettings")}
        </Button>
      )}
      <RegistrationFeedback result={mutation.result} />
    </form>
  );
}
