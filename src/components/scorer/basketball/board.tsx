"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import type { createClient } from "@/lib/supabase/browser";
import type { ScorerSetup } from "@/lib/game-events";
import type { Reconciled } from "@/lib/offline/reconcile";
import type { ScorebookStore } from "@/lib/offline/scorebook-store";
import {
  lastUndoableEvent,
  mustSubstitute,
  reduceBasketballGame,
  sides,
  timeoutsLeft,
  validateBasketballEvent,
  type BasketballEvent,
  type BasketballEventOf,
  type BasketballEventType,
  type BasketballRules,
  type Side,
} from "@/lib/sports/basketball";
import { Button } from "@/components/ui/button";
import { isNetworkError } from "@/lib/offline/network";
import { paymentStatus } from "@/lib/domain/payments";
import { useEventLog } from "../use-event-log";
import {
  describeEvent,
  periodName,
  splitName,
  playerLabel,
  remainingAt,
  useGameClock,
} from "./helpers";
import { Scoreboard } from "./scoreboard";
import { Icon } from "@/components/ui/icon";
import { Pregame } from "./pregame";
import { PlayerSheet } from "./player-sheet";
import { PlayByPlay } from "./play-by-play";
import { BoxScores } from "./box-score";
import { BenchFoulSheet } from "./bench-foul-sheet";
import { FreeThrows } from "./free-throws";
import { ShotClockControls, useShotClock } from "./shot-clock";
import { RunningScore } from "./running-score";
import { Confirmations } from "./confirmations";
import { cardVariants } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Alert } from "@/components/ui/alert";

export type RecordEvent = <T extends BasketballEventType>(
  type: T,
  payload: BasketballEventOf<T>["payload"],
) => boolean;

/** Surnames are never split mid-word, so the longest word sets the size. */
function surnameSize(last: string) {
  const longest = Math.max(...last.split(" ").map((word) => word.length));
  if (longest > 10) return "text-sm tracking-tight";
  if (longest > 8) return "text-base";
  if (longest > 6) return "text-lg tracking-wide";
  return "text-xl tracking-wide";
}

/** Decorative foul marks on a player tile: orange at the warning, red when out. */
function FoulDots({ fouls, limit }: { fouls: number; limit: number }) {
  return (
    <span className="inline-flex gap-1" aria-hidden="true">
      {Array.from({ length: limit }, (_, index) => (
        <span
          key={index}
          className={cn(
            "size-2 rounded-full",
            index >= fouls
              ? "bg-border"
              : fouls >= limit
                ? "bg-destructive"
                : fouls === limit - 1
                  ? "bg-primary"
                  : "bg-navy",
          )}
        />
      ))}
    </span>
  );
}

export function BasketballScorebook({
  supabase,
  store,
  setup,
  log: initial,
  openedOffline = false,
  reopenComment = null,
  onTakeOver,
}: {
  supabase: ReturnType<typeof createClient>;
  store: ScorebookStore;
  setup: ScorerSetup;
  log: Reconciled<BasketballEvent>;
  openedOffline?: boolean;
  /** Why the commissioner sent this game back, if they did. */
  reopenComment?: string | null;
  /** Make this device the official scorer again after another took over. */
  onTakeOver?: () => void;
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
  const [benchSheet, setBenchSheet] = useState<Side>();
  const [showLog, setShowLog] = useState(false);
  const [showRunning, setShowRunning] = useState(false);
  const [tipSkipped, setTipSkipped] = useState(false);
  const shotClockMs = useShotClock(state);
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
      record("roster", {
        team: side,
        // The snapshot keeps only what the event schema allows.
        players: setup.teams[side].players.map(
          ({ playerId, name, jersey }) => ({
            playerId,
            name,
            jersey,
          }),
        ),
      });
  }, [state.log, record, setup.teams]);

  const undo = lastUndoableEvent(state);
  const undoEvent = undo
    ? log.events.find((event) => event.id === undo.eventId)
    : undefined;
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
        "shotClockViolation",
        "openingTip",
        "jumpBall",
        "periodPossession",
      ].includes(effect.kind),
  );
  const [review, setReview] = useState<"open" | "submitting" | "submitted">(
    setup.status === "submitted" || setup.status === "approved"
      ? "submitted"
      : "open",
  );
  const blocked =
    review !== "open" ||
    ["replaced", "closed", "conflict"].includes(log.status);
  // Payment check for this game: earlier games plus the one about to start.
  const behind = useMemo(
    () =>
      sides.flatMap((side) => {
        const payment = setup.teams[side].payment;
        if (!payment) return [];
        const status = paymentStatus({
          quotaHalalas: payment.quotaHalalas,
          paidHalalas: payment.paidHalalas,
          finesHalalas: payment.finesHalalas,
          gamesTotal: payment.gamesTotal,
          gamesCounted: payment.gamesPlayed + 1,
        });
        return status.behind
          ? [{ side, behindByHalalas: status.behindByHalalas }]
          : [];
      }),
    [setup.teams],
  );
  const suspended = useMemo(
    () =>
      new Set(
        [...setup.teams.home.players, ...setup.teams.away.players]
          .filter((player) => player.suspended)
          .map((player) => player.playerId),
      ),
    [setup.teams],
  );

  const blockedByPayment = setup.paymentPolicy === "block" && behind.length > 0;
  const readyToTipOff =
    sides.every((side) => state.teams[side].startersSet) && !blockedByPayment;

  async function submit() {
    if (!window.confirm(t("confirmSubmit"))) return;
    setReview("submitting");
    const { error } = await supabase
      .rpc("submit_game", {
        p_game_id: setup.gameId,
        p_last_sequence: state.lastSequence,
      })
      .then(
        (result) => result,
        () => ({ error: { message: "network" } }),
      );
    if (!error) return setReview("submitted");
    setReview("open");
    setNotice(
      error.message.includes("events_not_synced")
        ? "submitNotSynced"
        : error.message.includes("game_not_open")
          ? "blocked.closed"
          : isNetworkError(error) || error.message === "network"
            ? "submitOffline"
            : "submitFailed",
    );
  }
  const period = periodName(state.period, rules, t);
  const undoText = undoEvent
    ? describeEvent(undoEvent, state, teamNames, period, t)
    : null;

  return (
    <div className="flex min-h-full flex-col gap-3 p-3 sm:p-4">
      <Scoreboard
        state={state}
        rules={rules}
        teamNames={teamNames}
        clockMs={clockMs}
        shotClockMs={shotClockMs}
        period={period}
        sync={{ status: log.status, unsaved: log.unsaved }}
      />

      {blocked && (
        <Alert
          tone="critical"
          className="text-base"
          action={
            log.status === "replaced" || log.status === "conflict" ? (
              // Reopening checks access again: staff can take the game back
              // with one tap, a scorer with a new PIN.
              <Button
                type="button"
                variant="outline"
                className="min-h-11 py-2 text-foreground"
                onClick={() =>
                  log.status === "replaced" && onTakeOver
                    ? onTakeOver()
                    : window.location.reload()
                }
              >
                {t(log.status === "replaced" ? "takeOverAgain" : "reloadGame")}
              </Button>
            ) : undefined
          }
        >
          {t(`blocked.${log.status}`)}
        </Alert>
      )}
      {reopenComment && review === "open" && (
        <Alert tone="warning" className="text-base">
          {t("reopened", { comment: reopenComment })}
        </Alert>
      )}
      {openedOffline && log.status !== "synced" && (
        <Alert tone="info" className="text-base">
          {t("openedOffline")}
        </Alert>
      )}
      {log.storageFailed && (
        <Alert tone="warning" className="text-base">
          {t("storageFailed")}
        </Alert>
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
        <Alert tone="danger" className="text-base">
          {t(notice)}
        </Alert>
      )}
      {alerts.map((effect, index) => (
        <p
          key={`${effect.kind}-${index}`}
          role="alert"
          className="flex items-center gap-2 rounded-xl border-l-4 border-primary bg-orange-soft p-3 text-lg font-semibold text-orange-dark"
        >
          {t(`alert.${effect.kind}`, {
            player: effect.team
              ? playerLabel(state, effect.team, effect.playerId)
              : "",
            team: effect.team ? teamNames[effect.team] : "",
            other: effect.team
              ? teamNames[effect.team === "home" ? "away" : "home"]
              : "",
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
          suspended={suspended}
          behind={behind}
          blockUnpaid={setup.paymentPolicy === "block"}
        />
      )}

      {(state.phase === "live" || state.phase === "break") && (
        <>
          {state.phase === "live" && !state.possession && !tipSkipped && (
            <section
              aria-label={t("openingTipTitle")}
              className="flex flex-wrap items-center gap-3 rounded-2xl border-2 border-navy bg-card p-4"
            >
              <div className="min-w-0 flex-1">
                <h2 className="text-lg font-bold">{t("openingTipTitle")}</h2>
                <p className="text-sm text-muted-foreground">
                  {t("openingTipHelp")}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {sides.map((side) => (
                  <Button
                    key={side}
                    type="button"
                    className="min-h-12"
                    variant={side === "home" ? "default" : "dark"}
                    disabled={blocked}
                    onClick={() => record("jump_ball_won", { team: side })}
                  >
                    {teamNames[side]}
                  </Button>
                ))}
                <Button
                  type="button"
                  variant="ghost"
                  className="min-h-12"
                  onClick={() => setTipSkipped(true)}
                >
                  {t("openingTipLater")}
                </Button>
              </div>
            </section>
          )}
          <FreeThrows
            state={state}
            teamNames={teamNames}
            record={record}
            disabled={blocked}
          />
          <div className="grid gap-3 md:grid-cols-2">
            {sides.map((side) => {
              const team = state.teams[side];
              const bench = team.playerIds.filter(
                (id) => team.players[id].present && !team.onCourt.includes(id),
              );
              return (
                <section
                  key={side}
                  className={cn(
                    cardVariants({ padding: "sm" }),
                    "@container space-y-3 border-t-4",
                    side === "home" ? "border-t-primary" : "border-t-navy",
                  )}
                  aria-label={teamNames[side]}
                >
                  <div className="flex items-center justify-between gap-2">
                    <h2 className="truncate text-lg font-bold">
                      {teamNames[side]}
                    </h2>
                    <span className="text-sm font-semibold text-muted-foreground">
                      {t("onCourtCount", { count: team.onCourt.length })}
                    </span>
                  </div>
                  {/* Three tiles a row when the panel is wide enough, otherwise two. */}
                  <div className="grid grid-cols-2 gap-2 @lg:grid-cols-3 @5xl:grid-cols-5">
                    {team.onCourt.map((id) => {
                      const line = team.players[id];
                      const { first, last } = splitName(line.name);
                      return (
                        <button
                          key={id}
                          type="button"
                          disabled={blocked}
                          onClick={() => setSheet({ side, playerId: id })}
                          className="flex min-h-28 min-w-0 flex-col justify-between gap-2 rounded-2xl border-2 border-border bg-background p-3 text-left shadow-sm transition hover:border-navy active:scale-[0.97] disabled:opacity-60 data-[out=true]:border-destructive data-[out=true]:bg-destructive-soft data-[warn=true]:border-primary data-[warn=true]:bg-orange-soft/40"
                          data-out={Boolean(line.disqualified)}
                          data-warn={line.foulCount === rules.foulOut - 1}
                        >
                          {/* Read as "4 Juan Dela Cruz"; shown like the back of a jersey. */}
                          <span className="sr-only">{line.name}</span>
                          <span
                            className="flex w-full min-w-0 items-center gap-2.5"
                            aria-hidden="true"
                          >
                            <span
                              className={cn(
                                "grid h-12 min-w-12 shrink-0 place-items-center rounded-xl px-1.5 font-display text-3xl leading-none font-semibold tabular-nums",
                                side === "home"
                                  ? "bg-primary text-white"
                                  : "bg-navy text-on-dark",
                              )}
                            >
                              {line.jersey}
                            </span>
                            <span className="min-w-0 flex-1">
                              {/* Long surnames shrink and wrap rather than being cut off. */}
                              <span
                                className={cn(
                                  "line-clamp-2 font-display leading-[1.05] font-bold uppercase",
                                  surnameSize(last),
                                )}
                              >
                                {last}
                              </span>
                              {first && (
                                <span className="block truncate text-xs font-semibold text-muted-foreground">
                                  {first}
                                </span>
                              )}
                            </span>
                          </span>
                          <span className="flex w-full items-center justify-between gap-2">
                            <span className="text-xs font-semibold whitespace-nowrap text-muted-foreground">
                              {t("playerLine", {
                                points: line.points,
                                fouls: line.foulCount,
                              })}
                            </span>
                            <FoulDots
                              fouls={line.foulCount}
                              limit={rules.foulOut}
                            />
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  {bench.length > 0 && (
                    <div className="space-y-1.5">
                      <p className="text-xs font-bold tracking-wide text-muted-foreground uppercase">
                        {t("bench", { count: bench.length })}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {bench.map((id) => (
                          <button
                            key={id}
                            type="button"
                            disabled={blocked}
                            onClick={() => setSheet({ side, playerId: id })}
                            className="min-h-11 rounded-xl border bg-accent/50 px-3 text-sm font-semibold transition hover:border-navy data-[out=true]:line-through data-[out=true]:opacity-60"
                            data-out={Boolean(team.players[id].disqualified)}
                          >
                            <span className="sr-only">
                              {playerLabel(state, side, id)}
                            </span>
                            <span aria-hidden="true">
                              <span className="font-display text-base">
                                #{team.players[id].jersey}
                              </span>{" "}
                              <span className="font-bold uppercase">
                                {splitName(team.players[id].name).last}
                              </span>
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="grid grid-cols-3 gap-2 border-t pt-3">
                    <div className="space-y-1">
                      <Button
                        type="button"
                        variant="outline"
                        className="min-h-12 w-full px-2"
                        disabled={blocked || state.phase !== "live"}
                        onClick={() => record("timeout", { team: side })}
                      >
                        {t("timeout")}
                      </Button>
                      <p className="text-center text-xs text-muted-foreground">
                        {t("timeoutsLeft", {
                          count: timeoutsLeft(state, side, rules),
                        })}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      className="min-h-12 px-2 text-sm"
                      disabled={blocked}
                      onClick={() => setBenchSheet(side)}
                    >
                      {t("benchTechnical")}
                    </Button>
                    <Button
                      type="button"
                      variant={state.possession === side ? "dark" : "outline"}
                      className="min-h-12 px-2 text-sm"
                      disabled={blocked}
                      aria-pressed={state.possession === side}
                      onClick={() => record("possession", { team: side })}
                    >
                      {t("possession")}
                    </Button>
                  </div>
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
          <Confirmations
            state={state}
            teamNames={teamNames}
            record={record}
            disabled={blocked}
          />
          {review === "submitted" ? (
            <Alert tone="success" className="text-base">
              {t(
                setup.status === "approved" ? "approvedNote" : "submittedNote",
              )}
            </Alert>
          ) : (
            <div className="space-y-3 rounded-2xl border-2 border-navy bg-card p-4">
              <p className="text-sm">{t("finalNext")}</p>
              <Button
                type="button"
                className="w-full text-lg sm:w-fit"
                disabled={review !== "open" || log.status !== "synced"}
                onClick={() => void submit()}
              >
                {t(review === "submitting" ? "submitting" : "submitGame")}
              </Button>
              {log.status !== "synced" && (
                <p className="text-sm text-muted-foreground">
                  {t("submitWaitSync")}
                </p>
              )}
            </div>
          )}
          <BoxScores state={state} teamNames={teamNames} />
        </section>
      )}

      <footer className="sticky bottom-0 z-10 -mx-3 mt-auto flex flex-wrap items-stretch gap-2 border-t bg-background/95 px-3 py-3 backdrop-blur sm:-mx-4 sm:px-4">
        {state.phase === "pregame" && (
          <div className="order-first w-full space-y-1 sm:order-none sm:w-auto sm:flex-1">
            <Button
              type="button"
              className="min-h-14 w-full text-xl"
              disabled={blocked || !readyToTipOff}
              onClick={() => record("period_start", {})}
            >
              {t("tipOff")}
            </Button>
            {!readyToTipOff && (
              <p className="text-center text-sm text-muted-foreground">
                {t(blockedByPayment ? "tipOffPaymentHelp" : "tipOffHelp")}
              </p>
            )}
          </div>
        )}
        <Button
          type="button"
          variant="dark"
          className="min-h-14 min-w-36 flex-col items-start gap-0 px-4 py-2 text-left"
          disabled={blocked || !undo}
          aria-label={t("undo")}
          onClick={() => undo && record("void", { eventId: undo.eventId })}
        >
          <span className="flex items-center gap-2 text-lg">
            <Icon name="back" className="size-5" />
            {t("undo")}
          </span>
          {undoText && (
            <span className="max-w-48 truncate text-xs font-semibold text-on-dark-muted">
              {undoText}
            </span>
          )}
        </Button>
        {state.phase === "live" && (
          <div className="flex w-full items-stretch gap-2 sm:w-auto sm:flex-1">
            <Button
              type="button"
              className={cn(
                "min-h-14 flex-1 text-xl",
                state.clock.running
                  ? "bg-destructive text-white hover:bg-destructive/90"
                  : "bg-success text-white hover:bg-success/90",
              )}
              disabled={blocked || Boolean(state.freeThrowsDue)}
              onClick={() =>
                record(state.clock.running ? "clock_stop" : "clock_start", {})
              }
            >
              {t(state.clock.running ? "stopClock" : "startClock")}
            </Button>
            <ShotClockControls
              state={state}
              rules={rules}
              remainingMs={shotClockMs}
              teamNames={teamNames}
              record={record}
              disabled={blocked}
            />
          </div>
        )}
        {state.phase === "live" && (
          <Button
            type="button"
            variant="outline"
            className="min-h-14"
            disabled={blocked}
            onClick={() => {
              if (window.confirm(t("confirmEndPeriod", { period })))
                record("period_end", {});
            }}
          >
            {t("endPeriod", { period })}
          </Button>
        )}
        {state.phase === "live" && state.possession && (
          <Button
            type="button"
            variant="outline"
            className="min-h-14 flex-col gap-0 px-3"
            disabled={blocked}
            aria-label={t("jumpBallFor", {
              team: teamNames[state.possession],
            })}
            onClick={() => {
              const team = state.possession;
              if (team) record("alternating_possession", { team });
            }}
          >
            <span>{t("jumpBall")}</span>
            <span className="text-xs font-semibold text-muted-foreground">
              {t("jumpBallBall", { team: teamNames[state.possession] })}
            </span>
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
                className="min-h-14 flex-1 text-lg"
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
                  className="min-h-14 flex-1 text-lg"
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
        <div className="ml-auto flex gap-1">
          <Button
            type="button"
            variant="ghost"
            className="min-h-14 px-3"
            aria-pressed={showRunning}
            onClick={() => setShowRunning(!showRunning)}
          >
            {t(showRunning ? "hideRunningScore" : "showRunningScore")}
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="min-h-14 px-3"
            aria-pressed={showLog}
            onClick={() => setShowLog(!showLog)}
          >
            {t(showLog ? "hidePlayByPlay" : "showPlayByPlay")}
          </Button>
        </div>
      </footer>

      {showRunning && (
        <RunningScore state={state} events={log.events} teamNames={teamNames} />
      )}

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
          rules={rules}
          onClose={() => setSheet(undefined)}
        />
      )}
      {benchSheet && (
        <BenchFoulSheet
          state={state}
          side={benchSheet}
          teamName={teamNames[benchSheet]}
          rules={rules}
          record={record}
          onClose={() => setBenchSheet(undefined)}
        />
      )}
    </div>
  );
}
