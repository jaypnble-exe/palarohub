"use client";
import { useEffect, useState } from "react";
import type {
  BasketballEvent,
  BasketballGameState,
  BasketballRules,
  Side,
} from "@/lib/sports/basketball";

type Clock = BasketballGameState["clock"];

/** Remaining period time at `now` on this device. */
export function remainingAt(clock: Clock, now: number) {
  if (!clock.running || !clock.asOf) return clock.remainingMs;
  const elapsed = Math.max(0, now - Date.parse(clock.asOf));
  return Math.max(0, clock.remainingMs - elapsed);
}

/** Remaining period time, ticking while the clock runs. */
export function useGameClock(clock: Clock) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!clock.running) return;
    const timer = window.setInterval(() => setNow(Date.now()), 200);
    return () => window.clearInterval(timer);
  }, [clock.running]);
  return remainingAt(clock, now);
}

export function formatClock(ms: number) {
  if (ms < 60_000) return (Math.floor(ms / 100) / 10).toFixed(1);
  const seconds = Math.ceil(ms / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

type Translate = (
  key: string,
  values?: Record<string, string | number>,
) => string;

export function periodName(
  period: number,
  rules: BasketballRules,
  t: Translate,
) {
  if (period === 0) return t("pregame");
  return period <= rules.quarters
    ? t("quarter", { number: period })
    : t("overtime", { number: period - rules.quarters });
}

export function playerLabel(
  state: BasketballGameState,
  side: Side,
  playerId: string | null,
) {
  const line = playerId ? state.teams[side].players[playerId] : undefined;
  return line ? `#${line.jersey} ${line.name}` : "";
}

/** One plain-language line per event for the play-by-play list. */
export function describeEvent(
  event: BasketballEvent,
  state: BasketballGameState,
  teamNames: Record<Side, string>,
  periodLabel: string,
  t: Translate,
): string {
  const who = (side: Side, id: string | null) => playerLabel(state, side, id);
  switch (event.type) {
    case "roster":
      return t("log.roster", { team: teamNames[event.payload.team] });
    case "checkin":
      return t("log.checkin", {
        player: who(event.payload.team, event.payload.playerId),
      });
    case "jersey":
      return t("log.jersey", {
        player:
          state.teams[event.payload.team].players[event.payload.playerId]
            ?.name ?? "",
        number: event.payload.number,
      });
    case "starters":
      return t("log.starters", { team: teamNames[event.payload.team] });
    case "officials":
      return t("log.officials");
    case "period_start":
      return t("log.periodStart", { period: periodLabel });
    case "period_end":
      return t("log.periodEnd", { period: periodLabel });
    case "clock_start":
      return t("log.clockStart");
    case "clock_stop":
      return t("log.clockStop");
    case "score":
      return t(event.payload.made ? "log.made" : "log.missed", {
        player: who(event.payload.team, event.payload.playerId),
        points: event.payload.points,
      });
    case "foul":
      return event.payload.playerId
        ? t("log.foul", {
            kind: t(`foulKind.${event.payload.kind}`),
            player: who(event.payload.team, event.payload.playerId),
          })
        : t("log.benchTechnical", { team: teamNames[event.payload.team] });
    case "substitution":
      return t("log.substitution", {
        in: who(event.payload.team, event.payload.in),
        out: who(event.payload.team, event.payload.out),
      });
    case "timeout":
      return t("log.timeout", { team: teamNames[event.payload.team] });
    case "stat":
      return t("log.stat", {
        kind: t(`statKind.${event.payload.kind}`),
        player: who(event.payload.team, event.payload.playerId),
      });
    case "possession":
      return t("log.possession", { team: teamNames[event.payload.team] });
    case "game_end":
      return t("log.gameEnd");
    case "void":
      return t("log.void");
  }
}
