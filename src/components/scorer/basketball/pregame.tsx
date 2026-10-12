"use client";
import { useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import {
  sides,
  type BasketballGameState,
  type Side,
} from "@/lib/sports/basketball";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { RecordEvent } from "./board";

/** Attendance, game jerseys, starting fives, officials, and tip-off. */
export function Pregame({
  state,
  teamNames,
  record,
  disabled,
  suspended,
  behind = [],
  blockUnpaid = false,
}: {
  state: BasketballGameState;
  teamNames: Record<Side, string>;
  record: RecordEvent;
  disabled: boolean;
  /** Players serving a suspension; they cannot be marked present. */
  suspended: ReadonlySet<string>;
  /** Teams behind on payments for this game. */
  behind?: readonly { side: Side; behindByHalalas: number }[];
  /** League rule: teams that are behind cannot play. */
  blockUnpaid?: boolean;
}) {
  const t = useTranslations("Scorer");
  const format = useFormatter();
  const blockedByPayment = blockUnpaid && behind.length > 0;
  const ready =
    sides.every((side) => state.teams[side].startersSet) && !blockedByPayment;
  return (
    <div className="space-y-4">
      <p className="text-muted-foreground">{t("pregameHelp")}</p>
      {behind.map(({ side, behindByHalalas }) => (
        <p
          key={side}
          role="alert"
          className={
            blockUnpaid
              ? "rounded-xl bg-destructive p-4 font-semibold text-white"
              : "rounded-xl bg-orange-soft p-4 font-semibold text-orange-dark"
          }
        >
          {t(blockUnpaid ? "paymentBlocked" : "paymentWarning", {
            team: teamNames[side],
            amount: format.number(behindByHalalas / 100, {
              style: "currency",
              currency: "SAR",
            }),
          })}
        </p>
      ))}
      <div className="grid gap-3 md:grid-cols-2">
        {sides.map((side) => (
          <TeamSetup
            key={side}
            side={side}
            name={teamNames[side]}
            state={state}
            record={record}
            disabled={disabled}
            suspended={suspended}
          />
        ))}
      </div>
      <Officials state={state} record={record} disabled={disabled} />
      <Button
        type="button"
        className="w-full text-lg"
        disabled={disabled || !ready}
        onClick={() => record("period_start", {})}
      >
        {t("tipOff")}
      </Button>
      {!ready && (
        <p className="text-center text-sm text-muted-foreground">
          {t(blockedByPayment ? "tipOffPaymentHelp" : "tipOffHelp")}
        </p>
      )}
    </div>
  );
}

function TeamSetup({
  side,
  name,
  state,
  record,
  disabled,
  suspended,
}: {
  side: Side;
  name: string;
  state: BasketballGameState;
  record: RecordEvent;
  disabled: boolean;
  suspended: ReadonlySet<string>;
}) {
  const t = useTranslations("Scorer");
  const team = state.teams[side];
  const [starters, setStarters] = useState<string[]>(() =>
    team.startersSet ? [...team.onCourt] : [],
  );
  const [editing, setEditing] = useState<string>();
  const [jersey, setJersey] = useState("");
  return (
    <section
      className="space-y-3 rounded-2xl border bg-card p-3"
      aria-label={name}
    >
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="truncate text-lg font-semibold">{name}</h2>
        <p className="text-sm text-muted-foreground">
          {t("presentCount", {
            count: team.playerIds.filter((id) => team.players[id].present)
              .length,
          })}
        </p>
      </div>
      {!team.playerIds.length && (
        <p className="text-sm text-destructive">{t("noRoster")}</p>
      )}
      <ul className="divide-y">
        {team.playerIds.map((id) => {
          const line = team.players[id];
          const starting = starters.includes(id);
          return (
            <li key={id} className="flex flex-wrap items-center gap-2 py-2">
              {editing === id ? (
                <form
                  className="flex items-center gap-2"
                  onSubmit={(event) => {
                    event.preventDefault();
                    const number = Number(jersey);
                    if (
                      Number.isInteger(number) &&
                      jersey !== "" &&
                      record("jersey", { team: side, playerId: id, number })
                    )
                      setEditing(undefined);
                  }}
                >
                  <Input
                    aria-label={t("jerseyFor", { player: line.name })}
                    inputMode="numeric"
                    value={jersey}
                    onChange={(event) =>
                      setJersey(
                        event.target.value.replace(/\D/g, "").slice(0, 3),
                      )
                    }
                    className="w-20"
                    autoFocus
                  />
                  <Button disabled={disabled}>{t("save")}</Button>
                </form>
              ) : (
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => {
                    setEditing(id);
                    setJersey(String(line.jersey));
                  }}
                  className="min-h-11 min-w-12 rounded-lg border-2 font-display text-xl font-semibold"
                  aria-label={t("changeJersey", {
                    player: line.name,
                    number: line.jersey,
                  })}
                >
                  {line.jersey}
                </button>
              )}
              <span className="min-w-0 flex-1 truncate font-semibold">
                {line.name}
              </span>
              {line.present ? (
                <button
                  type="button"
                  disabled={disabled || team.startersSet}
                  aria-pressed={starting}
                  onClick={() =>
                    setStarters(
                      starting
                        ? starters.filter((value) => value !== id)
                        : starters.length < 5
                          ? [...starters, id]
                          : starters,
                    )
                  }
                  className="min-h-11 rounded-lg border-2 px-3 text-sm font-semibold aria-pressed:border-navy aria-pressed:bg-navy aria-pressed:text-on-dark"
                >
                  {t("starter")}
                </button>
              ) : suspended.has(id) ? (
                <span className="rounded-lg bg-destructive/10 px-3 py-2 text-sm font-semibold text-destructive">
                  {t("suspended")}
                </span>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-11 px-3 py-1 text-sm"
                  disabled={disabled}
                  onClick={() =>
                    record("checkin", { team: side, playerId: id })
                  }
                >
                  {t("markHere")}
                </Button>
              )}
            </li>
          );
        })}
      </ul>
      {team.startersSet ? (
        <p className="rounded-xl bg-accent p-3 text-sm font-semibold">
          {t("startersConfirmed")}
        </p>
      ) : (
        <Button
          type="button"
          variant="dark"
          className="w-full"
          disabled={disabled || starters.length !== 5}
          onClick={() =>
            record("starters", { team: side, playerIds: starters })
          }
        >
          {t("confirmStarters", { count: starters.length })}
        </Button>
      )}
    </section>
  );
}

function Officials({
  state,
  record,
  disabled,
}: {
  state: BasketballGameState;
  record: RecordEvent;
  disabled: boolean;
}) {
  const t = useTranslations("Scorer");
  const [referees, setReferees] = useState<string[]>(() => {
    const saved = state.officials?.referees ?? [];
    return [saved[0] ?? "", saved[1] ?? "", saved[2] ?? ""];
  });
  const [scorer, setScorer] = useState(state.officials?.scorer ?? "");
  const [timekeeper, setTimekeeper] = useState(
    state.officials?.timekeeper ?? "",
  );
  const [saved, setSaved] = useState(false);
  return (
    <details className="rounded-2xl border bg-card p-3" open={!state.officials}>
      <summary className="min-h-11 cursor-pointer py-2 text-lg font-semibold">
        {t("officials")}
      </summary>
      <form
        className="grid gap-3 sm:grid-cols-2"
        onSubmit={(event) => {
          event.preventDefault();
          setSaved(
            record("officials", {
              referees: referees.map((name) => name.trim()).filter(Boolean),
              scorer: scorer.trim() || null,
              timekeeper: timekeeper.trim() || null,
            }),
          );
        }}
      >
        {referees.map((name, index) => (
          <div key={index} className="space-y-1">
            <label
              htmlFor={`referee-${index}`}
              className="text-sm font-semibold"
            >
              {t("referee", { number: index + 1 })}
            </label>
            <Input
              id={`referee-${index}`}
              value={name}
              maxLength={100}
              onChange={(event) =>
                setReferees(
                  referees.map((value, position) =>
                    position === index ? event.target.value : value,
                  ),
                )
              }
            />
          </div>
        ))}
        <div className="space-y-1">
          <label htmlFor="official-scorer" className="text-sm font-semibold">
            {t("scorerName")}
          </label>
          <Input
            id="official-scorer"
            value={scorer}
            maxLength={100}
            onChange={(event) => setScorer(event.target.value)}
          />
        </div>
        <div className="space-y-1">
          <label
            htmlFor="official-timekeeper"
            className="text-sm font-semibold"
          >
            {t("timekeeper")}
          </label>
          <Input
            id="official-timekeeper"
            value={timekeeper}
            maxLength={100}
            onChange={(event) => setTimekeeper(event.target.value)}
          />
        </div>
        <Button variant="outline" disabled={disabled} className="sm:col-span-2">
          {t("saveOfficials")}
        </Button>
        {saved && (
          <p role="status" className="text-sm font-semibold sm:col-span-2">
            {t("officialsSaved")}
          </p>
        )}
      </form>
    </details>
  );
}
