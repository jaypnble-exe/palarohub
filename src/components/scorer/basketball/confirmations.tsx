"use client";
import { useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import {
  confirmationRoles,
  sides,
  type BasketballGameState,
  type ConfirmationRole,
  type Side,
} from "@/lib/sports/basketball";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/field";
import { Icon } from "@/components/ui/icon";
import { cardVariants } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { RecordEvent } from "./board";

/**
 * The signatures at the bottom of the paper scoresheet, on the device: the
 * referee and both captains confirm the result, and a captain can sign under
 * protest. All optional; the scorer can submit without them.
 */
export function Confirmations({
  state,
  teamNames,
  record,
  disabled,
}: {
  state: BasketballGameState;
  teamNames: Record<Side, string>;
  record: RecordEvent;
  disabled: boolean;
}) {
  const t = useTranslations("Scorer");
  const format = useFormatter();
  const suggested = (role: ConfirmationRole) => {
    if (role === "referee") return state.officials?.referees[0] ?? "";
    const team = state.teams[role === "homeCaptain" ? "home" : "away"];
    return team.captainId ? (team.players[team.captainId]?.name ?? "") : "";
  };
  const [names, setNames] = useState<Record<ConfirmationRole, string>>(() => ({
    referee: suggested("referee"),
    homeCaptain: suggested("homeCaptain"),
    awayCaptain: suggested("awayCaptain"),
  }));
  const [protestTeam, setProtestTeam] = useState<Side>();
  const [note, setNote] = useState("");
  const label = (role: ConfirmationRole) =>
    role === "referee"
      ? t("confirmRefereeLabel")
      : t("confirmCaptainLabel", {
          team: teamNames[role === "homeCaptain" ? "home" : "away"],
        });
  return (
    <section
      className={cn(cardVariants(), "space-y-4")}
      aria-labelledby="confirm-title"
    >
      <div className="space-y-1">
        <h2 id="confirm-title" className="text-lg font-semibold">
          {t("confirmTitle")}
        </h2>
        <p className="text-sm text-muted-foreground">{t("confirmHelp")}</p>
      </div>
      <ul className="space-y-3">
        {confirmationRoles.map((role) => {
          const done = state.confirmations.find((entry) => entry.role === role);
          return (
            <li key={role} className="space-y-2">
              <label
                htmlFor={`confirm-${role}`}
                className="block text-sm font-semibold"
              >
                {label(role)}
              </label>
              {done ? (
                <p className="flex items-center gap-2 rounded-xl bg-success-soft p-3 text-sm font-semibold text-success">
                  <Icon name="check" className="size-5" />
                  {t("confirmedBy", {
                    name: done.name,
                    time: format.dateTime(new Date(done.at), {
                      hour: "numeric",
                      minute: "2-digit",
                    }),
                  })}
                </p>
              ) : (
                <div className="flex gap-2">
                  <Input
                    id={`confirm-${role}`}
                    value={names[role]}
                    maxLength={100}
                    disabled={disabled}
                    placeholder={t("typeName")}
                    onChange={(event) =>
                      setNames({ ...names, [role]: event.target.value })
                    }
                  />
                  <Button
                    type="button"
                    variant="dark"
                    disabled={disabled || !names[role].trim()}
                    onClick={() =>
                      record("confirmation", { role, name: names[role].trim() })
                    }
                  >
                    {t("confirm")}
                  </Button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
      <div className="space-y-3 border-t pt-4">
        {state.protests.map((protest, index) => (
          <p
            key={index}
            className="rounded-xl bg-destructive-soft p-3 text-sm font-semibold text-destructive"
          >
            {t("protestRecorded", { team: teamNames[protest.team] })}
            {protest.note && `: “${protest.note}”`}
          </p>
        ))}
        {protestTeam ? (
          <div className="space-y-2">
            <label
              htmlFor="protest-note"
              className="block text-sm font-semibold"
            >
              {t("protestNote", { team: teamNames[protestTeam] })}
            </label>
            <Textarea
              id="protest-note"
              rows={2}
              maxLength={500}
              value={note}
              onChange={(event) => setNote(event.target.value)}
            />
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={disabled}
                onClick={() => {
                  if (
                    record("protest", { team: protestTeam, note: note.trim() })
                  ) {
                    setProtestTeam(undefined);
                    setNote("");
                  }
                }}
              >
                {t("recordProtest")}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setProtestTeam(undefined)}
              >
                {t("cancel")}
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {sides.map((side) => (
              <Button
                key={side}
                type="button"
                variant="ghost"
                className="min-h-11 py-2 text-sm text-destructive"
                disabled={disabled}
                onClick={() => setProtestTeam(side)}
              >
                {t("underProtest", { team: teamNames[side] })}
              </Button>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
