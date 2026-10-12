"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useFormatter, useTranslations } from "next-intl";
import { generateSchedule } from "@/app/(admin)/admin/[league]/schedule/actions";
import { buildSchedule } from "@/lib/domain/round-robin";
import { toRiyadhDateTimeInput } from "@/lib/domain/riyadh-time";
import { scheduleSetupSchema } from "@/lib/validation/schedule";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const chipClass =
  "min-h-11 rounded-xl border-2 bg-background px-4 font-semibold aria-pressed:border-navy aria-pressed:bg-navy aria-pressed:text-on-dark";
// 18 October 2026 is a Sunday; used only to label weekdays.
const weekdayDate = (day: number) => new Date(Date.UTC(2026, 9, 18 + day, 12));

export function ScheduleWizard({
  slug,
  divisionId,
  teams,
  seasonStart,
  seasonEnd,
  hasSchedule,
  today,
}: {
  slug: string;
  divisionId: string;
  teams: readonly { id: string; name: string }[];
  seasonStart: string;
  seasonEnd: string;
  hasSchedule: boolean;
  today: string;
}) {
  const t = useTranslations("Schedule");
  const format = useFormatter();
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [twice, setTwice] = useState(false);
  const [startDate, setStartDate] = useState(
    seasonStart > today ? seasonStart : today,
  );
  const [gameDays, setGameDays] = useState<number[]>([5]);
  const [times, setTimes] = useState(["19:00", "20:30"]);
  const [venues, setVenues] = useState(() => [t("mainCourt")]);
  const [replace, setReplace] = useState(false);
  const [feedback, setFeedback] = useState<string>();
  const [saving, setSaving] = useState(false);
  const setup = {
    divisionId,
    twice,
    startDate,
    gameDays,
    times,
    venues,
    replace,
  };
  const preview = useMemo(
    () =>
      buildSchedule(
        teams.map((team) => team.id),
        twice,
        { startDate, gameDays, times, venues },
      ),
    [teams, twice, startDate, gameDays, times, venues],
  );
  const names = new Map(teams.map((team) => [team.id, team.name]));
  const longDate = (date: string) =>
    format.dateTime(new Date(`${date}T12:00:00Z`), {
      weekday: "long",
      day: "numeric",
      month: "long",
      timeZone: "UTC",
    });

  function next() {
    setFeedback(undefined);
    if (step === 2) {
      const parsed = scheduleSetupSchema.safeParse(setup);
      if (!parsed.success) {
        const message = parsed.error.issues[0]?.message;
        setFeedback(
          [
            "pickGameDay",
            "timeMissing",
            "invalidTime",
            "duplicateTime",
            "venueMissing",
            "venueRequired",
            "duplicateVenue",
          ].includes(message ?? "")
            ? message
            : "invalidForm",
        );
        return;
      }
      if ("error" in preview) {
        setFeedback(preview.error);
        return;
      }
    }
    setStep(step + 1);
  }

  async function save() {
    setFeedback(undefined);
    if (hasSchedule && !replace) {
      setFeedback("confirmReplace");
      return;
    }
    setSaving(true);
    try {
      const result = await generateSchedule(slug, setup);
      if (result.error) setFeedback(result.error);
      else {
        router.push(`/admin/${slug}/schedule/${divisionId}`);
        router.refresh();
        return;
      }
    } catch {
      setFeedback("saveFailed");
    }
    setSaving(false);
  }

  if (teams.length < 2)
    return (
      <p className="rounded-2xl border bg-card p-5">{t("needTwoTeams")}</p>
    );

  return (
    <form
      className="space-y-6"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        if (step < 3) next();
        else void save();
      }}
    >
      <div className="space-y-2">
        <p className="text-sm font-semibold text-muted-foreground">
          {t("step", { current: step, total: 3 })}
        </p>
        <progress
          value={step}
          max={3}
          aria-label={t("step", { current: step, total: 3 })}
          className="h-2 w-full accent-primary"
        />
      </div>

      {step === 1 && (
        <section className="space-y-5">
          <h2 className="text-2xl font-semibold">{t("teamsAndFormat")}</h2>
          <div className="space-y-2 rounded-2xl border bg-card p-5">
            <p className="font-semibold">
              {t("teamCount", { count: teams.length })}
            </p>
            <p className="text-sm text-muted-foreground">
              {teams.map((team) => team.name).join(", ")}
            </p>
          </div>
          <div role="radiogroup" aria-label={t("format")} className="space-y-3">
            {[false, true].map((option) => (
              <label
                key={String(option)}
                className="flex min-h-11 cursor-pointer items-start gap-3 rounded-2xl border-2 bg-card p-4 has-[:checked]:border-navy"
              >
                <input
                  type="radio"
                  name="format"
                  checked={twice === option}
                  onChange={() => setTwice(option)}
                  className="mt-1 size-5 accent-primary"
                />
                <span className="space-y-1">
                  <span className="block font-semibold">
                    {t(option ? "playTwice" : "playOnce")}
                  </span>
                  <span className="block text-sm text-muted-foreground">
                    {t("gamesPerTeam", {
                      count: (teams.length - 1) * (option ? 2 : 1),
                    })}
                  </span>
                </span>
              </label>
            ))}
          </div>
        </section>
      )}

      {step === 2 && (
        <section className="space-y-6">
          <h2 className="text-2xl font-semibold">{t("whenAndWhere")}</h2>
          <div className="space-y-2">
            <label htmlFor="schedule-start" className="font-semibold">
              {t("firstGameDate")}
            </label>
            <Input
              id="schedule-start"
              type="date"
              value={startDate}
              onChange={(event) => setStartDate(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <p id="game-days-label" className="font-semibold">
              {t("gameDays")}
            </p>
            <div
              role="group"
              aria-labelledby="game-days-label"
              className="flex flex-wrap gap-2"
            >
              {[0, 1, 2, 3, 4, 5, 6].map((day) => (
                <button
                  key={day}
                  type="button"
                  aria-pressed={gameDays.includes(day)}
                  className={chipClass}
                  onClick={() =>
                    setGameDays(
                      gameDays.includes(day)
                        ? gameDays.filter((value) => value !== day)
                        : [...gameDays, day].sort((a, b) => a - b),
                    )
                  }
                >
                  {format.dateTime(weekdayDate(day), {
                    weekday: "short",
                    timeZone: "UTC",
                  })}
                </button>
              ))}
            </div>
          </div>
          <fieldset className="space-y-3">
            <legend className="font-semibold">{t("startTimes")}</legend>
            <p className="text-sm text-muted-foreground">
              {t("startTimesHelp")}
            </p>
            {times.map((time, index) => (
              <div key={index} className="flex gap-2">
                <Input
                  type="time"
                  aria-label={t("startTimeNumber", { number: index + 1 })}
                  value={time}
                  onChange={(event) =>
                    setTimes(
                      times.map((value, position) =>
                        position === index ? event.target.value : value,
                      ),
                    )
                  }
                />
                {times.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() =>
                      setTimes(
                        times.filter((_, position) => position !== index),
                      )
                    }
                  >
                    {t("remove")}
                  </Button>
                )}
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              disabled={times.length >= 8}
              onClick={() => setTimes([...times, ""])}
            >
              {t("addTime")}
            </Button>
          </fieldset>
          <fieldset className="space-y-3">
            <legend className="font-semibold">{t("courts")}</legend>
            <p className="text-sm text-muted-foreground">{t("courtsHelp")}</p>
            {venues.map((venue, index) => (
              <div key={index} className="flex gap-2">
                <Input
                  aria-label={t("courtNumber", { number: index + 1 })}
                  value={venue}
                  maxLength={80}
                  onChange={(event) =>
                    setVenues(
                      venues.map((value, position) =>
                        position === index ? event.target.value : value,
                      ),
                    )
                  }
                />
                {venues.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() =>
                      setVenues(
                        venues.filter((_, position) => position !== index),
                      )
                    }
                  >
                    {t("remove")}
                  </Button>
                )}
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              disabled={venues.length >= 6}
              onClick={() =>
                setVenues([
                  ...venues,
                  t("courtDefault", { number: venues.length + 1 }),
                ])
              }
            >
              {t("addCourt")}
            </Button>
          </fieldset>
        </section>
      )}

      {step === 3 && !("error" in preview) && (
        <section className="space-y-5">
          <h2 className="text-2xl font-semibold">{t("checkAndSave")}</h2>
          <div className="space-y-2 rounded-2xl border bg-card p-5">
            <p className="font-semibold">
              {t("previewSummary", {
                games: preview.games.length,
                days: preview.gameDayCount,
              })}
            </p>
            <p>{t("lastGame", { date: longDate(preview.lastDate) })}</p>
          </div>
          {preview.lastDate > seasonEnd && (
            <p
              role="alert"
              className="rounded-xl border border-primary/40 bg-orange-soft p-4 text-sm text-orange-dark"
            >
              {t("pastSeasonEnd", { date: longDate(seasonEnd) })}
            </p>
          )}
          <ol className="space-y-2">
            {preview.games.map((game, index) => (
              <li
                key={index}
                className="rounded-xl border bg-card px-4 py-3 text-sm"
              >
                <span className="font-semibold">
                  {t("matchup", {
                    home: names.get(game.homeTeamId) ?? "",
                    away: names.get(game.awayTeamId) ?? "",
                  })}
                </span>
                <span className="block text-muted-foreground">
                  {longDate(
                    toRiyadhDateTimeInput(game.scheduledAt).slice(0, 10),
                  )}
                  {" · "}
                  {format.dateTime(new Date(game.scheduledAt), {
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                  {" · "}
                  {game.venue}
                </span>
              </li>
            ))}
          </ol>
          {hasSchedule && (
            <label className="flex min-h-11 items-start gap-3 rounded-xl border border-destructive/40 bg-card p-4 font-semibold">
              <input
                type="checkbox"
                checked={replace}
                onChange={(event) => setReplace(event.target.checked)}
                className="mt-1 size-5 accent-primary"
              />
              {t("replaceConfirm")}
            </label>
          )}
        </section>
      )}

      {feedback && (
        <p role="alert" className="text-sm text-destructive">
          {t(feedback)}
        </p>
      )}
      <div className="flex flex-wrap gap-3">
        {step > 1 && (
          <Button
            type="button"
            variant="outline"
            disabled={saving}
            onClick={() => {
              setFeedback(undefined);
              setStep(step - 1);
            }}
          >
            {t("back")}
          </Button>
        )}
        <Button disabled={saving}>
          {t(step < 3 ? "next" : saving ? "saving" : "saveSchedule")}
        </Button>
      </div>
    </form>
  );
}
