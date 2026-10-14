"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  automaticFreeThrows,
  type BasketballGameState,
  type BasketballRules,
  type FoulKind,
  type Side,
} from "@/lib/sports/basketball";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { RecordEvent } from "./board";
import { playerLabel } from "./helpers";
import { Icon } from "@/components/ui/icon";

const group = "text-xs font-bold tracking-wide text-muted-foreground uppercase";

/** Everything a scorer can record for one player: one tap after choosing them. */
export function PlayerSheet({
  state,
  side,
  playerId,
  record,
  rules,
  onClose,
}: {
  state: BasketballGameState;
  side: Side;
  playerId: string;
  record: RecordEvent;
  rules: BasketballRules;
  onClose: () => void;
}) {
  const t = useTranslations("Scorer");
  const [mode, setMode] = useState<"actions" | "substitute">("actions");
  const team = state.teams[side];
  const onCourt = team.onCourt.includes(playerId);
  const done = (saved: boolean) => saved && onClose();
  // Free throws are filled in as the scorer would write them (P2, T1, U2);
  // shooting fouls say how many shots the shooter gets.
  const foul = (kind: FoulKind, freeThrows?: number) =>
    done(
      record("foul", {
        team: side,
        playerId,
        kind,
        freeThrows: freeThrows ?? automaticFreeThrows(state, side, kind, rules),
      }),
    );
  const line = team.players[playerId];
  const bench = team.playerIds.filter(
    (id) =>
      team.players[id].present &&
      !team.onCourt.includes(id) &&
      !team.players[id].disqualified,
  );
  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label={playerLabel(state, side, playerId)}
      onClick={(event) => event.target === event.currentTarget && onClose()}
    >
      <div className="no-scrollbar max-h-[92vh] w-full max-w-xl space-y-4 overflow-auto overscroll-contain rounded-t-3xl bg-background p-4 shadow-2xl sm:rounded-3xl sm:p-5">
        <div className="flex items-center gap-3">
          <span
            className={cn(
              "grid size-14 shrink-0 place-items-center rounded-2xl font-display text-3xl font-semibold",
              side === "home"
                ? "bg-primary text-white"
                : "bg-navy text-on-dark",
            )}
            aria-hidden="true"
          >
            {line.jersey}
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-xl font-bold">
              {playerLabel(state, side, playerId)}
            </h2>
            <p
              className={cn(
                "text-sm font-semibold",
                line.foulCount >= 4
                  ? "text-destructive"
                  : "text-muted-foreground",
              )}
            >
              {t("playerSummary", {
                points: line.points,
                fouls: line.foulCount,
              })}
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            className="min-h-12 px-3"
            onClick={onClose}
          >
            <Icon name="close" className="size-5" />
            {t("close")}
          </Button>
        </div>
        {mode === "substitute" ? (
          <div className="space-y-3">
            <p className="font-semibold">{t("whoComesIn")}</p>
            {bench.length ? (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {bench.map((id) => (
                  <Button
                    key={id}
                    type="button"
                    variant="outline"
                    className="min-h-16"
                    onClick={() =>
                      done(
                        record("substitution", {
                          team: side,
                          out: playerId,
                          in: id,
                        }),
                      )
                    }
                  >
                    {playerLabel(state, side, id)}
                  </Button>
                ))}
              </div>
            ) : (
              <p>{t("noBench")}</p>
            )}
            <Button
              type="button"
              variant="ghost"
              onClick={() => setMode("actions")}
            >
              {t("back")}
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {onCourt && (
              <>
                <p className={group}>{t("madeShots")}</p>
                <div className="grid grid-cols-3 gap-2">
                  {([2, 3, 1] as const).map((points) => (
                    <Button
                      key={points}
                      type="button"
                      className={cn(
                        "min-h-24 font-display text-3xl",
                        points === 1 &&
                          "bg-navy text-on-dark hover:bg-navy-secondary",
                      )}
                      onClick={() =>
                        done(
                          record("score", {
                            team: side,
                            playerId,
                            points,
                            made: true,
                          }),
                        )
                      }
                    >
                      {t(points === 1 ? "freeThrow" : "plusPoints", { points })}
                    </Button>
                  ))}
                </div>
                <p className={group}>{t("missedShots")}</p>
                <div className="grid grid-cols-3 gap-2">
                  {([2, 3, 1] as const).map((points) => (
                    <Button
                      key={points}
                      type="button"
                      variant="outline"
                      className="min-h-12 text-sm"
                      onClick={() =>
                        done(
                          record("score", {
                            team: side,
                            playerId,
                            points,
                            made: false,
                          }),
                        )
                      }
                    >
                      {t("missed", { points })}
                    </Button>
                  ))}
                </div>
                <p className={group}>{t("playerStats")}</p>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="min-h-12 text-sm"
                    onClick={() =>
                      done(
                        record("stat", {
                          team: side,
                          playerId,
                          kind: "rebound",
                          reboundType: "offensive",
                          rimHit: true,
                        }),
                      )
                    }
                  >
                    {t("offensiveRebound", {
                      seconds: rules.shotClock.resetSeconds,
                    })}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="min-h-12 text-sm"
                    onClick={() =>
                      done(
                        record("stat", {
                          team: side,
                          playerId,
                          kind: "rebound",
                          reboundType: "defensive",
                        }),
                      )
                    }
                  >
                    {t("defensiveRebound", {
                      seconds: rules.shotClock.seconds,
                    })}
                  </Button>
                  {(["assist", "steal", "block", "turnover"] as const).map(
                    (kind) => (
                      <Button
                        key={kind}
                        type="button"
                        variant="outline"
                        className="min-h-12 text-sm"
                        onClick={() =>
                          done(record("stat", { team: side, playerId, kind }))
                        }
                      >
                        {t(`statKind.${kind}`)}
                      </Button>
                    ),
                  )}
                  <Button
                    type="button"
                    variant="ghost"
                    className="min-h-11 text-sm col-span-2"
                    onClick={() =>
                      done(
                        record("stat", {
                          team: side,
                          playerId,
                          kind: "rebound",
                          reboundType: "offensive",
                          rimHit: false,
                        }),
                      )
                    }
                  >
                    {t("offensiveReboundNoRim")}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  {t("reboundClockHelp")}
                </p>
                <p className={group}>{t("fouls")}</p>
                <Button
                  type="button"
                  variant="dark"
                  className="min-h-16 w-full text-xl"
                  onClick={() => foul("personal")}
                >
                  {t("personalFoul")}
                  {automaticFreeThrows(state, side, "personal", rules) > 0 && (
                    <span className="text-sm font-semibold text-on-dark-muted">
                      {t("plusFreeThrows", {
                        count: automaticFreeThrows(
                          state,
                          side,
                          "personal",
                          rules,
                        ),
                      })}
                    </span>
                  )}
                </Button>
                <div className="grid grid-cols-[auto_1fr_1fr_1fr] items-center gap-2">
                  <span className="pr-1 text-sm font-semibold">
                    {t("shootingFoul")}
                  </span>
                  {([1, 2, 3] as const).map((count) => (
                    <Button
                      key={count}
                      type="button"
                      variant="outline"
                      className="min-h-12 px-2 text-sm"
                      aria-label={t("shootingFoulShots", { count })}
                      onClick={() => foul("personal", count)}
                    >
                      {t("freeThrowCount", { count })}
                    </Button>
                  ))}
                </div>
              </>
            )}
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {(
                [
                  "technical",
                  "unsportsmanlike",
                  "disqualifying",
                  "fighting",
                ] as const
              ).map((kind) => (
                <Button
                  key={kind}
                  type="button"
                  variant="outline"
                  className="px-2 text-sm"
                  onClick={() => {
                    if (
                      (kind !== "disqualifying" && kind !== "fighting") ||
                      window.confirm(t("confirmDisqualifying"))
                    )
                      foul(kind);
                  }}
                >
                  {t(`foulKind.${kind}`)}
                </Button>
              ))}
            </div>
            {onCourt && (
              <Button
                type="button"
                variant="outline"
                className="min-h-14 w-full"
                onClick={() => setMode("substitute")}
              >
                {t("substitute")}
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
