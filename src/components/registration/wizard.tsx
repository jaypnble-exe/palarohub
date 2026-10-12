"use client";
import { useState, useTransition } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useTranslations, useFormatter } from "next-intl";
import { saveRegistration } from "@/app/(team)/team/[league]/actions";
import {
  registrationSchema,
  type RegistrationInput,
  type RegistrationPlayer,
  type RegistrationActionResult,
} from "@/lib/validation/registration";
import { checkRosterEligibility } from "@/lib/domain/eligibility";
import { Button } from "@/components/ui/button";
import { RosterEditor } from "./roster-editor";
import { NameForm } from "./name-form";
import { EligibilityFeedback, RegistrationFeedback } from "./feedback";

type Division = {
  id: string;
  name: string;
  max_rating: string;
  roster_min: number;
  roster_max: number;
};
export function RegistrationWizard({
  slug,
  registrationId = null,
  initial,
  teams,
  divisions,
  catalog,
  ratingScale,
  deadline,
  feeHalalas,
  requireDocuments,
}: {
  slug: string;
  registrationId?: string | null;
  initial: RegistrationInput;
  teams: { id: string; name: string }[];
  divisions: Division[];
  catalog: RegistrationPlayer[];
  ratingScale: string[];
  deadline: string;
  feeHalalas: number;
  requireDocuments: boolean;
}) {
  const t = useTranslations("Registration");
  const format = useFormatter();
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<RegistrationActionResult>();
  const {
    register,
    control,
    setValue,
    trigger,
    handleSubmit,
    formState: { errors },
  } = useForm<RegistrationInput>({
    resolver: zodResolver(registrationSchema),
    defaultValues: initial,
  });
  const values = useWatch({ control });
  const roster = (values.roster ?? []).map((entry) => ({
    playerId: entry.playerId ?? "",
    jerseyNumber: entry.jerseyNumber ?? 0,
  }));
  const division = divisions.find((item) => item.id === values.divisionId);
  const players = roster.map((entry) => {
    const player = catalog.find((item) => item.id === entry.playerId);
    return {
      ...(player ?? {
        id: entry.playerId,
        name: t("player"),
        rating: null,
        suspended: false,
        documentsPresent: false,
        onAnotherTeam: false,
      }),
      jerseyNumber: entry.jerseyNumber,
    };
  });
  const issues = division
    ? checkRosterEligibility(players, {
        ratingScale,
        maximumRating: division.max_rating,
        rosterMin: division.roster_min,
        rosterMax: division.roster_max,
        requireDocuments,
      })
    : [];
  function save(submit: boolean) {
    void handleSubmit((input) =>
      startTransition(async () => {
        try {
          const next = await saveRegistration(
            slug,
            registrationId,
            input,
            submit,
          );
          setResult(next);
          if (next.success && next.id)
            router.push(`/team/${slug}/registrations/${next.id}`);
        } catch {
          setResult({ error: "saveFailed" });
        }
      }),
    )();
  }
  async function next() {
    if (await trigger(step === 1 ? ["teamId", "divisionId"] : ["roster"])) {
      setStep(step + 1);
      setResult(undefined);
    }
  }
  return (
    <div className="space-y-5">
      <form
        className="space-y-5"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          if (step < 3) void next();
          else save(true);
        }}
      >
        <p className="text-sm font-semibold text-muted-foreground">
          {t("step", { current: step, total: 3 })}
        </p>
        <progress
          value={step}
          max={3}
          className="h-2 w-full accent-primary"
          aria-label={t("step", { current: step, total: 3 })}
        />
        {step === 1 && (
          <section className="space-y-5">
            <h2 className="font-display text-2xl font-semibold">
              {t("chooseTeamDivision")}
            </h2>
            <div className="space-y-2">
              <label htmlFor="registration-team" className="font-semibold">
                {t("yourTeam")}
              </label>
              <input type="hidden" {...register("teamId")} />
              <select
                id="registration-team"
                value={values.teamId}
                onChange={(event) => setValue("teamId", event.target.value)}
                disabled={registrationId !== null}
                className="min-h-[52px] w-full rounded-xl border-2 bg-card px-3"
              >
                {teams.map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label htmlFor="registration-division" className="font-semibold">
                {t("division")}
              </label>
              <select
                id="registration-division"
                {...register("divisionId")}
                className="min-h-[52px] w-full rounded-xl border-2 bg-card px-3"
              >
                {divisions.map((item) => (
                  <option key={item.id} value={item.id}>
                    {t("divisionOption", {
                      name: item.name,
                      rating: item.max_rating,
                    })}
                  </option>
                ))}
              </select>
            </div>
            <p className="text-sm text-muted-foreground">
              {t("deadlineValue", {
                date: format.dateTime(new Date(deadline), {
                  dateStyle: "medium",
                  timeStyle: "short",
                }),
              })}
            </p>
            <p className="text-sm font-semibold">
              {t("feeValue", {
                amount: format.number(feeHalalas / 100, {
                  style: "currency",
                  currency: "SAR",
                }),
              })}
            </p>
          </section>
        )}
        {step === 2 && (
          <section className="space-y-5">
            <h2 className="font-display text-2xl font-semibold">
              {t("yourRoster")}
            </h2>
            <p className="text-sm text-muted-foreground">{t("rosterHelp")}</p>
            <RosterEditor
              catalog={catalog}
              value={roster}
              onChange={(value) =>
                setValue("roster", value, { shouldValidate: true })
              }
              limit={division?.roster_max ?? 50}
            />
            <EligibilityFeedback issues={issues} />
          </section>
        )}
        {step === 3 && (
          <section className="space-y-5">
            <h2 className="font-display text-2xl font-semibold">
              {t("reviewRegistration")}
            </h2>
            <div className="space-y-3 rounded-2xl border bg-card p-5">
              <p className="text-xl font-semibold">
                {teams.find((team) => team.id === values.teamId)?.name}
              </p>
              <p>{division?.name}</p>
              <p>
                {t("feeValue", {
                  amount: format.number(feeHalalas / 100, {
                    style: "currency",
                    currency: "SAR",
                  }),
                })}
              </p>
              <p className="text-sm text-muted-foreground">
                {t("submissionHelp")}
              </p>
            </div>
            <RosterEditor
              catalog={catalog}
              value={roster}
              onChange={() => {}}
              disabled
            />
            <EligibilityFeedback issues={issues} />
          </section>
        )}
        {!!Object.keys(errors).length && (
          <p role="alert" className="text-sm text-destructive">
            {t("invalidForm")}
          </p>
        )}
        <RegistrationFeedback result={result} />
        <div className="flex flex-wrap gap-3">
          {step > 1 && (
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => setStep(step - 1)}
            >
              {t("back")}
            </Button>
          )}
          <Button
            type="submit"
            className="flex-1"
            disabled={pending || (step === 3 && issues.length > 0)}
          >
            {t(pending ? "saving" : step < 3 ? "next" : "submit")}
          </Button>
        </div>
        <Button
          type="button"
          variant="outline"
          className="w-full"
          disabled={pending}
          onClick={() => save(false)}
        >
          {t("saveDraft")}
        </Button>
      </form>
      {step === 1 && !registrationId && (
        <details className="rounded-xl border bg-card p-4">
          <summary className="min-h-11 cursor-pointer py-3 font-semibold">
            {t("createAnotherTeam")}
          </summary>
          <NameForm
            slug={slug}
            kind="team"
            embedded
            onCreated={(id) => setValue("teamId", id)}
          />
        </details>
      )}
      {step === 2 && (
        <details className="rounded-xl border bg-card p-4">
          <summary className="min-h-11 cursor-pointer py-3 font-semibold">
            {t("addNewPlayer")}
          </summary>
          <NameForm slug={slug} kind="player" embedded />
        </details>
      )}
    </div>
  );
}
