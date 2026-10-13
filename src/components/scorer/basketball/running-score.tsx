"use client";
import { useTranslations } from "next-intl";
import {
  scoresheetMarks,
  sides,
  type BasketballEvent,
  type BasketballGameState,
  type Side,
} from "@/lib/sports/basketball";
import { cardVariants } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/**
 * The running score as on the paper scoresheet: every total from 1 up, with
 * the jersey of the scorer beside the total reached. A free throw is a dot,
 * a three is circled, and each period's last score is underlined.
 */
export function RunningScore({
  state,
  events,
  teamNames,
}: {
  state: BasketballGameState;
  events: readonly BasketballEvent[];
  teamNames: Record<Side, string>;
}) {
  const t = useTranslations("Scorer");
  const { running } = scoresheetMarks(state, events);
  const highest = Math.max(
    ...sides.map((side) => running[side].at(-1)?.total ?? 0),
  );
  // Whole blocks of 40, like the columns on the paper sheet.
  const size = Math.max(40, Math.ceil((highest + 1) / 40) * 40);
  return (
    <section
      className={cn(cardVariants({ padding: "sm" }), "space-y-3")}
      aria-label={t("runningScore")}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">{t("runningScore")}</h2>
        <p className="text-xs text-muted-foreground">{t("runningScoreKey")}</p>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {sides.map((side) => {
          const marks = new Map(
            running[side].map((mark, index) => {
              const next = running[side][index + 1];
              return [
                mark.total,
                { ...mark, lastOfPeriod: !next || next.period !== mark.period },
              ];
            }),
          );
          const reached = running[side].at(-1)?.total ?? 0;
          return (
            <div key={side} className="space-y-2">
              <p className="text-sm font-bold">
                {teamNames[side]} · {reached}
              </p>
              <ol
                className="grid grid-cols-10 gap-px overflow-hidden rounded-lg border bg-border text-center text-xs tabular-nums sm:grid-cols-20"
                aria-label={t("runningScoreFor", { team: teamNames[side] })}
              >
                {Array.from({ length: size }, (_, index) => {
                  const total = index + 1;
                  const mark = marks.get(total);
                  const passed = total <= reached;
                  return (
                    <li
                      key={total}
                      className={cn(
                        "relative flex min-h-11 flex-col items-center justify-center bg-card",
                        passed && "bg-accent/60",
                        mark?.lastOfPeriod && "border-b-4 border-b-navy",
                      )}
                      aria-label={
                        mark
                          ? t("runningScoreMark", {
                              total,
                              jersey: mark.jersey,
                              points: mark.points,
                            })
                          : undefined
                      }
                    >
                      <span
                        className={cn(
                          "leading-none",
                          passed ? "text-muted-foreground line-through" : "",
                        )}
                      >
                        {total}
                      </span>
                      {mark && (
                        <span
                          className={cn(
                            "mt-0.5 grid min-w-5 place-items-center font-display text-sm leading-none font-semibold",
                            mark.points === 3 &&
                              "rounded-full border-2 border-primary px-0.5",
                          )}
                        >
                          {mark.points === 1 ? "•" : ""}
                          {mark.jersey}
                        </span>
                      )}
                    </li>
                  );
                })}
              </ol>
            </div>
          );
        })}
      </div>
    </section>
  );
}
