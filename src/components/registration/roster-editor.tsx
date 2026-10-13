"use client";
import { useId, useState } from "react";
import { useTranslations } from "next-intl";
import type {
  RegistrationPlayer,
  RosterEntryInput,
} from "@/lib/validation/registration";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/field";
import { Badge } from "@/components/ui/badge";

const NEW_PLAYER = "new";

export function RosterEditor({
  value,
  onChange,
  catalog,
  limit = 50,
  disabled = false,
  onAddNewPlayer,
}: {
  value: readonly RosterEntryInput[];
  onChange: (roster: RosterEntryInput[]) => void;
  catalog: readonly RegistrationPlayer[];
  limit?: number;
  disabled?: boolean;
  /**
   * Offers "Add a new player" in the list. Receives the typed name and returns
   * the new player's id; nothing is saved until the roster is.
   */
  onAddNewPlayer?: (name: string) => string;
}) {
  const t = useTranslations("Registration");
  const prefix = useId();
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState("");
  const [newName, setNewName] = useState("");
  const typedName = newName.trim();
  const sameName = catalog.find(
    (player) =>
      player.name.trim().toLocaleLowerCase() === typedName.toLocaleLowerCase(),
  );
  const nextJersey = () => {
    const jerseys = new Set(value.map((item) => item.jerseyNumber));
    let number = 1;
    while (jerseys.has(number)) number++;
    return number;
  };
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
                {player?.isNew ? (
                  <p className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                    <Badge tone="warning">{t("newPlayerBadge")}</Badge>
                    {t("newPlayerSaved")}
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {player?.rating
                      ? t("playerRating", { rating: player.rating })
                      : t("unrated")}
                  </p>
                )}
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
          <Select
            id={`${prefix}-select`}
            value={selected}
            onChange={(event) => {
              setSelected(event.target.value);
              if (event.target.value === NEW_PLAYER) setNewName(search.trim());
            }}
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
            {onAddNewPlayer && (
              <option value={NEW_PLAYER}>
                {search.trim()
                  ? t("addNamedPlayerOption", { name: search.trim() })
                  : t("addNewPlayerOption")}
              </option>
            )}
          </Select>
          {selected === NEW_PLAYER && onAddNewPlayer ? (
            <div className="space-y-3">
              <label
                htmlFor={`${prefix}-new`}
                className="block text-sm font-semibold"
              >
                {t("newPlayerName")}
              </label>
              <Input
                id={`${prefix}-new`}
                value={newName}
                maxLength={100}
                autoComplete="off"
                onChange={(event) => setNewName(event.target.value)}
                aria-invalid={!!sameName}
              />
              {sameName ? (
                <p role="alert" className="text-sm text-destructive">
                  {t("newPlayerExists", { name: sameName.name })}
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">
                  {t("newPlayerInlineHelp")}
                </p>
              )}
              <Button
                type="button"
                variant="outline"
                disabled={!typedName || !!sameName || value.length >= limit}
                onClick={() => {
                  const id = onAddNewPlayer(typedName);
                  onChange([
                    ...value,
                    { playerId: id, jerseyNumber: nextJersey() },
                  ]);
                  setSelected("");
                  setNewName("");
                  setSearch("");
                }}
              >
                {t("addToRoster")}
              </Button>
            </div>
          ) : (
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
                onChange([
                  ...value,
                  { playerId: selected, jerseyNumber: nextJersey() },
                ]);
                setSelected("");
              }}
            >
              {t("addToRoster")}
            </Button>
          )}
        </fieldset>
      )}
    </div>
  );
}
