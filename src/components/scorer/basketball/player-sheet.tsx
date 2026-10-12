"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import type {
  BasketballGameState,
  FoulKind,
  Side,
} from "@/lib/sports/basketball";
import { Button } from "@/components/ui/button";
import type { RecordEvent } from "./board";
import { playerLabel } from "./helpers";

/** Everything a scorer can record for one player: one tap after choosing them. */
export function PlayerSheet({
  state,
  side,
  playerId,
  record,
  onClose,
}: {
  state: BasketballGameState;
  side: Side;
  playerId: string;
  record: RecordEvent;
  onClose: () => void;
}) {
  const t = useTranslations("Scorer");
  const [mode, setMode] = useState<"actions" | "substitute">("actions");
  const team = state.teams[side];
  const onCourt = team.onCourt.includes(playerId);
  const done = (saved: boolean) => saved && onClose();
  const foul = (kind: FoulKind) =>
    done(record("foul", { team: side, playerId, kind }));
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
      <div className="max-h-[90vh] w-full max-w-xl space-y-4 overflow-auto rounded-t-2xl bg-background p-4 sm:rounded-2xl">
        <div className="flex items-center justify-between gap-3">
          <h2 className="truncate text-xl font-semibold">
            {playerLabel(state, side, playerId)}
          </h2>
          <Button type="button" variant="ghost" onClick={onClose}>
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
                <div className="grid grid-cols-3 gap-2">
                  {([2, 3, 1] as const).map((points) => (
                    <Button
                      key={points}
                      type="button"
                      className="min-h-20 text-2xl"
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
                <div className="grid grid-cols-3 gap-2">
                  {([2, 3, 1] as const).map((points) => (
                    <Button
                      key={points}
                      type="button"
                      variant="outline"
                      className="text-sm"
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
                <Button
                  type="button"
                  variant="dark"
                  className="min-h-16 w-full text-xl"
                  onClick={() => foul("personal")}
                >
                  {t("personalFoul")}
                </Button>
              </>
            )}
            <div className="grid grid-cols-3 gap-2">
              {(["technical", "unsportsmanlike", "disqualifying"] as const).map(
                (kind) => (
                  <Button
                    key={kind}
                    type="button"
                    variant="outline"
                    className="px-2 text-sm"
                    onClick={() => {
                      if (
                        kind !== "disqualifying" ||
                        window.confirm(t("confirmDisqualifying"))
                      )
                        foul(kind);
                    }}
                  >
                    {t(`foulKind.${kind}`)}
                  </Button>
                ),
              )}
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
            <p className="text-sm text-muted-foreground">
              {t("playerSummary", {
                points: team.players[playerId].points,
                fouls: team.players[playerId].foulCount,
              })}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
