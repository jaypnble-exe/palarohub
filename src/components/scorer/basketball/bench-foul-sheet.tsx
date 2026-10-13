"use client";
import { useTranslations } from "next-intl";
import {
  automaticFreeThrows,
  type BasketballGameState,
  type BasketballRules,
  type BenchOffender,
  type FoulKind,
  type Side,
} from "@/lib/sports/basketball";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import type { RecordEvent } from "./board";

const options: { offender: BenchOffender; kind: FoulKind; key: string }[] = [
  { offender: "coach", kind: "technical", key: "coachTechnical" },
  { offender: "bench", kind: "technical", key: "benchTechnicalB" },
  { offender: "coach", kind: "disqualifying", key: "coachDisqualifying" },
  { offender: "bench", kind: "disqualifying", key: "benchDisqualifying" },
  { offender: "bench", kind: "fighting", key: "benchFighting" },
];

/**
 * Fouls on the coach (C) or the bench (B), as on the scoresheet. The
 * opponents' free throws are filled in automatically.
 */
export function BenchFoulSheet({
  state,
  side,
  teamName,
  rules,
  record,
  onClose,
}: {
  state: BasketballGameState;
  side: Side;
  teamName: string;
  rules: BasketballRules;
  record: RecordEvent;
  onClose: () => void;
}) {
  const t = useTranslations("Scorer");
  const team = state.teams[side];
  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label={t("benchFoulsTitle", { team: teamName })}
      onClick={(event) => event.target === event.currentTarget && onClose()}
    >
      <div className="no-scrollbar max-h-[92vh] w-full max-w-xl space-y-4 overflow-auto overscroll-contain rounded-t-3xl bg-background p-4 shadow-2xl sm:rounded-3xl sm:p-5">
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-xl font-bold">
              {t("benchFoulsTitle", { team: teamName })}
            </h2>
            <p className="text-sm text-muted-foreground">
              {t("coachFoulCount", {
                coach: team.coachFouls.coach,
                bench: team.coachFouls.bench,
              })}
              {team.coachEjected && ` · ${t("coachIsEjected")}`}
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
        <p className="text-sm text-muted-foreground">{t("benchFoulsHelp")}</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {options.map((option) => {
            const shots = automaticFreeThrows(state, side, option.kind, rules);
            return (
              <Button
                key={option.key}
                type="button"
                variant={option.kind === "technical" ? "dark" : "outline"}
                className="min-h-14 flex-col gap-0"
                onClick={() => {
                  if (
                    option.kind !== "technical" &&
                    !window.confirm(t("confirmDisqualifying"))
                  )
                    return;
                  if (
                    record("foul", {
                      team: side,
                      playerId: null,
                      kind: option.kind,
                      offender: option.offender,
                      freeThrows: shots,
                    })
                  )
                    onClose();
                }}
              >
                <span>{t(option.key)}</span>
                {shots > 0 && (
                  <span className="text-xs font-semibold opacity-75">
                    {t("plusFreeThrows", { count: shots })}
                  </span>
                )}
              </Button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
