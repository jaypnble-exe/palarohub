"use client";
import { useId, useState } from "react";
import { useTranslations } from "next-intl";
import type {
  RegistrationPlayer,
  RosterEntryInput,
} from "@/lib/validation/registration";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function RosterEditor({
  value,
  onChange,
  catalog,
  limit = 50,
  disabled = false,
}: {
  value: readonly RosterEntryInput[];
  onChange: (roster: RosterEntryInput[]) => void;
  catalog: readonly RegistrationPlayer[];
  limit?: number;
  disabled?: boolean;
}) {
  const t = useTranslations("Registration");
  const prefix = useId();
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState("");
  const available = catalog.filter(
    (player) =>
      !value.some((entry) => entry.playerId === player.id) &&
      player.name.toLocaleLowerCase().includes(search.toLocaleLowerCase()),
  );
  return (
    <div className="space-y-4">
      <ul className="space-y-3">
        {value.map((entry, index) => {
          const player = catalog.find((item) => item.id === entry.playerId);
          return (
            <li
              key={entry.playerId}
              className="space-y-3 rounded-xl border bg-card p-4"
            >
              <div>
                <p className="font-semibold">{player?.name ?? t("player")}</p>
                <p className="text-sm text-muted-foreground">
                  {player?.rating
                    ? t("playerRating", { rating: player.rating })
                    : t("unrated")}
                </p>
              </div>
              <div className="flex items-end gap-3">
                <div className="min-w-0 flex-1 space-y-2">
                  <label
                    htmlFor={`${prefix}-${index}`}
                    className="text-sm font-semibold"
                  >
                    {t("jerseyNumber")}
                  </label>
                  <Input
                    id={`${prefix}-${index}`}
                    type="number"
                    min={0}
                    max={999}
                    disabled={disabled}
                    value={entry.jerseyNumber}
                    onChange={(event) =>
                      onChange(
                        value.map((item, i) =>
                          i === index
                            ? {
                                ...item,
                                jerseyNumber: Number(event.target.value),
                              }
                            : item,
                        ),
                      )
                    }
                  />
                </div>
                {!disabled && (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      if (
                        window.confirm(
                          t("removePlayerConfirm", {
                            name: player?.name ?? t("player"),
                          }),
                        )
                      )
                        onChange(value.filter((_, i) => i !== index));
                    }}
                  >
                    {t("remove")}
                  </Button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      {!disabled && (
        <fieldset className="space-y-3 rounded-xl border bg-card p-4">
          <legend className="sr-only">{t("choosePlayer")}</legend>
          <label
            htmlFor={`${prefix}-search`}
            className="block text-sm font-semibold"
          >
            {t("findPlayer")}
          </label>
          <Input
            id={`${prefix}-search`}
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <label
            htmlFor={`${prefix}-select`}
            className="block text-sm font-semibold"
          >
            {t("choosePlayer")}
          </label>
          <select
            id={`${prefix}-select`}
            value={selected}
            onChange={(event) => setSelected(event.target.value)}
            className="min-h-[52px] w-full rounded-xl border-2 bg-card px-3"
          >
            <option value="">{t("choosePlayer")}</option>
            {available.map((player) => (
              <option
                key={player.id}
                value={player.id}
                disabled={player.onAnotherTeam}
              >
                {t("playerOption", {
                  name: player.name,
                  rating: player.rating ?? t("unrated"),
                })}
                {player.onAnotherTeam ? t("unavailablePlayer") : ""}
              </option>
            ))}
          </select>
          <Button
            type="button"
            variant="outline"
            disabled={
              !selected ||
              value.length >= limit ||
              !available.some(
                (player) => player.id === selected && !player.onAnotherTeam,
              )
            }
            onClick={() => {
              const jerseys = new Set(value.map((item) => item.jerseyNumber));
              let number = 1;
              while (jerseys.has(number)) number++;
              onChange([
                ...value,
                { playerId: selected, jerseyNumber: number },
              ]);
              setSelected("");
            }}
          >
            {t("addToRoster")}
          </Button>
        </fieldset>
      )}
    </div>
  );
}
