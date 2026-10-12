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
            <p id={`status-${game.id}`} className="font-semibold">
              {t("gameStatus")}
            </p>
            <div
              role="group"
              aria-labelledby={`status-${game.id}`}
              className="flex flex-wrap gap-2"
            >
              {gameStatuses.map((option) => (
                <button
                  key={option}
                  type="button"
                  aria-pressed={status === option}
                  onClick={() => setStatus(option)}
                  className="min-h-11 rounded-xl border-2 bg-background px-4 font-semibold aria-pressed:border-navy aria-pressed:bg-navy aria-pressed:text-on-dark"
                >
                  {t(`status.${option}`)}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <label htmlFor={`when-${game.id}`} className="font-semibold">
              {t("dateAndTime")}
            </label>
            <Input
              id={`when-${game.id}`}
              type="datetime-local"
              value={when}
              onChange={(event) => setWhen(event.target.value)}
            />
            {status === "postponed" && (
              <p className="text-sm text-muted-foreground">
                {t("postponedHelp")}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <label htmlFor={`venue-${game.id}`} className="font-semibold">
              {t("court")}
            </label>
            <Input
              id={`venue-${game.id}`}
              value={venue}
              maxLength={80}
              onChange={(event) => setVenue(event.target.value)}
            />
          </div>
          <Button>{t(mutation.pending ? "saving" : "saveGame")}</Button>
        </fieldset>
        <ScheduleFeedback result={mutation.result} message={(key) => t(key)} />
      </form>
    </details>
  );
}
