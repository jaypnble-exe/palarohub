"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import type { BasketballGameState, Side } from "@/lib/sports/basketball";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/field";
import type { RecordEvent } from "./board";

/** Head coach, assistant coach and captain: the top of the team's column. */
export function TeamStaff({
  side,
  state,
  record,
  disabled,
}: {
  side: Side;
  state: BasketballGameState;
  record: RecordEvent;
  disabled: boolean;
}) {
  const t = useTranslations("Scorer");
  const team = state.teams[side];
  const [coach, setCoach] = useState(team.coach ?? "");
  const [assistant, setAssistant] = useState(team.assistantCoach ?? "");
  const [captain, setCaptain] = useState(team.captainId ?? "");
  const saved =
    (team.coach ?? "") === coach.trim() &&
    (team.assistantCoach ?? "") === assistant.trim() &&
    (team.captainId ?? "") === captain &&
    Boolean(team.coach || team.captainId);
  return (
    <details className="rounded-xl border bg-background p-3" open={!saved}>
      <summary className="min-h-11 cursor-pointer py-2 text-sm font-semibold">
        {team.coach || team.captainId
          ? t("staffSummary", {
              coach: team.coach ?? "—",
              captain: team.captainId
                ? `#${team.players[team.captainId]?.jersey ?? ""}`
                : "—",
            })
          : t("teamStaffTitle")}
      </summary>
      <form
        className="grid gap-3 pt-2 sm:grid-cols-2"
        onSubmit={(event) => {
          event.preventDefault();
          record("team_staff", {
            team: side,
            coach: coach.trim() || null,
            assistantCoach: assistant.trim() || null,
            captainId: captain || null,
          });
        }}
      >
        <div className="space-y-1">
          <label htmlFor={`coach-${side}`} className="text-sm font-semibold">
            {t("headCoach")}
          </label>
          <Input
            id={`coach-${side}`}
            value={coach}
            maxLength={100}
            onChange={(event) => setCoach(event.target.value)}
          />
        </div>
        <div className="space-y-1">
          <label
            htmlFor={`assistant-${side}`}
            className="text-sm font-semibold"
          >
            {t("assistantCoach")}
          </label>
          <Input
            id={`assistant-${side}`}
            value={assistant}
            maxLength={100}
            onChange={(event) => setAssistant(event.target.value)}
          />
        </div>
        <div className="space-y-1 sm:col-span-2">
          <label htmlFor={`captain-${side}`} className="text-sm font-semibold">
            {t("captain")}
          </label>
          <Select
            id={`captain-${side}`}
            value={captain}
            onChange={(event) => setCaptain(event.target.value)}
          >
            <option value="">{t("noCaptain")}</option>
            {team.playerIds.map((id) => (
              <option key={id} value={id}>
                #{team.players[id].jersey} {team.players[id].name}
              </option>
            ))}
          </Select>
        </div>
        <Button
          variant="outline"
          className="min-h-11 py-2 sm:col-span-2"
          disabled={disabled || saved}
        >
          {t(saved ? "staffSaved" : "saveStaff")}
        </Button>
      </form>
    </details>
  );
}
