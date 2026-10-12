"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { addGame } from "@/app/(admin)/admin/[league]/schedule/actions";
import { fromRiyadhDateTimeInput } from "@/lib/domain/riyadh-time";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScheduleFeedback, useScheduleMutation } from "./mutation";

const selectClass = "min-h-[52px] w-full rounded-xl border-2 bg-card px-4";

export function AddGameForm({
  slug,
  divisionId,
  teams,
  defaultVenue,
}: {
  slug: string;
  divisionId: string;
  teams: readonly { id: string; name: string }[];
  defaultVenue: string;
}) {
  const t = useTranslations("Schedule");
  const mutation = useScheduleMutation();
  const [home, setHome] = useState(teams[0]?.id ?? "");
  const [away, setAway] = useState(teams[1]?.id ?? "");
  const [when, setWhen] = useState("");
  const [venue, setVenue] = useState(defaultVenue);
  return (
    <details className="rounded-2xl border bg-card p-5">
      <summary className="min-h-11 cursor-pointer py-2 font-semibold">
        {t("addGame")}
      </summary>
      <form
        className="mt-4 space-y-4"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          const scheduledAt = fromRiyadhDateTimeInput(when);
          if (!scheduledAt)
            return mutation.setResult({ error: "timeRequired" });
          if (home === away) return mutation.setResult({ error: "sameTeam" });
          mutation.run(
            () =>
              addGame(slug, {
                divisionId,
                homeTeamId: home,
                awayTeamId: away,
                scheduledAt,
                venue,
              }),
            () => setWhen(""),
          );
        }}
      >
        <p className="text-sm text-muted-foreground">{t("addGameHelp")}</p>
        <fieldset disabled={mutation.pending} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label htmlFor="add-home" className="font-semibold">
                {t("homeTeam")}
              </label>
              <select
                id="add-home"
                className={selectClass}
                value={home}
                onChange={(event) => setHome(event.target.value)}
              >
                {teams.map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label htmlFor="add-away" className="font-semibold">
                {t("awayTeam")}
              </label>
              <select
                id="add-away"
                className={selectClass}
                value={away}
                onChange={(event) => setAway(event.target.value)}
              >
                {teams.map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="space-y-2">
            <label htmlFor="add-when" className="font-semibold">
              {t("dateAndTime")}
            </label>
            <Input
              id="add-when"
              type="datetime-local"
              value={when}
              onChange={(event) => setWhen(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="add-venue" className="font-semibold">
              {t("court")}
            </label>
            <Input
              id="add-venue"
              value={venue}
              maxLength={80}
              onChange={(event) => setVenue(event.target.value)}
            />
          </div>
          <Button>{t(mutation.pending ? "saving" : "addGame")}</Button>
        </fieldset>
        <ScheduleFeedback
          result={mutation.result}
          message={(key) => t(key === "saved" ? "gameAdded" : key)}
        />
      </form>
    </details>
  );
}
