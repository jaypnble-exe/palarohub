"use client";
import { useTranslations } from "next-intl";
import {
  inPenalty,
  shotClockApplies,
  sides,
  teamFoulsThisPeriod,
  timeoutGroup,
  timeoutsLeft,
  type BasketballGameState,
  type BasketballRules,
  type Side,
} from "@/lib/sports/basketball";
import { cn } from "@/lib/utils";
import type { SyncStatus } from "../use-event-log";
import { formatClock } from "./helpers";

const syncTone: { [key in SyncStatus]: string } = {
  synced: "bg-success/90 text-white",
  saving: "bg-white/15 text-on-dark",
  retrying: "bg-orange-soft text-orange-dark",
  replaced: "bg-destructive text-white",
  closed: "bg-destructive text-white",
  conflict: "bg-destructive text-white",
};

/** Marks that fill up, e.g. team fouls towards the penalty. Decorative. */
function Pips({
  filled,
  total,
  on,
  shape = "dot",
}: {
  filled: number;
  total: number;
  on: string;
  shape?: "dot" | "bar";
}) {
  return (
    <span className="inline-flex gap-1" aria-hidden="true">
      {Array.from({ length: total }, (_, index) => (
        <span
          key={index}
          className={cn(
            shape === "dot" ? "size-2.5 rounded-full" : "h-2.5 w-4 rounded-sm",
            index < filled ? on : "bg-white/20",
          )}
        />
      ))}
    </span>
  );
}

/**
 * The scorer's scoreboard, laid out like the one on the gym wall: both
 * scores huge, the clock in the middle, and each team's fouls, timeouts,
 * bonus and possession arrow at a glance.
 */
export function Scoreboard({
  state,
  rules,
  teamNames,
  clockMs,
  shotClockMs,
  period,
  sync,
}: {
  state: BasketballGameState;
  rules: BasketballRules;
  teamNames: Record<Side, string>;
  clockMs: number;
  /** Shown only when the league uses a shot clock. */
  shotClockMs: number;
  period: string;
  sync: { status: SyncStatus; unsaved: number };
}) {
  const t = useTranslations("Scorer");
  const live = state.phase === "live";
  const started = state.phase !== "pregame";
  const running = live && state.clock.running;
  const group = timeoutGroup(Math.max(state.period, 1), rules);
  const periodLabel = (number: number) =>
    number <= rules.quarters ? `Q${number}` : `OT${number - rules.quarters}`;
  const periods = Array.from({ length: state.period }, (_, i) => i + 1);

  const team = (side: Side) => {
    const home = side === "home";
    const fouls = teamFoulsThisPeriod(state, side, rules);
    const penalty = inPenalty(state, side, rules);
    const left = timeoutsLeft(state, side, rules);
    const allowance = left + (state.teams[side].timeoutsUsed[group] ?? 0);
    const arrow = state.possession === side && started;
    return (
      <div
        key={side}
        className={cn(
          "flex min-w-0 flex-col gap-3 p-3 sm:p-5",
          home
            ? "order-1 items-start text-left"
            : "order-3 items-end text-right",
        )}
      >
        <p
          className={cn(
            "flex w-full min-w-0 items-center gap-2 text-sm font-bold tracking-wide uppercase sm:text-lg",
            !home && "flex-row-reverse",
          )}
        >
          <span
            className={cn(
              "h-4 w-1.5 shrink-0 rounded-full",
              home ? "bg-primary" : "bg-white",
            )}
            aria-hidden="true"
          />
          <span className="truncate">{teamNames[side]}</span>
          {arrow && (
            <span
              className="shrink-0 rounded-md bg-primary px-1.5 py-0.5 text-xs text-white"
              title={t("possessionTo", { team: teamNames[side] })}
            >
              {t("arrowBadge")}
            </span>
          )}
        </p>
        <p className="font-display text-7xl leading-[0.85] font-semibold tabular-nums sm:text-8xl">
          {state.teams[side].score}
        </p>
        {started && (
          <div
            className={cn(
              "flex w-full flex-col gap-1.5 text-xs font-semibold text-on-dark-muted sm:text-sm",
              home ? "items-start" : "items-end",
            )}
          >
            <span
              className={cn(
                "inline-flex items-center gap-2",
                !home && "flex-row-reverse",
              )}
            >
              <Pips
                filled={Math.min(fouls, rules.teamBonusAfter)}
                total={rules.teamBonusAfter}
                on={penalty ? "bg-primary" : "bg-white"}
              />
              {t("teamFouls", { count: fouls })}
              {penalty && (
                <span className="rounded bg-primary px-1.5 py-0.5 font-bold text-white uppercase">
                  {t("penalty")}
                </span>
              )}
            </span>
            <span
              className={cn(
                "inline-flex items-center gap-2",
                !home && "flex-row-reverse",
              )}
            >
              <Pips
                filled={left}
                total={allowance}
                on="bg-success-soft"
                shape="bar"
              />
              {t("timeoutsLeft", { count: left })}
            </span>
          </div>
        )}
      </div>
    );
  };

  return (
    <header className="overflow-hidden rounded-3xl bg-navy text-on-dark shadow-lg ring-1 ring-black/10">
      <div className="grid grid-cols-[1fr_auto_1fr] items-stretch">
        {sides.map(team)}
        <div className="order-2 flex flex-col items-center justify-center gap-2 border-x border-white/10 bg-black/15 px-3 py-3 text-center sm:px-6">
          <p className="rounded-lg bg-white/10 px-3 py-0.5 font-display text-lg font-semibold tracking-wider">
            {period}
          </p>
          <p
            className={cn(
              "rounded-xl bg-black/40 px-3 py-1 font-display text-5xl leading-none font-semibold tabular-nums ring-1 ring-white/10 sm:px-4 sm:text-6xl",
              live && !running && "text-orange-soft",
            )}
            aria-live="off"
          >
            {live ? formatClock(clockMs) : "–"}
          </p>
          {live && shotClockApplies(clockMs) && (
            <p
              className={cn(
                "grid min-w-16 place-items-center rounded-lg border-2 px-2 font-display text-3xl leading-tight font-semibold tabular-nums",
                shotClockMs <= 5000
                  ? "border-destructive bg-destructive text-white"
                  : "border-white/30 text-orange-soft",
              )}
              aria-label={t("shotClockLabel", {
                seconds: Math.ceil(shotClockMs / 1000),
              })}
            >
              {Math.ceil(shotClockMs / 1000)}
            </p>
          )}
          {live && (
            <p
              className={cn(
                "inline-flex items-center gap-1.5 text-xs font-semibold",
                running ? "text-success-soft" : "text-orange-soft",
              )}
            >
              <span
                className={cn(
                  "size-2 rounded-full",
                  running
                    ? "animate-pulse bg-success-soft motion-reduce:animate-none"
                    : "bg-orange-soft",
                )}
                aria-hidden="true"
              />
              {t(running ? "clockRunning" : "clockStopped")}
            </p>
          )}
          {state.possession && started && (
            <p
              className="flex items-center gap-1.5 text-lg leading-none font-bold"
              aria-label={t("possessionTo", {
                team: teamNames[state.possession],
              })}
            >
              <span
                className={
                  state.possession === "home" ? "text-primary" : "text-white/20"
                }
              >
                ◀
              </span>
              <span className="text-[10px] tracking-widest text-on-dark-muted uppercase">
                {t("arrowLabel")}
              </span>
              <span
                className={
                  state.possession === "away" ? "text-primary" : "text-white/20"
                }
              >
                ▶
              </span>
            </p>
          )}
        </div>
      </div>
      <div className="flex items-center justify-between gap-3 border-t border-white/10 bg-black/20 px-3 py-1.5 text-xs font-semibold text-on-dark-muted sm:px-5">
        <span className="min-w-0 truncate tabular-nums">
          {periods
            .map(
              (number) =>
                `${periodLabel(number)} ${state.teams.home.pointsByPeriod[number] ?? 0}`,
            )
            .join("  ")}
        </span>
        <span
          role="status"
          className={cn(
            "shrink-0 rounded-full px-2.5 py-0.5",
            syncTone[sync.status],
          )}
        >
          {t(`sync.${sync.status}`, { count: sync.unsaved })}
        </span>
        <span className="min-w-0 truncate text-right tabular-nums">
          {periods
            .map(
              (number) =>
                `${periodLabel(number)} ${state.teams.away.pointsByPeriod[number] ?? 0}`,
            )
            .join("  ")}
        </span>
      </div>
    </header>
  );
}
