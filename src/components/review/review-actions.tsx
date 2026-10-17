"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  approveGame,
  reopenGame,
} from "@/app/(admin)/admin/[league]/games/actions";
import { Button } from "@/components/ui/button";
import {
  ScheduleFeedback,
  useScheduleMutation,
} from "@/components/schedule/mutation";
import { cardVariants } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Textarea } from "@/components/ui/field";
import { PlayerOfGameStats } from "@/components/public/player-of-game";
import type { PlayerPerformance } from "@/lib/domain/career-stats";

/** Approve the result (with chosen suspensions) or send it back to the scorer. */
export function ReviewActions({
  slug,
  gameId,
  ejected,
  canApprove,
  candidates,
  canSelectPlayer,
}: {
  slug: string;
  gameId: string;
  ejected: readonly { playerId: string; label: string }[];
  canApprove: boolean;
  candidates: (PlayerPerformance & { efficiency: number })[];
  canSelectPlayer: boolean;
}) {
  const t = useTranslations("Review");
  const award = useTranslations("PlayerOfGame");
  const mutation = useScheduleMutation();
  const [suspend, setSuspend] = useState(() =>
    ejected.map((player) => player.playerId),
  );
  const [games, setGames] = useState<Record<string, number>>({});
  const [comment, setComment] = useState("");
  const [playerOfGame, setPlayerOfGame] = useState(
    candidates[0]?.playerId ?? "",
  );
  const selected = candidates.find(
    (player) => player.playerId === playerOfGame,
  );
  return (
    <div className="space-y-5">
      {canApprove && (
        <section className="space-y-4 rounded-2xl border-2 border-navy bg-card p-5">
          <h2 className="font-display text-2xl font-semibold">
            {t("approveTitle")}
          </h2>
          <p className="text-sm text-muted-foreground">{t("approveHelp")}</p>
          {canSelectPlayer && candidates.length > 0 && (
            <fieldset className="space-y-3 rounded-xl border p-4">
              <legend className="px-1 font-semibold">{award("title")}</legend>
              <p className="text-sm text-muted-foreground">
                {award("suggestionHelp")}
              </p>
              <p className="text-sm text-muted-foreground">
                {award("formula")}
              </p>
              {candidates.filter(
                (player) => player.efficiency === candidates[0].efficiency,
              ).length > 1 && (
                <p className="text-sm font-semibold">{award("tie")}</p>
              )}
              <label
                htmlFor="player-of-game"
                className="block text-sm font-semibold"
              >
                {award("choose")}
              </label>
              <select
                id="player-of-game"
                value={playerOfGame}
                disabled={mutation.pending}
                onChange={(event) => setPlayerOfGame(event.target.value)}
                className="min-h-12 w-full rounded-xl border bg-background px-3"
              >
                {candidates.map((player) => (
                  <option key={player.playerId} value={player.playerId}>
                    {award(
                      player.efficiency === candidates[0].efficiency
                        ? "suggestedOption"
                        : "option",
                      { name: player.name, efficiency: player.efficiency },
                    )}
                  </option>
                ))}
              </select>
              {selected && (
                <PlayerOfGameStats
                  metrics={selected.metrics}
                  efficiency={selected.efficiency}
                />
              )}
              <p className="text-sm text-muted-foreground">
                {award("approvalHelp")}
              </p>
            </fieldset>
          )}
          {!canSelectPlayer && candidates.length > 0 && (
            <p className="text-sm text-muted-foreground">
              {award("commissionerOnly")}
            </p>
          )}
          {ejected.length > 0 && (
            <fieldset className="space-y-2">
              <legend className="font-semibold">{t("suspensions")}</legend>
              <p className="text-sm text-muted-foreground">
                {t("suspensionsHelp")}
              </p>
              {ejected.map((player) => (
                <div
                  key={player.playerId}
                  className="flex flex-wrap items-center gap-3"
                >
                  <label className="flex min-h-11 flex-1 items-center gap-3">
                    <input
                      type="checkbox"
                      className="size-5 accent-primary"
                      checked={suspend.includes(player.playerId)}
                      onChange={(event) =>
                        setSuspend(
                          event.target.checked
                            ? [...suspend, player.playerId]
                            : suspend.filter((id) => id !== player.playerId),
                        )
                      }
                    />
                    {t("suspendPlayer", { player: player.label })}
                  </label>
                  {suspend.includes(player.playerId) && (
                    <label className="flex items-center gap-2 text-sm font-semibold">
                      {t("suspendFor")}
                      <select
                        value={games[player.playerId] ?? 1}
                        disabled={mutation.pending}
                        onChange={(event) =>
                          setGames({
                            ...games,
                            [player.playerId]: Number(event.target.value),
                          })
                        }
                        className="min-h-11 rounded-xl border bg-background px-3"
                      >
                        {[1, 2, 3, 4, 5].map((count) => (
                          <option key={count} value={count}>
                            {t("gamesCount", { count })}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                </div>
              ))}
            </fieldset>
          )}
          <Button
            type="button"
            className="w-full sm:w-fit"
            disabled={
              mutation.pending || (candidates.length > 0 && !canSelectPlayer)
            }
            onClick={() => {
              if (window.confirm(t("confirmApprove")))
                mutation.run(() =>
                  approveGame(slug, {
                    gameId,
                    suspend,
                    suspendGames: suspend.map((id) => games[id] ?? 1),
                    playerOfGame: canSelectPlayer ? playerOfGame || null : null,
                  }),
                );
            }}
          >
            {t(mutation.pending ? "saving" : "approve")}
          </Button>
        </section>
      )}
      {canApprove && (
        <form
          className={cn(cardVariants(), "space-y-3")}
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            if (!comment.trim())
              return mutation.setResult({ error: "commentRequired" });
            mutation.run(
              () => reopenGame(slug, { gameId, comment }),
              () => setComment(""),
            );
          }}
        >
          <h2 className="font-display text-xl font-semibold">
            {t("reopenTitle")}
          </h2>
          <label htmlFor="reopen-comment" className="text-sm font-semibold">
            {t("reopenLabel")}
          </label>
          <Textarea
            id="reopen-comment"
            rows={3}
            maxLength={1000}
            value={comment}
            onChange={(event) => setComment(event.target.value)}
          />
          <Button variant="outline" disabled={mutation.pending}>
            {t("reopen")}
          </Button>
        </form>
      )}
      <ScheduleFeedback result={mutation.result} message={(key) => t(key)} />
    </div>
  );
}
