"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { createLeague } from "@/app/(admin)/admin/actions";
import { leagueSchema, type LeagueInput } from "@/lib/validation/leagues";
import { supportedSports } from "@/lib/sports/registry";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/field";
import { Alert } from "@/components/ui/alert";

export function CreateLeagueForm() {
  const t = useTranslations("CreateLeague");
  const sports = useTranslations("Sports");
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [status, setStatus] = useState<string>();
  const {
    register,
    handleSubmit,
    trigger,
    formState: { errors, isSubmitting },
  } = useForm<LeagueInput>({
    resolver: zodResolver(leagueSchema),
    defaultValues: {
      name: "",
      slug: "",
      sport: supportedSports[0],
      commissionerEmail: "",
    },
  });
  const submit = handleSubmit(async (input) => {
    setStatus(undefined);
    try {
      const result = await createLeague(input);
      if ("error" in result) setStatus(result.error);
      else router.push(`/admin/${result.slug}`);
    } catch {
      setStatus("createFailed");
    }
  });

  return (
    <form
      onSubmit={(event) => {
        if (step === 1) {
          event.preventDefault();
          void trigger(["name", "slug", "sport"]).then((valid) => {
            if (valid) setStep(2);
          });
        } else {
          void submit(event);
        }
      }}
      className="space-y-5"
      noValidate
    >
      <p className="text-sm font-medium text-muted-foreground">
        {t("step", { current: step, total: 2 })}
      </p>
      <fieldset className={step === 1 ? "space-y-5" : "hidden"}>
        <legend className="sr-only">{t("details")}</legend>
        <div className="space-y-2">
          <label htmlFor="league-name" className="text-sm font-medium">
            {t("name")}
          </label>
          <Input
            id="league-name"
            {...register("name")}
            aria-invalid={Boolean(errors.name)}
            aria-describedby={errors.name ? "name-error" : undefined}
          />
          {errors.name && (
            <p id="name-error" className="text-sm text-destructive">
              {t("invalidName")}
            </p>
          )}
        </div>
        <div className="space-y-2">
          <label htmlFor="league-slug" className="text-sm font-medium">
            {t("slug")}
          </label>
          <Input
            id="league-slug"
            {...register("slug")}
            autoCapitalize="none"
            autoCorrect="off"
            aria-invalid={Boolean(errors.slug)}
            aria-describedby="slug-help"
          />
          <p id="slug-help" className="text-sm text-muted-foreground">
            {t("slugHelp")}
          </p>
          {errors.slug && (
            <p role="alert" className="text-sm text-destructive">
              {t("invalidSlug")}
            </p>
          )}
        </div>
        <div className="space-y-2">
          <label htmlFor="league-sport" className="text-sm font-medium">
            {t("sport")}
          </label>
          <Select
            id="league-sport"
            {...register("sport")}
            aria-invalid={Boolean(errors.sport)}
          >
            {supportedSports.map((sport) => (
              <option key={sport} value={sport}>
                {sports(sport)}
              </option>
            ))}
          </Select>
          {errors.sport && (
            <p role="alert" className="text-sm text-destructive">
              {t("invalidSport")}
            </p>
          )}
        </div>
      </fieldset>
      {step === 2 && (
        <div className="space-y-2">
          <label htmlFor="commissioner-email" className="text-sm font-medium">
            {t("commissionerEmail")}
          </label>
          <Input
            id="commissioner-email"
            type="email"
            autoComplete="email"
            {...register("commissionerEmail")}
            aria-invalid={Boolean(errors.commissionerEmail)}
            aria-describedby="commissioner-help"
          />
          <p id="commissioner-help" className="text-sm text-muted-foreground">
            {t("commissionerHelp")}
          </p>
          {errors.commissionerEmail && (
            <p role="alert" className="text-sm text-destructive">
              {t("invalidEmail")}
            </p>
          )}
        </div>
      )}
      {status && <Alert tone="danger">{t(status)}</Alert>}
      <div className="flex gap-3">
        {step === 2 && (
          <Button
            type="button"
            variant="outline"
            disabled={isSubmitting}
            onClick={() => setStep(1)}
          >
            {t("back")}
          </Button>
        )}
        <Button type="submit" disabled={isSubmitting} className="flex-1">
          {t(step === 1 ? "next" : isSubmitting ? "creating" : "create")}
        </Button>
      </div>
    </form>
  );
}
