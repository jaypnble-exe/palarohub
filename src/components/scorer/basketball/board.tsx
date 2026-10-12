"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import type { createClient } from "@/lib/supabase/browser";
import type { ScorerSetup } from "@/lib/game-events";
import type { Reconciled } from "@/lib/offline/reconcile";
import type { ScorebookStore } from "@/lib/offline/scorebook-store";
import {
  inPenalty,
  lastUndoableEvent,
  mustSubstitute,
  reduceBasketballGame,
  sides,
  teamFoulsThisPeriod,
  timeoutsLeft,
  validateBasketballEvent,
  type BasketballEvent,
  type BasketballEventOf,
  type BasketballEventType,
  type BasketballRules,
  type Side,
} from "@/lib/sports/basketball";
import { Button } from "@/components/ui/button";
import { useEventLog, type SyncStatus } from "../use-event-log";
import {
  formatClock,
  periodName,
  playerLabel,
  remainingAt,
  useGameClock,
} from "./helpers";
import { Pregame } from "./pregame";
import { PlayerSheet } from "./player-sheet";
import { PlayByPlay } from "./play-by-play";
import { BoxScores } from "./box-score";

export type RecordEvent = <T extends BasketballEventType>(
  type: T,
  payload: BasketballEventOf<T>["payload"],
) => boolean;

const syncTone: { [key in SyncStatus]: string } = {
  synced: "bg-green-700 text-white",
  saving: "bg-navy-secondary text-on-dark",
  retrying: "bg-orange-soft text-orange-dark",
  replaced: "bg-destructive text-white",
  closed: "bg-destructive text-white",
  conflict: "bg-destructive text-white",
};

export function BasketballScorebook({
  supabase,
  store,
  setup,
  log: initial,
  openedOffline = false,
}: {
  supabase: ReturnType<typeof createClient>;
  store: ScorebookStore;
  setup: ScorerSetup;
  log: Reconciled<BasketballEvent>;
  openedOffline?: boolean;
}) {
  const t = useTranslations("Scorer");
  const rules = setup.rules as BasketballRules;
  const log = useEventLog(supabase, setup.gameId, initial, store);
  const [conflicts, setConflicts] = useState(initial.conflicts);
  const state = useMemo(
    () => reduceBasketballGame(log.events, rules),
    [log.events, rules],
  );
  const clockMs = useGameClock(state.clock);
  const sequence = useRef(0);
  const [notice, setNotice] = useState<string>();
  const [sheet, setSheet] = useState<{ side: Side; playerId: string }>();
  const [showLog, setShowLog] = useState(false);
  const teamNames = useMemo(
    () => ({ home: setup.teams.home.name, away: setup.teams.away.name }),
    [setup.teams],
  );

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(undefined), 4000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const record: RecordEvent = useCallback(
    (type, payload) => {
      sequence.current = Math.max(sequence.current, state.lastSequence) + 1;
      const now = Date.now();
      const event = {
        id: crypto.randomUUID(),
        sequence: sequence.current,
        clockMs: state.phase === "live" ? remainingAt(state.clock, now) : null,
        createdAt: new Date(now).toISOString(),
        type,
        payload,
      } as BasketballEvent;
      const error = validateBasketballEvent(state, event, rules);
      if (error) {
        setNotice(`errors.${error}`);
        return false;
      }
      return log.append(event, state.period);
    },
    [state, rules, log],
  );

  // Freeze both approved rosters into the game the first time it is opened.
  const rostered = useRef(false);
  useEffect(() => {
    if (rostered.current || state.log.some((entry) => entry.type === "roster"))
      return;
    rostered.current = true;
    for (const side of sides)
      record("roster", { team: side, players: setup.teams[side].players });
  }, [state.log, record, setup.teams]);

  const undo = lastUndoableEvent(state);
  const latest = [...state.log]
    .reverse()
    .find((entry) => entry.status === "applied");
  const alerts = state.effects.filter(
    (effect) =>
      effect.eventId === latest?.eventId &&
      [
        "foulWarning",
        "fouledOut",
        "ejected",
        "coachEjected",
        "teamPenalty",
      ].includes(effect.kind),
  );
  const blocked = ["replaced", "closed", "conflict"].includes(log.status);
  const period = periodName(state.period, rules, t);

  return (
    <div className="flex min-h-full flex-col gap-3 p-3 sm:p-4">
      <header className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 rounded-2xl bg-navy p-3 text-on-dark">
        {sides.map((side) => (
          <div
            key={side}
            className={
              side === "home" ? "order-1 text-left" : "order-3 text-right"
            }
          >
            <p className="truncate text-sm font-semibold text-on-dark-muted">
              {teamNames[side]}
            </p>
            <p className="font-display text-5xl font-semibold leading-none sm:text-6xl">
              {state.teams[side].score}
            </p>
            {state.phase !== "pregame" && (
              <p className="mt-1 text-xs text-on-dark-muted">
                {t("teamFouls", {
                  count: teamFoulsThisPeriod(state, side, rules),
                })}
                {inPenalty(state, side, rules) && (
                  <span className="ml-1 rounded bg-primary px-1.5 py-0.5 font-bold text-white">
                    {t("penalty")}
                  </span>
                )}
                {" · "}
                {t("timeoutsLeft", { count: timeoutsLeft(state, side, rules) })}
              </p>
            )}
          </div>
        ))}
        <div className="order-2 text-center">
          <p className="text-sm font-semibold text-on-dark-muted">{period}</p>
          <p
            className="font-display text-4xl font-semibold tabular-nums sm:text-5xl"
            aria-live="off"
          >
            {state.phase === "live" ? formatClock(clockMs) : "–"}
          </p>
          <span
            role="status"
            className={`mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${syncTone[log.status]}`}
          >
            {t(`sync.${log.status}`, { count: log.unsaved })}
          </span>
        </div>
      </header>

      {blocked && (
        <p
          role="alert"
          className="rounded-xl bg-destructive p-4 font-semibold text-white"
        >
          {t(`blocked.${log.status}`)}
        </p>
      )}
      {openedOffline && log.status !== "synced" && (
        <p
          role="status"
          className="rounded-xl bg-accent p-3 text-sm font-semibold"
        >
          {t("openedOffline")}
        </p>
      )}
      {log.storageFailed && (
        <p
          role="alert"
          className="rounded-xl bg-orange-soft p-3 font-semibold text-orange-dark"
        >
          {t("storageFailed")}
        </p>
      )}
      {conflicts.length > 0 && (
        <div
          role="alert"
          className="space-y-3 rounded-xl border-2 border-destructive bg-card p-4"
        >
          <p className="font-semibold text-destructive">
            {t("conflicts", { count: conflicts.length })}
          </p>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              if (!window.confirm(t("confirmSetAside"))) return;
              void store
                .discard(conflicts.map((event) => event.id))
                .finally(() => setConflicts([]));
            }}
          >
            {t("setAside")}
          </Button>
        </div>
      )}
      {notice && (
        <p
          role="alert"
          className="rounded-xl border-2 border-destructive bg-card p-3 font-semibold text-destructive"
        >
          {t(notice)}
        </p>
      )}
      {alerts.map((effect, index) => (
        <p
          key={`${effect.kind}-${index}`}
          role="alert"
          className="rounded-xl bg-orange-soft p-3 font-semibold text-orange-dark"
        >
          {t(`alert.${effect.kind}`, {
            player: effect.team
              ? playerLabel(state, effect.team, effect.playerId)
              : "",
            team: effect.team ? teamNames[effect.team] : "",
          })}
        </p>
      ))}
      {state.phase !== "pregame" &&
        sides.flatMap((side) =>
          mustSubstitute(state, side).map((id) => (
            <p
              key={id}
              role="alert"
              className="rounded-xl bg-destructive/10 p-3 font-semibold text-destructive"
            >
              {t("alert.mustSubstitute", {
                player: playerLabel(state, side, id),
              })}
            </p>
          )),
        )}

      {state.phase === "pregame" && (
        <Pregame
          state={state}
          teamNames={teamNames}
          record={record}
          disabled={blocked}
        />
      )}

      {(state.phase === "live" || state.phase === "break") && (
        <>
          <div className="grid gap-3 md:grid-cols-2">
            {sides.map((side) => {
              const team = state.teams[side];
              const bench = team.playerIds.filter(
                (id) => team.players[id].present && !team.onCourt.includes(id),
              );
              return (
                <section
                  key={side}
                  className="space-y-3 rounded-2xl border bg-card p-3"
                  aria-label={teamNames[side]}
                >
                  <h2 className="truncate text-lg font-semibold">
                    {teamNames[side]}
                  </h2>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {team.onCourt.map((id) => {
                      const line = team.players[id];
                      return (
                        <button
                          key={id}
                          type="button"
                          disabled={blocked}
                          onClick={() => setSheet({ side, playerId: id })}
                          className="flex min-h-20 flex-col items-start justify-center rounded-xl border-2 bg-background px-3 py-2 text-left data-[out=true]:border-destructive data-[out=true]:bg-destructive/10"
                          data-out={Boolean(line.disqualified)}
                        >
                          <span className="font-display text-3xl font-semibold leading-none">
                            {line.jersey}
                          </span>
                          <span className="w-full truncate text-sm font-semibold">
                            {line.name}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {t("playerLine", {
                              points: line.points,
                              fouls: line.foulCount,
                            })}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      disabled={blocked || state.phase !== "live"}
                      onClick={() => record("timeout", { team: side })}
                    >
                      {t("timeout")}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={blocked}
                      onClick={() => {
                        if (
                          window.confirm(
                            t("confirmBenchTechnical", {
                              team: teamNames[side],
                            }),
                          )
                        )
                          record("foul", {
                            team: side,
                            playerId: null,
                            kind: "technical",
                          });
                      }}
                    >
                      {t("benchTechnical")}
                    </Button>
                    <Button
                      type="button"
                      variant={state.possession === side ? "dark" : "ghost"}
                      disabled={blocked}
                      aria-pressed={state.possession === side}
                      onClick={() => record("possession", { team: side })}
                    >
                      {t("possession")}
                    </Button>
                  </div>
                  {bench.length > 0 && (
                    <details>
                      <summary className="min-h-11 cursor-pointer py-2 text-sm font-semibold">
                        {t("bench", { count: bench.length })}
                      </summary>
                      <div className="flex flex-wrap gap-2">
                        {bench.map((id) => (
                          <button
                            key={id}
                            type="button"
                            disabled={blocked}
                            onClick={() => setSheet({ side, playerId: id })}
                            className="min-h-11 rounded-lg border px-3 text-sm data-[out=true]:line-through"
                            data-out={Boolean(team.players[id].disqualified)}
                          >
                            {playerLabel(state, side, id)}
                          </button>
                        ))}
                      </div>
                    </details>
                  )}
                </section>
              );
            })}
          </div>
        </>
      )}

      {state.phase === "final" && (
        <section className="space-y-4">
          <h2 className="font-display text-3xl font-semibold">
            {t("finalTitle")}
          </h2>
          <p className="text-lg">
            {t("finalScore", {
              home: teamNames.home,
              homeScore: state.teams.home.score,
              away: teamNames.away,
              awayScore: state.teams.away.score,
            })}
          </p>
          <p className="rounded-xl border bg-card p-4 text-sm">
            {t("finalNext")}
          </p>
          <BoxScores state={state} teamNames={teamNames} />
        </section>
      )}

      <footer className="sticky bottom-0 mt-auto flex flex-wrap items-center gap-2 border-t bg-background pt-3">
        <Button
          type="button"
          variant="dark"
          className="min-w-32 text-lg"
          disabled={blocked || !undo}
          onClick={() => undo && record("void", { eventId: undo.eventId })}
        >
          {t("undo")}
        </Button>
        {state.phase === "live" && (
          <Button
            type="button"
            className="min-w-40 text-lg"
            disabled={blocked}
            onClick={() =>
              record(state.clock.running ? "clock_stop" : "clock_start", {})
            }
          >
            {t(state.clock.running ? "stopClock" : "startClock")}
          </Button>
        )}
        {state.phase === "live" && (
          <Button
            type="button"
            variant="outline"
            disabled={blocked}
            onClick={() => {
              if (window.confirm(t("confirmEndPeriod", { period })))
                record("period_end", {});
            }}
          >
            {t("endPeriod", { period })}
          </Button>
        )}
        {state.phase === "break" && (
          <>
            {!(
              state.period >= rules.quarters &&
              state.teams.home.score !== state.teams.away.score
            ) && (
              <Button
                type="button"
                disabled={blocked}
                onClick={() => record("period_start", {})}
              >
                {t("startPeriod", {
                  period: periodName(state.period + 1, rules, t),
                })}
              </Button>
            )}
            {state.period >= rules.quarters &&
              state.teams.home.score !== state.teams.away.score && (
                <Button
                  type="button"
                  disabled={blocked}
                  onClick={() => {
                    if (window.confirm(t("confirmFinal")))
                      record("game_end", {});
                  }}
                >
                  {t("finalBuzzer")}
                </Button>
              )}
          </>
        )}
        <Button
          type="button"
          variant="ghost"
          className="ml-auto"
          onClick={() => setShowLog(!showLog)}
        >
          {t(showLog ? "hidePlayByPlay" : "showPlayByPlay")}
        </Button>
      </footer>

      {showLog && (
        <PlayByPlay
          state={state}
          events={log.events}
          teamNames={teamNames}
          rules={rules}
          record={record}
          disabled={blocked}
        />
      )}

      {sheet && (
        <PlayerSheet
          state={state}
          side={sheet.side}
          playerId={sheet.playerId}
          record={record}
          onClose={() => setSheet(undefined)}
        />
      )}
    </div>
  );
}
