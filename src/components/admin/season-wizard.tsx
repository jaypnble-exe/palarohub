"use client";

import { useState } from "react";
import { useForm, useFieldArray, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useTranslations, useFormatter } from "next-intl";
import { saveSeason } from "@/app/(admin)/admin/[league]/seasons/actions";
import {
  seasonSchema,
  seasonDetailsSchema,
  newDivision,
  type SeasonInput,
  type SeasonFormInput,
} from "@/lib/validation/seasons";
import { getSportModule, supportedSports } from "@/lib/sports/registry";
import { SportRulesFields } from "@/lib/sports/rules-fields";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cardVariants } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Select } from "@/components/ui/field";
import { Chip } from "@/components/ui/chip";
import { Alert } from "@/components/ui/alert";

export function SeasonWizard({
  slug,
  seasonId = null,
  initial,
  copyTemplate,
}: {
  slug: string;
  seasonId?: string | null;
  initial: SeasonFormInput;
  copyTemplate?: SeasonFormInput;
}) {
  const t = useTranslations("Seasons");
  const sports = useTranslations("Sports");
  const format = useFormatter();
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [feedback, setFeedback] = useState<string>();
  const {
    register,
    control,
    trigger,
    setValue,
    getValues,
    setError,
    clearErrors,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SeasonFormInput, unknown, SeasonInput>({
    resolver: zodResolver(seasonSchema),
    defaultValues: initial,
  });
  const { fields, append, remove, replace } = useFieldArray({
    control,
    name: "divisions",
    keyName: "fieldKey",
  });
  const values = useWatch({ control });
  const sport = values.sport ?? initial.sport;
  const rules = values.rules ?? initial.rules;
  const labels = initial.ratingScale;
  const submit = handleSubmit(async (input) => {
    setFeedback(undefined);
    try {
      const result = await saveSeason(slug, seasonId, input);
      if ("error" in result) setFeedback(result.error);
      else router.push(`/admin/${slug}/seasons/${result.seasonId}`);
    } catch {
      setFeedback("saveFailed");
    }
  });
  async function next() {
    if (step === 1) {
      clearErrors();
      const result = seasonDetailsSchema.safeParse(getValues());
      if (!result.success) {
        for (const issue of result.error.issues)
          setError(
            issue.path[0] as "name" | "startDate" | "endDate" | "sport",
            { message: issue.message },
          );
        setFeedback("invalidDetails");
        return;
      }
      setStep(2);
      setFeedback(undefined);
      return;
    }
    const names = step === 2 ? (["divisions"] as const) : (["rules"] as const);
    if (await trigger([...names])) {
      setStep(step + 1);
      setFeedback(undefined);
    }
  }
  const invalid = Boolean(Object.keys(errors).length);
  return (
    <form
      className="space-y-6"
      onSubmit={(event) => {
        if (step < 4) {
          event.preventDefault();
          void next();
        } else {
          void submit(event);
        }
      }}
      noValidate
    >
      <div className="space-y-2">
        <p className="text-sm font-semibold text-muted-foreground">
          {t("step", { current: step, total: 4 })}
        </p>
        <progress
          value={step}
          max={4}
          aria-label={t("step", { current: step, total: 4 })}
          className="h-2 w-full accent-primary"
        />
      </div>
      {step === 1 && (
        <section className="space-y-5">
          <h2 className="text-2xl font-semibold">{t("details")}</h2>
          {copyTemplate && (
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => {
                if (
                  copyTemplate.divisions.some(
                    (division) => !labels.includes(division.maxRating),
                  )
                ) {
                  setFeedback("copyRatingsChanged");
                  return;
                }
                setValue("sport", copyTemplate.sport);
                setValue("rules", copyTemplate.rules);
                replace(
                  copyTemplate.divisions.map(({ id: _id, ...division }) => {
                    void _id;
                    return division;
                  }),
                );
                setFeedback("copied");
              }}
            >
              {t("copyLast")}
            </Button>
          )}
          <div className="space-y-2">
            <label htmlFor="season-name" className="font-semibold">
              {t("name")}
            </label>
            <Input
              id="season-name"
              {...register("name")}
              aria-invalid={Boolean(errors.name)}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label htmlFor="season-start" className="font-semibold">
                {t("startDate")}
              </label>
              <Input
                id="season-start"
                type="date"
                {...register("startDate")}
                aria-invalid={Boolean(errors.startDate)}
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="season-end" className="font-semibold">
                {t("endDate")}
              </label>
              <Input
                id="season-end"
                type="date"
                {...register("endDate")}
                aria-invalid={Boolean(errors.endDate)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <label htmlFor="season-sport" className="font-semibold">
              {t("sport")}
            </label>
            <Select
              id="season-sport"
              {...register("sport", {
                onChange: (event) => {
                  const selected = event.target.value;
                  setValue("rules", {
                    ...getSportModule(selected).defaultRules,
                  });
                  fields.forEach((_, index) => {
                    setValue(`divisions.${index}.sport`, selected);
                    setValue(`divisions.${index}.rules`, null);
                  });
                },
              })}
            >
              {supportedSports.map((value) => (
                <option key={value} value={value}>
                  {sports(value)}
                </option>
              ))}
            </Select>
          </div>
        </section>
      )}
      {step === 2 && (
        <section className="space-y-5">
          <h2 className="text-2xl font-semibold">{t("divisions")}</h2>
          <p className="text-muted-foreground">{t("divisionHelp")}</p>
          {fields.map((field, index) => (
            <fieldset
              key={field.fieldKey}
              className={cn(cardVariants(), "space-y-4")}
            >
              <legend className="sr-only">
                {t("divisionNumber", { number: index + 1 })}
              </legend>
              <div className="space-y-2">
                <label
                  htmlFor={`division-name-${index}`}
                  className="font-semibold"
                >
                  {t("divisionName")}
                </label>
                <Input
                  id={`division-name-${index}`}
                  {...register(`divisions.${index}.name`)}
                  aria-invalid={Boolean(errors.divisions?.[index]?.name)}
                />
              </div>
              <div className="space-y-2">
                <p id={`rating-label-${index}`} className="font-semibold">
                  {t("maxRating")}
                </p>
                <div
                  className="flex flex-wrap gap-2"
                  role="group"
                  aria-labelledby={`rating-label-${index}`}
                >
                  {labels.map((label) => (
                    <Chip
                      key={label}
                      selected={values.divisions?.[index]?.maxRating === label}
                      className="min-w-12 font-bold"
                      onClick={() =>
                        setValue(`divisions.${index}.maxRating`, label, {
                          shouldValidate: true,
                        })
                      }
                    >
                      {label}
                    </Chip>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <label
                    htmlFor={`roster-min-${index}`}
                    className="text-sm font-semibold"
                  >
                    {t("rosterMin")}
                  </label>
                  <Input
                    id={`roster-min-${index}`}
                    type="number"
                    min={1}
                    max={50}
                    {...register(`divisions.${index}.rosterMin`, {
                      valueAsNumber: true,
                    })}
                  />
                </div>
                <div className="space-y-2">
                  <label
                    htmlFor={`roster-max-${index}`}
                    className="text-sm font-semibold"
                  >
                    {t("rosterMax")}
                  </label>
                  <Input
                    id={`roster-max-${index}`}
                    type="number"
                    min={1}
                    max={50}
                    {...register(`divisions.${index}.rosterMax`, {
                      valueAsNumber: true,
                    })}
                  />
                </div>
              </div>
              <label className="flex min-h-11 items-center gap-3 text-sm font-semibold">
                <input
                  type="checkbox"
                  className="size-5 accent-primary"
                  checked={values.divisions?.[index]?.rules != null}
                  onChange={(event) =>
                    setValue(
                      `divisions.${index}.rules`,
                      event.target.checked ? { ...rules } : null,
                    )
                  }
                />
                {t("overrideRules")}
              </label>
              {values.divisions?.[index]?.rules != null && (
                <SportRulesFields
                  sport={values.divisions[index]?.sport ?? sport}
                  value={values.divisions[index]?.rules ?? {}}
                  onChange={(value) =>
                    setValue(`divisions.${index}.rules`, value)
                  }
                />
              )}
              {fields.length > 1 && (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => remove(index)}
                >
                  {t("removeDivision")}
                </Button>
              )}
            </fieldset>
          ))}
          <Button
            type="button"
            variant="outline"
            disabled={fields.length >= 12}
            onClick={() => append(newDivision(sport, labels))}
          >
            {t("addDivision")}
          </Button>
        </section>
      )}
      {step === 3 && (
        <section className="space-y-5">
          <h2 className="text-2xl font-semibold">{t("rules")}</h2>
          <p className="text-muted-foreground">{t("rulesHelp")}</p>
          <SportRulesFields
            sport={sport}
            value={rules}
            onChange={(value) => setValue("rules", value)}
          />
        </section>
      )}
      {step === 4 && (
        <section className="space-y-5">
          <h2 className="text-2xl font-semibold">{t("review")}</h2>
          <div className={cn(cardVariants(), "space-y-3")}>
            <h3 className="text-xl font-semibold">{values.name}</h3>
            <p>
              {t("dates", {
                start: format.dateTime(
                  new Date(`${values.startDate}T12:00:00Z`),
                  { dateStyle: "medium" },
                ),
                end: format.dateTime(new Date(`${values.endDate}T12:00:00Z`), {
                  dateStyle: "medium",
                }),
              })}
            </p>
            <p>{sports(sport)}</p>
            <p className="text-sm text-muted-foreground">
              {t("scaleOrder")}: {labels.join(" → ")}
            </p>
            {values.divisions?.map((division, index) => (
              <div key={index} className="space-y-3">
                <p>
                  {t("divisionSummary", {
                    name: division.name ?? "",
                    rating: t("maximum", { rating: division.maxRating ?? "" }),
                    roster: t("rosterRange", {
                      min: division.rosterMin ?? 0,
                      max: division.rosterMax ?? 0,
                    }),
                  })}
                </p>
                {division.rules != null && (
                  <details>
                    <summary className="min-h-11 cursor-pointer py-3 font-semibold">
                      {t("divisionRules")}
                    </summary>
                    <SportRulesFields
                      sport={division.sport ?? sport}
                      value={division.rules}
                      disabled
                    />
                  </details>
                )}
              </div>
            ))}
          </div>
          <SportRulesFields sport={sport} value={rules} disabled />
          <label className="flex min-h-11 items-start gap-3 rounded-xl border bg-card p-4">
            <input
              type="checkbox"
              className="mt-1 size-5 shrink-0 accent-primary"
              checked={values.status === "published"}
              onChange={(event) =>
                setValue("status", event.target.checked ? "published" : "draft")
              }
            />
            <span>
              <strong>{t("publishNow")}</strong>
              <span className="mt-1 block text-sm text-muted-foreground">
                {t("publishHelp")}
              </span>
            </span>
          </label>
        </section>
      )}
      {invalid && <Alert tone="danger">{t("invalidSetup")}</Alert>}
      {feedback && <p role="status">{t(feedback)}</p>}
      <div className="flex gap-3">
        {step > 1 && (
          <Button
            type="button"
            variant="outline"
            disabled={isSubmitting}
            onClick={() => {
              setStep(step - 1);
              setFeedback(undefined);
            }}
          >
            {t("back")}
          </Button>
        )}
        <Button type="submit" className="flex-1" disabled={isSubmitting}>
          {t(
            step < 4
              ? "next"
              : isSubmitting
                ? "saving"
                : values.status === "published"
                  ? "publish"
                  : "saveDraft",
          )}
        </Button>
      </div>
    </form>
  );
}
