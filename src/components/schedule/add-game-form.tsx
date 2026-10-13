"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { addGame } from "@/app/(admin)/admin/[league]/schedule/actions";
import { fromRiyadhDateTimeInput } from "@/lib/domain/riyadh-time";
import { Button } from "@/components/ui/button";
import { cardVariants } from "@/components/ui/card";
import { Field, Select } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { ScheduleFeedback, useScheduleMutation } from "./mutation";

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
    <details className={cardVariants()}>
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
            <Field id="add-home" label={t("homeTeam")}>
              <Select
                id="add-home"
                value={home}
                onChange={(event) => setHome(event.target.value)}
              >
                {teams.map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field id="add-away" label={t("awayTeam")}>
              <Select
                id="add-away"
                value={away}
                onChange={(event) => setAway(event.target.value)}
              >
                {teams.map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.name}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <Field id="add-when" label={t("dateAndTime")}>
            <Input
              id="add-when"
              type="datetime-local"
              value={when}
              onChange={(event) => setWhen(event.target.value)}
            />
          </Field>
          <Field id="add-venue" label={t("court")}>
            <Input
              id="add-venue"
              value={venue}
              maxLength={80}
              onChange={(event) => setVenue(event.target.value)}
            />
          </Field>
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
