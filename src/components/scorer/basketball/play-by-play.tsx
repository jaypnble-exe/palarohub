"use client";
import { useTranslations } from "next-intl";
import type {
  BasketballEvent,
  BasketballGameState,
  BasketballRules,
  Side,
} from "@/lib/sports/basketball";
import { Button } from "@/components/ui/button";
import type { RecordEvent } from "./board";
import { describeEvent, formatClock, periodName } from "./helpers";

/** Every recorded action, newest first. Fixing one adds a correction; nothing is deleted. */
export function PlayByPlay({
  state,
  events,
  teamNames,
  rules,
  record,
  disabled,
}: {
  state: BasketballGameState;
  events: readonly BasketballEvent[];
  teamNames: Record<Side, string>;
  rules: BasketballRules;
  record: RecordEvent;
  disabled: boolean;
}) {
  const t = useTranslations("Scorer");
  const byId = new Map(events.map((event) => [event.id, event]));
  let period = 0;
  const rows = state.log.map((entry) => {
    const event = byId.get(entry.eventId);
    if (event?.type === "period_start" && entry.status === "applied") period++;
    return { entry, event, period };
  });
  return (
    <section
      className="space-y-2 rounded-2xl border bg-card p-3"
      aria-label={t("playByPlay")}
    >
      <h2 className="text-lg font-semibold">{t("playByPlay")}</h2>
      <ol className="divide-y">
        {[...rows].reverse().map(({ entry, event, period: at }) => {
          if (!event) return null;
          const target =
            event.type === "void" ? byId.get(event.payload.eventId) : undefined;
          const text = describeEvent(
            event,
            state,
            teamNames,
            periodName(at, rules, t),
            t,
          );
          const targetText = target
            ? describeEvent(
                target,
                state,
                teamNames,
                periodName(at, rules, t),
                t,
              )
            : "";
          return (
            <li
              key={entry.eventId}
              className="flex flex-wrap items-center gap-2 py-2 text-sm"
            >
              <span className="w-16 shrink-0 tabular-nums text-muted-foreground">
                {at > 0 ? periodName(at, rules, t) : ""}
                {event.clockMs !== null && at > 0
                  ? ` ${formatClock(event.clockMs)}`
                  : ""}
              </span>
              <span
                className={
                  entry.status === "voided"
                    ? "flex-1 text-muted-foreground line-through"
                    : "flex-1"
                }
              >
                {event.type === "void"
                  ? t("log.removed", { action: targetText })
                  : text}
                {entry.status === "ignored" && entry.error && (
                  <span className="block text-destructive">
                    {t("notCounted", { reason: t(`errors.${entry.error}`) })}
                  </span>
                )}
              </span>
              {entry.status === "applied" && event.type !== "roster" && (
                <Button
                  type="button"
                  variant="ghost"
                  className="min-h-11 px-3 py-1 text-sm"
                  disabled={disabled}
                  onClick={() => {
                    if (window.confirm(t("confirmRemove", { action: text })))
                      record("void", { eventId: entry.eventId });
                  }}
                >
                  {t("remove")}
                </Button>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
