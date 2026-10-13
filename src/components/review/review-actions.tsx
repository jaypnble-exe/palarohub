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

/** Approve the result (with chosen suspensions) or send it back to the scorer. */
export function ReviewActions({
  slug,
  gameId,
  ejected,
  canApprove,
}: {
  slug: string;
  gameId: string;
  ejected: readonly { playerId: string; label: string }[];
  canApprove: boolean;
}) {
  const t = useTranslations("Review");
  const mutation = useScheduleMutation();
  const [suspend, setSuspend] = useState(() =>
    ejected.map((player) => player.playerId),
  );
  const [comment, setComment] = useState("");
  return (
    <div className="space-y-5">
      {canApprove && (
        <section className="space-y-4 rounded-2xl border-2 border-navy bg-card p-5">
          <h2 className="font-display text-2xl font-semibold">
            {t("approveTitle")}
          </h2>
          <p className="text-sm text-muted-foreground">{t("approveHelp")}</p>
          {ejected.length > 0 && (
            <fieldset className="space-y-2">
              <legend className="font-semibold">{t("suspensions")}</legend>
              <p className="text-sm text-muted-foreground">
                {t("suspensionsHelp")}
              </p>
              {ejected.map((player) => (
                <label
                  key={player.playerId}
                  className="flex min-h-11 items-center gap-3"
                >
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
              ))}
            </fieldset>
          )}
          <Button
            type="button"
            className="w-full sm:w-fit"
            disabled={mutation.pending}
            onClick={() => {
              if (window.confirm(t("confirmApprove")))
                mutation.run(() => approveGame(slug, { gameId, suspend }));
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
