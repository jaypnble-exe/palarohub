"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { updateGame } from "@/app/(admin)/admin/[league]/schedule/actions";
import {
  fromRiyadhDateTimeInput,
  toRiyadhDateTimeInput,
} from "@/lib/domain/riyadh-time";
import { gameStatuses, type GameStatus } from "@/lib/validation/schedule";
import { Button } from "@/components/ui/button";
import { ChipGroup } from "@/components/ui/chip";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { ScheduleFeedback, useScheduleMutation } from "./mutation";

export function GameEditor({
  slug,
  game,
}: {
  slug: string;
  game: {
    id: string;
    scheduledAt: string | null;
    venue: string;
    status: GameStatus;
  };
}) {
  const t = useTranslations("Schedule");
  const mutation = useScheduleMutation();
  const [when, setWhen] = useState(
    game.scheduledAt ? toRiyadhDateTimeInput(game.scheduledAt) : "",
  );
  const [venue, setVenue] = useState(game.venue);
  const [status, setStatus] = useState<GameStatus>(game.status);
  const [open, setOpen] = useState(false);
  return (
    <details
      open={open}
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary className="inline-flex min-h-11 cursor-pointer items-center font-semibold text-orange-dark">
        {t("changeGame")}
      </summary>
      <form
        className="mt-3 space-y-4"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          const scheduledAt = when ? fromRiyadhDateTimeInput(when) : null;
          if (
            (when && !scheduledAt) ||
            (!scheduledAt && status !== "postponed")
          ) {
            mutation.setResult({ error: "timeRequired" });
            return;
          }
          mutation.run(
            () =>
              updateGame(slug, { gameId: game.id, status, scheduledAt, venue }),
            () => setOpen(false),
          );
        }}
      >
        <fieldset disabled={mutation.pending} className="space-y-4">
          <div className="space-y-2">
            <p className="font-semibold">{t("gameStatus")}</p>
            <ChipGroup
              label={t("gameStatus")}
              value={status}
              onChange={setStatus}
              options={gameStatuses.map((option) => ({
                value: option,
                label: t(`status.${option}`),
              }))}
            />
          </div>
          <Field
            id={`when-${game.id}`}
            label={t("dateAndTime")}
            help={status === "postponed" ? t("postponedHelp") : undefined}
          >
            <Input
              id={`when-${game.id}`}
              type="datetime-local"
              value={when}
              onChange={(event) => setWhen(event.target.value)}
            />
          </Field>
          <Field id={`venue-${game.id}`} label={t("court")}>
            <Input
              id={`venue-${game.id}`}
              value={venue}
              maxLength={80}
              onChange={(event) => setVenue(event.target.value)}
            />
          </Field>
          <Button>{t(mutation.pending ? "saving" : "saveGame")}</Button>
        </fieldset>
        <ScheduleFeedback result={mutation.result} message={(key) => t(key)} />
      </form>
    </details>
  );
}
