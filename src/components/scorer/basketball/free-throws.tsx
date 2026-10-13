"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import type { BasketballGameState, Side } from "@/lib/sports/basketball";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { RecordEvent } from "./board";

/**
 * After a foul with free throws, asks for the shooter and then each shot,
 * so the scorer never hunts for the right buttons.
 */
export function FreeThrows({
  state,
  teamNames,
  record,
  disabled,
}: {
  state: BasketballGameState;
  teamNames: Record<Side, string>;
  record: RecordEvent;
  disabled: boolean;
}) {
  const t = useTranslations("Scorer");
  const due = state.freeThrowsDue;
  const [shooter, setShooter] = useState<string>();
  const [skipped, setSkipped] = useState<string>();
  // A new foul (a different count or team) asks again.
  const key = due ? `${due.team}-${due.count}-${state.lastSequence}` : "";
  if (!due || skipped === `${due.team}-${state.log.length}`) return null;
  const team = state.teams[due.team];
  const chosen =
    shooter && team.onCourt.includes(shooter) ? shooter : undefined;
  const shoot = (made: boolean) =>
    chosen &&
    record("score", { team: due.team, playerId: chosen, points: 1, made });
  return (
    <section
      key={key}
      aria-label={t("freeThrowsTitle", { team: teamNames[due.team] })}
      className="space-y-3 rounded-2xl border-2 border-primary bg-orange-soft/60 p-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-bold text-orange-dark">
          {t("freeThrowsLeft", {
            team: teamNames[due.team],
            count: due.count,
          })}
        </h2>
        <Button
          type="button"
          variant="ghost"
          className="min-h-11 py-2 text-sm"
          onClick={() => setSkipped(`${due.team}-${state.log.length}`)}
        >
          {t("skipFreeThrows")}
        </Button>
      </div>
      <p className="text-sm font-semibold">{t("whoShoots")}</p>
      <div className="flex flex-wrap gap-2">
        {team.onCourt.map((id) => (
          <button
            key={id}
            type="button"
            disabled={disabled}
            aria-pressed={chosen === id}
            onClick={() => setShooter(id)}
            className={cn(
              "min-h-12 rounded-xl border-2 bg-background px-3 text-sm font-semibold transition",
              chosen === id
                ? "border-navy bg-navy text-on-dark"
                : "border-border",
            )}
          >
            #{team.players[id].jersey} {team.players[id].name}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Button
          type="button"
          className="min-h-14 text-lg"
          disabled={disabled || !chosen}
          onClick={() => shoot(true)}
        >
          {t("freeThrowMade")}
        </Button>
        <Button
          type="button"
          variant="outline"
          className="min-h-14 text-lg"
          disabled={disabled || !chosen}
          onClick={() => shoot(false)}
        >
          {t("freeThrowMissed")}
        </Button>
      </div>
    </section>
  );
}
