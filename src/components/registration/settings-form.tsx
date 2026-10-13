"use client";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
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
import { deadlineInDays } from "@/lib/domain/registration-window";
import { Alert } from "@/components/ui/alert";
import { ActionBar } from "@/components/ui/action-bar";
import { Button } from "@/components/ui/button";
import { cardVariants } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { useRegistrationMutation } from "./mutation";
import { RegistrationFeedback } from "./feedback";

const presets = [
  { days: 7, key: "inOneWeek" },
  { days: 14, key: "inTwoWeeks" },
  { days: 30, key: "inOneMonth" },
] as const;

/** Open or close registration, and set its deadline, fee and document rule. */
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
    control,
    setValue,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<RegistrationSettingsInput>({
    resolver: zodResolver(registrationSettingsSchema),
    defaultValues: initial,
  });
  const values = useWatch({ control });
  const disabled = !canManage || mutation.pending;
  function chooseDeadline(value: string) {
    setDeadline(value);
    setValue("deadline", fromRiyadhDateTimeInput(value) ?? "", {
      shouldValidate: true,
      shouldDirty: true,
    });
  }
  return (
    <form
      className="space-y-5"
      onSubmit={handleSubmit((input) =>
        mutation.run(
          () => configureRegistration(slug, input),
          () => reset(input),
        ),
      )}
      noValidate
    >
      <section className={cn(cardVariants(), "space-y-5")}>
        <Switch
          label={t("openRegistration")}
          description={t("openRegistrationHelp")}
          checked={values.isOpen ?? false}
          disabled={disabled}
          onChange={(checked) =>
            setValue("isOpen", checked, { shouldDirty: true })
          }
        />
        <div className="space-y-3 border-t pt-5">
          <label
            htmlFor="registration-deadline"
            className="block font-semibold"
          >
            {t("deadline")}
          </label>
          <Input
            id="registration-deadline"
            type="datetime-local"
            value={deadline}
            disabled={disabled}
            onChange={(event) => chooseDeadline(event.target.value)}
            aria-invalid={!!errors.deadline}
          />
          <div
            role="group"
            aria-label={t("quickDeadline")}
            className="flex flex-wrap gap-2"
          >
            {presets.map((preset) => {
              const value = toRiyadhDateTimeInput(
                deadlineInDays(new Date(), preset.days),
              );
              return (
                <Chip
                  key={preset.key}
                  selected={deadline === value}
                  disabled={disabled}
                  className="min-h-10 px-3 text-sm"
                  onClick={() => chooseDeadline(value)}
                >
                  {t(preset.key)}
                </Chip>
              );
            })}
          </div>
          {errors.deadline && (
            <p className="text-sm font-semibold text-destructive">
              {t("deadlineInvalid")}
            </p>
          )}
        </div>
        <div className="space-y-2 border-t pt-5">
          <label htmlFor="registration-fee" className="block font-semibold">
            {t("fee")}
          </label>
          <div className="relative max-w-56">
            <span className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 font-semibold text-muted-foreground">
              SAR
            </span>
            <Input
              id="registration-fee"
              inputMode="decimal"
              className="pl-14 text-lg font-semibold"
              value={fee}
              disabled={disabled}
              onChange={(event) => {
                setFee(event.target.value);
                setValue("feeHalalas", sarToHalalas(event.target.value) ?? -1, {
                  shouldValidate: true,
                  shouldDirty: true,
                });
              }}
              aria-invalid={!!errors.feeHalalas}
              aria-describedby="registration-fee-help"
            />
          </div>
          <p
            id="registration-fee-help"
            className="text-sm text-muted-foreground"
          >
            {t("feeHelp")}
          </p>
          {errors.feeHalalas && (
            <p className="text-sm font-semibold text-destructive">
              {t("feeInvalid")}
            </p>
          )}
        </div>
        <div className="border-t pt-5">
          <Switch
            label={t("requireDocuments")}
            description={t("documentsHelp")}
            checked={values.requireDocuments ?? false}
            disabled={disabled}
            onChange={(checked) =>
              setValue("requireDocuments", checked, { shouldDirty: true })
            }
          />
        </div>
      </section>
      <Alert tone="info">{t("registrationSettingsHelp")}</Alert>
      <RegistrationFeedback result={mutation.result} />
      {canManage && (
        <ActionBar className="items-center">
          <p className="flex flex-1 items-center text-sm font-semibold text-muted-foreground">
            {t(isDirty ? "unsavedChanges" : "allSaved")}
          </p>
          <Button disabled={mutation.pending || !isDirty}>
            {t(mutation.pending ? "saving" : "saveSettings")}
          </Button>
        </ActionBar>
      )}
    </form>
  );
}
