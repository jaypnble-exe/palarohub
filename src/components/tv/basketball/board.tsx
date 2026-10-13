"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import {
  basketballRulesSchema,
  inPenalty,
  reduceBasketballGame,
  sides,
  teamFoulsThisPeriod,
  timeoutGroup,
  timeoutsLeft,
  type BasketballEvent,
  type Side,
} from "@/lib/sports/basketball";
import { parseGameEvents } from "@/lib/game-events";
import {
  remainingOnScreen,
  scorerOffsetMs,
  type TvEventRow,
  type TvGame,
} from "@/lib/tv-feed";
import {
  formatClock,
  periodName,
} from "@/components/scorer/basketball/helpers";
import { cn } from "@/lib/utils";
import { flashesFor, type Flash } from "./flashes";

const FLASH_MS = 3500;

const flashTone: Record<Flash["tone"], string> = {
  celebrate: "bg-primary text-white",
  warning: "bg-orange-soft text-orange-dark",
  danger: "bg-destructive text-white",
  info: "bg-white text-navy",
};

/** Time on the screen's clock, ticking while the game clock runs. */
function useNow(running: boolean) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => setNow(Date.now()), 100);
    return () => window.clearInterval(timer);
  }, [running]);
  return now;
}

/**
 * The basketball scoreboard for a gym TV: readable from across the court,
 * scores never covered, and a short flash for the moments that matter.
 */
export function BasketballTv({
  game,
  rows,
  screenOffsetMs,
}: {
  game: TvGame;
  rows: readonly TvEventRow[];
  /** Server time minus this screen's time. */
  screenOffsetMs: number;
}) {
  const t = useTranslations("Tv");
  const scorer = useTranslations("Scorer");
  const format = useFormatter();
  const rules = useMemo(
    () => basketballRulesSchema.parse(game.rules ?? {}),
    [game.rules],
  );
  const events = useMemo(
    () =>
      parseGameEvents(
        "basketball",
        rows.map((row) => ({
          id: row.id,
          sequence: row.sequence,
          type: row.type,
          payload: row.payload as never,
          clock_ms: row.clockMs,
          occurred_at: row.occurredAt,
        })),
      ).events as BasketballEvent[],
    [rows],
  );
  const state = useMemo(
    () => reduceBasketballGame(events, rules),
    [events, rules],
  );
  const offset = useMemo(() => scorerOffsetMs(rows), [rows]);
  const live = state.phase === "live";
  const now = useNow(live && state.clock.running);
  const clockMs = remainingOnScreen({
    remainingMs: state.clock.remainingMs,
    running: state.clock.running,
    asOf: state.clock.asOf,
    now,
    screenOffsetMs,
    scorerOffset: offset,
  });
  const shotClockMs = remainingOnScreen({
    remainingMs: state.shotClock.remainingMs,
    running: state.clock.running,
    asOf: state.clock.asOf,
    now,
    screenOffsetMs,
    scorerOffset: offset,
  });
  const teamNames: Record<Side, string> = {
    home: game.homeName ?? t("home"),
    away: game.awayName ?? t("away"),
  };

  // Flash only what happens while the screen is on, not the game so far.
  const seen = useRef<Set<string> | null>(null);
  const [queue, setQueue] = useState<Flash[]>([]);
  useEffect(() => {
    const all = flashesFor(state.effects, state, teamNames);
    if (seen.current === null) {
      seen.current = new Set(all.map((flash) => flash.id));
      return;
    }
    const fresh = all.filter((flash) => !seen.current!.has(flash.id));
    if (!fresh.length) return;
    for (const flash of fresh) seen.current.add(flash.id);
    setQueue((current) => [...current, ...fresh].slice(-4));
    // teamNames is derived from game; effects drive this.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.effects]);
  const flash = queue[0];
  useEffect(() => {
    if (!flash) return;
    const timer = window.setTimeout(
      () => setQueue((current) => current.slice(1)),
      FLASH_MS,
    );
    return () => window.clearTimeout(timer);
  }, [flash]);

  const latest = [...state.log]
    .reverse()
    .find((entry) => entry.status === "applied" && entry.type !== "void");
  const inTimeout = live && !state.clock.running && latest?.type === "timeout";
  const period =
    state.phase === "pregame"
      ? t("pregame")
      : state.phase === "final"
        ? t("final")
        : periodName(state.period, rules, (key, values) => scorer(key, values));
  const banner =
    state.phase === "final"
      ? t("finalBanner", {
          team: state.winner ? teamNames[state.winner] : "",
        })
      : state.phase === "break"
        ? state.period === rules.quarters / 2
          ? t("halftime")
          : t("endOf", { period })
        : inTimeout
          ? t("timeoutBanner")
          : null;

  const panel = (side: Side) => {
    const home = side === "home";
    const fouls = teamFoulsThisPeriod(state, side, rules);
    const penalty = inPenalty(state, side, rules);
    const left = timeoutsLeft(state, side, rules);
    const group = timeoutGroup(Math.max(state.period, 1), rules);
    const allowance = left + (state.teams[side].timeoutsUsed[group] ?? 0);
    const winner = state.phase === "final" && state.winner === side;
    const loser = state.phase === "final" && state.winner && !winner;
    return (
      <section
        key={side}
        aria-label={teamNames[side]}
        className={cn(
          "flex min-w-0 flex-col items-center justify-center gap-[2vh] px-[2vw]",
          home ? "order-1" : "order-3",
          loser && "opacity-60",
        )}
      >
        <h2 className="flex w-full items-center justify-center gap-[1vw] text-center font-display text-[4.2vw] leading-none font-bold tracking-wide uppercase">
          <span
            className={cn(
              "h-[4vw] w-[0.7vw] shrink-0 rounded-full",
              home ? "bg-primary" : "bg-white",
            )}
            aria-hidden="true"
          />
          <span className="truncate">{teamNames[side]}</span>
        </h2>
        <p
          className={cn(
            "font-display text-[19vw] leading-[0.82] font-bold tabular-nums",
            winner && "text-primary",
          )}
        >
          {state.teams[side].score}
        </p>
        {state.phase !== "pregame" && state.phase !== "final" && (
          <div className="flex flex-col items-center gap-[1.4vh] text-[2vw] font-semibold text-on-dark-muted">
            <p className="flex items-center gap-[1vw]">
              <span>{t("fouls")}</span>
              <span className="flex gap-[0.5vw]" aria-hidden="true">
                {Array.from({ length: rules.teamBonusAfter }, (_, i) => (
                  <span
                    key={i}
                    className={cn(
                      "size-[1.4vw] rounded-full",
                      i < fouls
                        ? penalty
                          ? "bg-primary"
                          : "bg-white"
                        : "bg-white/15",
                    )}
                  />
                ))}
              </span>
              <span className="font-display text-[2.6vw] text-white tabular-nums">
                {fouls}
              </span>
              {penalty && (
                <span className="rounded-[0.5vw] bg-primary px-[0.8vw] py-[0.2vw] font-bold text-white uppercase">
                  {t("bonus")}
                </span>
              )}
            </p>
            <p className="flex items-center gap-[1vw]">
              <span>{t("timeouts")}</span>
              <span className="flex gap-[0.5vw]" aria-hidden="true">
                {Array.from({ length: allowance }, (_, i) => (
                  <span
                    key={i}
                    className={cn(
                      "h-[1.4vw] w-[2.4vw] rounded-[0.3vw]",
                      i < left ? "bg-success-soft" : "bg-white/15",
                    )}
                  />
                ))}
              </span>
              <span className="sr-only">{left}</span>
            </p>
          </div>
        )}
      </section>
    );
  };

  return (
    <div className="flex h-dvh w-full flex-col overflow-hidden bg-navy text-on-dark select-none">
      <header className="flex items-center justify-between gap-[2vw] px-[3vw] pt-[2.5vh] text-[1.8vw] font-semibold text-on-dark-muted">
        <span className="truncate">
          {game.leagueName} · {game.divisionName}
        </span>
        <span className="truncate">
          {game.venue}
          {game.round ? ` · ${t("round", { round: game.round })}` : ""}
        </span>
      </header>

      <main className="grid min-h-0 flex-1 grid-cols-[1fr_auto_1fr] items-center">
        {sides.map(panel)}
        <div className="order-2 flex flex-col items-center gap-[2vh] px-[1vw]">
          <p className="rounded-[1vw] bg-white/10 px-[2vw] py-[0.6vh] font-display text-[3.6vw] leading-none font-semibold tracking-wider uppercase">
            {period}
          </p>
          {state.phase === "pregame" ? (
            <p className="text-center font-display text-[3vw] leading-tight font-semibold">
              {game.scheduledAt
                ? t("tipOffAt", {
                    time: format.dateTime(new Date(game.scheduledAt), {
                      hour: "numeric",
                      minute: "2-digit",
                    }),
                  })
                : t("tipOffSoon")}
            </p>
          ) : (
            <p
              className={cn(
                "rounded-[1.5vw] bg-black/40 px-[2.5vw] py-[1vh] font-display text-[11vw] leading-none font-bold tabular-nums ring-1 ring-white/10",
                live && !state.clock.running && "text-orange-soft",
              )}
            >
              {live ? formatClock(clockMs) : "0:00"}
            </p>
          )}
          {live && rules.shotClock.enabled && (
            <p
              className={cn(
                "rounded-[1vw] border-[0.3vw] px-[1.5vw] font-display text-[6vw] leading-tight font-bold tabular-nums",
                shotClockMs <= 5000
                  ? "border-destructive bg-destructive text-white"
                  : "border-white/30 text-orange-soft",
              )}
              aria-label={t("shotClock")}
            >
              {Math.ceil(shotClockMs / 1000)}
            </p>
          )}
          {state.possession &&
            state.phase !== "pregame" &&
            state.phase !== "final" && (
              <p
                className="flex items-center gap-[1vw] font-display text-[4vw] leading-none"
                aria-label={t("possession", {
                  team: teamNames[state.possession],
                })}
              >
                <span
                  className={
                    state.possession === "home"
                      ? "text-primary"
                      : "text-white/15"
                  }
                >
                  ◀
                </span>
                <span className="text-[1.4vw] font-semibold tracking-[0.3em] text-on-dark-muted uppercase">
                  {t("arrow")}
                </span>
                <span
                  className={
                    state.possession === "away"
                      ? "text-primary"
                      : "text-white/15"
                  }
                >
                  ▶
                </span>
              </p>
            )}
        </div>
      </main>

      {/* The bottom strip: a flash, the game state, or the sponsor line. Never over the score. */}
      <footer className="h-[13vh] shrink-0 px-[3vw] pb-[2.5vh]">
        {flash ? (
          <div
            key={flash.id}
            role="status"
            className={cn(
              "animate-flash-in flex h-full items-center justify-center gap-[2vw] rounded-[1.5vw] px-[2vw] text-center font-display text-[4.4vw] leading-none font-bold tracking-wide uppercase shadow-2xl",
              flashTone[flash.tone],
            )}
          >
            {t(`flash.${flash.key}`, flash.values)}
          </div>
        ) : banner ? (
          <div className="flex h-full items-center justify-center rounded-[1.5vw] bg-white/10 font-display text-[4vw] font-bold tracking-wider uppercase">
            {banner}
          </div>
        ) : (
          <div className="flex h-full items-center justify-between rounded-[1.5vw] bg-black/20 px-[2.5vw] text-[1.8vw] font-semibold text-on-dark-muted">
            <span>{game.seasonName}</span>
            <span className="font-display tracking-[0.25em] text-white uppercase">
              {t("poweredBy")}
            </span>
          </div>
        )}
      </footer>
    </div>
  );
}
