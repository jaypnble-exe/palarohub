"use client";

import { useRef, useState } from "react";
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
import { Chip, ChoiceCard } from "@/components/ui/chip";
import { Alert } from "@/components/ui/alert";
import { ActionBar } from "@/components/ui/action-bar";
import { Icon } from "@/components/ui/icon";
import { Stepper } from "@/components/ui/stepper";
import { Switch } from "@/components/ui/switch";

const STEPS = [
  "stepDetails",
  "stepDivisions",
  "stepRules",
  "stepReview",
] as const;
const DAY_MS = 86400000;

/** Whole weeks between two yyyy-mm-dd dates, or null if either is missing. */
function seasonWeeks(start?: string, end?: string) {
  if (!start || !end) return null;
  const days =
    (new Date(`${end}T12:00:00Z`).getTime() -
      new Date(`${start}T12:00:00Z`).getTime()) /
    DAY_MS;
  return Number.isFinite(days) && days > 0
    ? Math.max(1, Math.round(days / 7))
    : null;
}

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
  const headingRef = useRef<HTMLHeadingElement>(null);
  function goTo(nextStep: number) {
    setStep(nextStep);
    setFeedback(undefined);
    // Start each step at its heading, for screen readers too.
    requestAnimationFrame(() => {
      headingRef.current?.scrollIntoView?.({ block: "start" });
      headingRef.current?.focus({ preventScroll: true });
    });
  }
  const heading = (key: string) => (
    <h2
      ref={headingRef}
      tabIndex={-1}
      className="scroll-mt-4 font-display text-2xl font-semibold outline-none"
    >
      {t(key)}
    </h2>
  );
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
      goTo(2);
      return;
    }
    const names = step === 2 ? (["divisions"] as const) : (["rules"] as const);
    if (await trigger([...names])) goTo(step + 1);
  }
  const weeks = seasonWeeks(values.startDate, values.endDate);
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
      <div className="space-y-3">
        <p className="text-sm font-semibold text-muted-foreground">
          {t("step", { current: step, total: 4 })}
        </p>
        <Stepper
          label={t("progressLabel")}
          steps={STEPS.map((key) => t(key))}
          current={step - 1}
          onSelect={(index) => goTo(index + 1)}
        />
      </div>
      {step === 1 && (
        <section className="space-y-5">
          {heading("details")}
          {copyTemplate && (
            <div className="space-y-3 rounded-2xl border-2 border-dashed border-primary/40 bg-orange-soft/40 p-4">
              <div className="space-y-1">
                <p className="font-semibold">{t("copyLastTitle")}</p>
                <p className="text-sm text-muted-foreground">
                  {t("copyLastHelp")}
                </p>
              </div>
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
            </div>
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
          {weeks && (
            <p className="text-sm font-semibold text-muted-foreground">
              {t("seasonLength", { weeks })}
            </p>
          )}
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
          <div className="space-y-1">
            {heading("divisions")}
            <p className="text-muted-foreground">{t("divisionHelp")}</p>
          </div>
          {fields.map((field, index) => (
            <fieldset
              key={field.fieldKey}
              className={cn(cardVariants(), "space-y-4")}
            >
              <legend className="sr-only">
                {t("divisionNumber", { number: index + 1 })}
              </legend>
              <div className="flex items-center justify-between gap-3">
                <p className="flex items-center gap-2 text-sm font-bold text-muted-foreground uppercase">
                  <span className="grid size-7 place-items-center rounded-full bg-navy text-xs text-on-dark">
                    {index + 1}
                  </span>
                  {t("divisionNumber", { number: index + 1 })}
                </p>
                {fields.length > 1 && (
                  <button
                    type="button"
                    className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-destructive hover:underline"
                    aria-label={t("removeDivisionNamed", {
                      name:
                        values.divisions?.[index]?.name ||
                        t("divisionNumber", { number: index + 1 }),
                    })}
                    onClick={() => remove(index)}
                  >
                    <Icon name="close" className="size-4" />
                    {t("remove")}
                  </button>
                )}
              </div>
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
              <Switch
                className="border-t pt-4"
                label={t("overrideRules")}
                description={t("overrideRulesHelp")}
                checked={values.divisions?.[index]?.rules != null}
                onChange={(checked) =>
                  setValue(
                    `divisions.${index}.rules`,
                    checked ? { ...rules } : null,
                  )
                }
              />
              {values.divisions?.[index]?.rules != null && (
                <SportRulesFields
                  sport={values.divisions[index]?.sport ?? sport}
                  value={values.divisions[index]?.rules ?? {}}
                  onChange={(value) =>
                    setValue(`divisions.${index}.rules`, value)
                  }
                />
              )}
            </fieldset>
          ))}
          <Button
            type="button"
            variant="outline"
            className="w-full border-dashed"
            disabled={fields.length >= 12}
            onClick={() => append(newDivision(sport, labels))}
          >
            <Icon name="add" className="size-5" />
            {t("addDivision")}
          </Button>
        </section>
      )}
      {step === 3 && (
        <section className="space-y-5">
          <div className="space-y-1">
            {heading("rules")}
            <p className="text-muted-foreground">{t("rulesHelp")}</p>
          </div>
          <div className={cardVariants()}>
            <SportRulesFields
              sport={sport}
              value={rules}
              onChange={(value) => setValue("rules", value)}
            />
          </div>
        </section>
      )}
      {step === 4 && (
        <section className="space-y-5">
          {heading("review")}
          <div className={cn(cardVariants(), "space-y-3")}>
            <h3 className="font-display text-2xl font-semibold">
              {values.name}
            </h3>
            <p className="font-semibold">
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
            <p className="text-sm text-muted-foreground">
              {sports(sport)}
              {weeks ? ` · ${t("seasonLength", { weeks })}` : ""}
            </p>
            <p className="text-sm text-muted-foreground">
              {t("scaleOrder")}: {labels.join(" → ")}
            </p>
          </div>
          <div className={cn(cardVariants({ padding: "none" }), "divide-y")}>
            {values.divisions?.map((division, index) => (
              <div key={index} className="space-y-2 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold">{division.name}</p>
                  <span className="rounded-lg bg-accent px-2.5 py-1 text-sm font-semibold">
                    {t("maximum", { rating: division.maxRating ?? "" })}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">
                  {t("rosterRange", {
                    min: division.rosterMin ?? 0,
                    max: division.rosterMax ?? 0,
                  })}
                  {" · "}
                  {t(division.rules != null ? "ownRules" : "inheritRules")}
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
          <details className={cardVariants()}>
            <summary className="min-h-11 cursor-pointer py-3 font-semibold">
              {t("rules")}
            </summary>
            <SportRulesFields sport={sport} value={rules} disabled />
          </details>
          <fieldset className="space-y-3">
            <legend className="mb-3 font-semibold">{t("whenDone")}</legend>
            <ChoiceCard
              name="season-status"
              checked={values.status !== "published"}
              onChange={() => setValue("status", "draft")}
              title={t("draftChoice")}
              description={t("draftChoiceHelp")}
            />
            <ChoiceCard
              name="season-status"
              checked={values.status === "published"}
              onChange={() => setValue("status", "published")}
              title={t("publishNow")}
              description={t("publishHelp")}
            />
          </fieldset>
        </section>
      )}
      {invalid && <Alert tone="danger">{t("invalidSetup")}</Alert>}
      {feedback && (
        <Alert tone={feedback === "copied" ? "success" : "info"}>
          {t(feedback)}
        </Alert>
      )}
      <ActionBar>
        {step > 1 && (
          <Button
            type="button"
            variant="outline"
            disabled={isSubmitting}
            onClick={() => goTo(step - 1)}
          >
            <Icon name="back" className="size-5" />
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
          {!isSubmitting && (
            <Icon name={step < 4 ? "arrow" : "check"} className="size-5" />
          )}
        </Button>
      </ActionBar>
    </form>
  );
}
