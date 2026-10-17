"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  correctResult,
  recordForfeit,
} from "@/app/(admin)/admin/[league]/games/actions";
import { Button } from "@/components/ui/button";
import { ChoiceCard } from "@/components/ui/chip";
import { Textarea } from "@/components/ui/field";
import {
  ScheduleFeedback,
  useScheduleMutation,
} from "@/components/schedule/mutation";

type Side = "home" | "away" | "both";

/**
 * For a game without a result: one team (or both) did not show up, or a team
 * ran out of players during the game. Folded away until needed.
 */
export function ForfeitForm({
  slug,
  gameId,
  teamNames,
  started,
}: {
  slug: string;
  gameId: string;
  teamNames: Record<"home" | "away", string>;
  /** The game was being played, so it can also end by default. */
  started: boolean;
}) {
  const t = useTranslations("Review");
  const mutation = useScheduleMutation();
  const [kind, setKind] = useState<"forfeit" | "default">("forfeit");
  const [side, setSide] = useState<Side>("away");
  const [reason, setReason] = useState("");
  const sides: Side[] =
    kind === "forfeit" ? ["home", "away", "both"] : ["home", "away"];
  const label = (value: Side) =>
    value === "both"
      ? t("forfeitBoth")
      : t(kind === "forfeit" ? "forfeitTeam" : "defaultTeam", {
          team: teamNames[value],
        });
  return (
    <details className="rounded-2xl border bg-card p-5">
      <summary className="min-h-11 cursor-pointer py-2 font-display text-xl font-semibold">
        {t("forfeitTitle")}
      </summary>
      <form
        className="space-y-4 pt-3"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          if (!reason.trim())
            return mutation.setResult({ error: "reasonRequired" });
          if (
            window.confirm(
              t("confirmForfeit", {
                result: label(side),
              }),
            )
          )
            mutation.run(() =>
              recordForfeit(slug, { gameId, kind, side, reason }),
            );
        }}
      >
        <p className="text-sm text-muted-foreground">{t("forfeitHelp")}</p>
        {started && (
          <fieldset className="space-y-2">
            <legend className="mb-2 font-semibold">{t("forfeitKind")}</legend>
            <ChoiceCard
              name="forfeit-kind"
              checked={kind === "forfeit"}
              onChange={() => setKind("forfeit")}
              title={t("kindForfeit")}
              description={t("kindForfeitHelp")}
            />
            <ChoiceCard
              name="forfeit-kind"
              checked={kind === "default"}
              onChange={() => {
                setKind("default");
                if (side === "both") setSide("away");
              }}
              title={t("kindDefault")}
              description={t("kindDefaultHelp")}
            />
          </fieldset>
        )}
        <fieldset className="space-y-2">
          <legend className="mb-2 font-semibold">{t("whoLost")}</legend>
          {sides.map((value) => (
            <ChoiceCard
              key={value}
              name="forfeit-side"
              checked={side === value}
              onChange={() => setSide(value)}
              title={label(value)}
              description={
                kind === "forfeit"
                  ? value === "both"
                    ? t("forfeitBothHelp")
                    : t("forfeitScoreHelp", {
                        winner: teamNames[value === "home" ? "away" : "home"],
                      })
                  : t("defaultScoreHelp")
              }
            />
          ))}
        </fieldset>
        <div className="space-y-2">
          <label htmlFor="forfeit-reason" className="block font-semibold">
            {t("forfeitReason")}
          </label>
          <Textarea
            id="forfeit-reason"
            rows={2}
            maxLength={1000}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
        </div>
        <Button variant="dark" disabled={mutation.pending}>
          {t(mutation.pending ? "saving" : "recordForfeit")}
        </Button>
        <ScheduleFeedback result={mutation.result} message={(key) => t(key)} />
      </form>
    </details>
  );
}

/** For the commissioner: reopen an approved result to fix a mistake. */
export function CorrectResultForm({
  slug,
  gameId,
  forfeit,
}: {
  slug: string;
  gameId: string;
  /** A forfeit goes back on the schedule; a played game back to the scorer. */
  forfeit: boolean;
}) {
  const t = useTranslations("Review");
  const mutation = useScheduleMutation();
  const [reason, setReason] = useState("");
  return (
    <details className="rounded-2xl border bg-card p-5">
      <summary className="min-h-11 cursor-pointer py-2 font-display text-xl font-semibold">
        {t("correctTitle")}
      </summary>
      <form
        className="space-y-4 pt-3"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          if (!reason.trim())
            return mutation.setResult({ error: "reasonRequired" });
          if (window.confirm(t("confirmCorrect")))
            mutation.run(() => correctResult(slug, { gameId, reason }));
        }}
      >
        <p className="text-sm text-muted-foreground">
          {t(forfeit ? "correctForfeitHelp" : "correctHelp")}
        </p>
        <div className="space-y-2">
          <label htmlFor="correct-reason" className="block font-semibold">
            {t("correctReason")}
          </label>
          <Textarea
            id="correct-reason"
            rows={2}
            maxLength={1000}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
        </div>
        <Button variant="outline" disabled={mutation.pending}>
          {t(mutation.pending ? "saving" : "reopenResult")}
        </Button>
        <ScheduleFeedback result={mutation.result} message={(key) => t(key)} />
      </form>
    </details>
  );
}
