"use client";
import { useRef, useState, useTransition } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useTranslations, useFormatter } from "next-intl";
import { saveRegistration } from "@/app/(team)/team/[league]/actions";
import {
  playersForDivision,
  registrationSchema,
  type CatalogPlayer,
  type RegistrationInput,
  type RosterEntryInput,
  type RegistrationActionResult,
} from "@/lib/validation/registration";
import { checkRosterEligibility } from "@/lib/domain/eligibility";
import { Button } from "@/components/ui/button";
import { RosterEditor } from "./roster-editor";
import { NameForm } from "./name-form";
import { EligibilityFeedback, RegistrationFeedback } from "./feedback";
import { cardVariants } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { ChoiceCard } from "@/components/ui/chip";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import { Icon } from "@/components/ui/icon";
import { Stepper } from "@/components/ui/stepper";
import { ActionBar } from "@/components/ui/action-bar";
import { formatSar } from "@/lib/format";

const STEPS = ["stepTeam", "stepRoster", "stepSend"] as const;

type Division = {
  id: string;
  name: string;
  max_rating: string;
  roster_min: number;
  roster_max: number;
};

/** Team and division → players → review and send. */
export function RegistrationWizard({
  slug,
  registrationId = null,
  initial,
  teams,
  divisions,
  taken = [],
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
  /** Divisions each team has already entered this season (one registration per division). */
  taken?: { teamId: string; divisionId: string }[];
  catalog: CatalogPlayer[];
  ratingScale: string[];
  deadline: string;
  feeHalalas: number;
  requireDocuments: boolean;
}) {
  const t = useTranslations("Registration");
  const format = useFormatter();
  const router = useRouter();
  const [step, setStep] = useState(1);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<RegistrationActionResult>();
  const {
    control,
    setValue,
    getValues,
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
  const openDivisions = (teamId: string | undefined) =>
    divisions.filter(
      (item) =>
        !taken.some(
          (entry) => entry.teamId === teamId && entry.divisionId === item.id,
        ),
    );
  const divisionOptions = openDivisions(values.teamId);
  const teamName = teams.find((team) => team.id === values.teamId)?.name;
  function chooseTeam(teamId: string) {
    setValue("teamId", teamId);
    const options = openDivisions(teamId);
    if (!options.some((item) => item.id === values.divisionId))
      setValue("divisionId", options[0]?.id ?? "");
  }
  const newPlayers = (values.newPlayers ?? []).map((player) => ({
    id: player.id ?? "",
    name: player.name ?? "",
  }));
  const divisionCatalog = [
    ...playersForDivision(catalog, values.divisionId),
    ...newPlayers.map((player) => ({
      ...player,
      rating: null,
      suspended: false,
      documentsPresent: false,
      onAnotherTeam: false,
      isNew: true,
    })),
  ];
  function changeRoster(next: RosterEntryInput[]) {
    setValue("roster", next, { shouldValidate: true });
    // A new player taken off the roster is simply forgotten; it was never saved.
    setValue(
      "newPlayers",
      (getValues("newPlayers") ?? []).filter((player) =>
        next.some((entry) => entry.playerId === player.id),
      ),
    );
  }
  function addNewPlayer(name: string) {
    const id = crypto.randomUUID();
    setValue("newPlayers", [...(getValues("newPlayers") ?? []), { id, name }]);
    return id;
  }
  const players = roster.map((entry) => {
    const player = divisionCatalog.find((item) => item.id === entry.playerId);
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
  function goTo(nextStep: number) {
    setStep(nextStep);
    setResult(undefined);
    // Start each step at its heading, for screen readers too.
    requestAnimationFrame(() => {
      headingRef.current?.scrollIntoView?.({ block: "start" });
      headingRef.current?.focus({ preventScroll: true });
    });
  }
  async function next() {
    if (await trigger(step === 1 ? ["teamId", "divisionId"] : ["roster"]))
      goTo(step + 1);
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
  const fee = formatSar(format, feeHalalas);
  const summary = [
    ["summaryTeam", teamName],
    ["summaryDivision", division?.name],
    ["summaryPlayers", t("rosterCount", { count: roster.length })],
    ["summaryFee", fee],
  ] as const;
  return (
    <div className="space-y-5">
      <form
        className="space-y-6"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          if (step < 3) void next();
          else save(true);
        }}
      >
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-muted-foreground">
              {t("step", { current: step, total: 3 })}
            </p>
            <Button
              type="button"
              variant="ghost"
              className="min-h-11 px-3 py-2 text-sm"
              disabled={pending}
              onClick={() => save(false)}
            >
              {t("saveDraft")}
            </Button>
          </div>
          <Stepper
            label={t("progressLabel")}
            steps={STEPS.map((key) => t(key))}
            current={step - 1}
            onSelect={(index) => goTo(index + 1)}
          />
        </div>

        {step === 1 && (
          <section className="space-y-6">
            {heading("chooseTeamDivision")}
            <fieldset className="space-y-3">
              <legend className="mb-3 font-semibold">{t("yourTeam")}</legend>
              {teams.map((team) => (
                <ChoiceCard
                  key={team.id}
                  name="registration-team"
                  checked={values.teamId === team.id}
                  disabled={registrationId !== null}
                  onChange={() => chooseTeam(team.id)}
                  title={team.name}
                  description={
                    registrationId !== null ? t("teamLocked") : undefined
                  }
                />
              ))}
            </fieldset>
            <fieldset className="space-y-3">
              <legend className="mb-3 font-semibold">{t("division")}</legend>
              {divisions.map((item) => {
                const entered = !divisionOptions.includes(item);
                return (
                  <ChoiceCard
                    key={item.id}
                    name="registration-division"
                    checked={values.divisionId === item.id}
                    disabled={entered}
                    onChange={() =>
                      setValue("divisionId", item.id, { shouldValidate: true })
                    }
                    title={item.name}
                    badge={
                      entered ? <Badge>{t("alreadyEntered")}</Badge> : undefined
                    }
                    description={t("divisionDetails", {
                      rating: item.max_rating,
                      min: item.roster_min,
                      max: item.roster_max,
                    })}
                  />
                );
              })}
              {!divisionOptions.length && (
                <Alert tone="warning">{t("allDivisionsEntered")}</Alert>
              )}
            </fieldset>
            <dl className="grid grid-cols-2 gap-3">
              <div className={cn(cardVariants(), "space-y-1 p-4")}>
                <dt className="text-sm font-semibold text-muted-foreground">
                  {t("feeLabel")}
                </dt>
                <dd className="font-display text-xl font-semibold">{fee}</dd>
              </div>
              <div className={cn(cardVariants(), "space-y-1 p-4")}>
                <dt className="text-sm font-semibold text-muted-foreground">
                  {t("deadlineLabel")}
                </dt>
                <dd className="font-semibold">
                  {format.dateTime(new Date(deadline), {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </dd>
              </div>
            </dl>
            {divisions.length > 1 && (
              <p className="text-sm text-muted-foreground">
                {t("separateFeeHelp")}
              </p>
            )}
          </section>
        )}

        {step === 2 && (
          <section className="space-y-5">
            <div className="space-y-1">
              {heading("yourRoster")}
              <p className="text-sm text-muted-foreground">
                {t("rosterFor", {
                  team: teamName ?? "",
                  division: division?.name ?? "",
                })}
              </p>
            </div>
            <RosterEditor
              catalog={divisionCatalog}
              value={roster}
              onChange={changeRoster}
              onAddNewPlayer={addNewPlayer}
              min={division?.roster_min}
              limit={division?.roster_max ?? 50}
              issues={issues}
            />
            <EligibilityFeedback
              issues={issues.filter((issue) => !issue.playerId)}
              quiet={issues.some((issue) => issue.playerId)}
            />
          </section>
        )}

        {step === 3 && (
          <section className="space-y-5">
            {heading("reviewRegistration")}
            <dl className={cn(cardVariants(), "grid grid-cols-2 gap-4")}>
              {summary.map(([label, value]) => (
                <div key={label} className="min-w-0 space-y-1">
                  <dt className="text-sm font-semibold text-muted-foreground">
                    {t(label)}
                  </dt>
                  <dd className="truncate font-semibold">{value}</dd>
                </div>
              ))}
            </dl>
            <EligibilityFeedback issues={issues} />
            <RosterEditor
              catalog={divisionCatalog}
              value={roster}
              onChange={() => {}}
              disabled
              issues={issues}
            />
            <Alert tone="info" title={t("whatNext")}>
              {t("submissionHelp")}
            </Alert>
          </section>
        )}

        {!!Object.keys(errors).length && (
          <Alert tone="danger">{t("invalidForm")}</Alert>
        )}
        <RegistrationFeedback result={result} />
        <ActionBar>
          {step > 1 && (
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => goTo(step - 1)}
            >
              <Icon name="back" className="size-5" />
              {t("back")}
            </Button>
          )}
          <Button
            type="submit"
            className="flex-1"
            disabled={
              pending ||
              (step === 1 && !division) ||
              (step === 3 && issues.length > 0)
            }
          >
            {t(pending ? "saving" : step < 3 ? "next" : "submit")}
            {!pending && (
              <Icon name={step < 3 ? "arrow" : "check"} className="size-5" />
            )}
          </Button>
        </ActionBar>
      </form>
      {step === 1 && !registrationId && (
        <details className={cardVariants()}>
          <summary className="min-h-11 cursor-pointer py-3 font-semibold">
            {t("createAnotherTeam")}
          </summary>
          <NameForm
            slug={slug}
            kind="team"
            embedded
            onCreated={(id) => chooseTeam(id)}
          />
        </details>
      )}
    </div>
  );
}
