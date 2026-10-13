"use client";
import { useId, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import type {
  RegistrationPlayer,
  RosterEntryInput,
} from "@/lib/validation/registration";
import type { EligibilityIssue } from "@/lib/domain/eligibility";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { Icon } from "@/components/ui/icon";
import { Progress } from "@/components/ui/stat";
import { cn } from "@/lib/utils";

/** How many players to list before the manager types a name. */
const SUGGESTIONS = 6;

const normal = (name: string) => name.trim().toLocaleLowerCase();

/**
 * The roster being built: one row per player with their jersey number, and
 * a search that adds a player with one tap. With `onAddNewPlayer`, a name
 * not in the league list can be added as a new player.
 */
export function RosterEditor({
  value,
  onChange,
  catalog,
  min,
  limit = 50,
  disabled = false,
  issues = [],
  onAddNewPlayer,
}: {
  value: readonly RosterEntryInput[];
  onChange: (roster: RosterEntryInput[]) => void;
  catalog: readonly RegistrationPlayer[];
  /** Shows a player count against the division's size when set. */
  min?: number;
  limit?: number;
  disabled?: boolean;
  /** Eligibility problems, shown on the player they belong to. */
  issues?: readonly EligibilityIssue[];
  /**
   * Offers "Add as a new player" in the search results. Receives the typed
   * name and returns the new player's id; nothing is saved until the roster is.
   */
  onAddNewPlayer?: (name: string) => string;
}) {
  const t = useTranslations("Registration");
  const prefix = useId();
  const searchRef = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState("");
  const [notice, setNotice] = useState<string>();
  const [removed, setRemoved] = useState<{
    entry: RosterEntryInput;
    index: number;
    player?: RegistrationPlayer;
  }>();
  const find = (id: string) => catalog.find((player) => player.id === id);
  const onRoster = (id: string) => value.some((entry) => entry.playerId === id);
  const typed = search.trim();
  const full = value.length >= limit;
  const matches = catalog.filter(
    (player) =>
      !onRoster(player.id) && normal(player.name).includes(normal(typed)),
  );
  const shown = typed ? matches.slice(0, 8) : matches.slice(0, SUGGESTIONS);
  const exact = typed
    ? catalog.find((player) => normal(player.name) === normal(typed))
    : undefined;
  const nextJersey = () => {
    const jerseys = new Set(value.map((item) => item.jerseyNumber));
    let number = 1;
    while (jerseys.has(number)) number++;
    return number;
  };

  function add(playerId: string, name: string) {
    const jerseyNumber = nextJersey();
    onChange([...value, { playerId, jerseyNumber }]);
    setSearch("");
    setRemoved(undefined);
    setNotice(t("playerAdded", { name, number: jerseyNumber }));
    searchRef.current?.focus();
  }
  function remove(index: number) {
    const entry = value[index];
    const player = find(entry.playerId);
    onChange(value.filter((_, i) => i !== index));
    setRemoved({ entry, index, player });
    setNotice(undefined);
  }
  function undo() {
    if (!removed) return;
    // A new player was forgotten when removed, so it comes back with a fresh id.
    const playerId =
      removed.player?.isNew && onAddNewPlayer
        ? onAddNewPlayer(removed.player.name)
        : removed.entry.playerId;
    const next = [...value];
    next.splice(removed.index, 0, { ...removed.entry, playerId });
    onChange(next);
    setRemoved(undefined);
  }

  return (
    <div className="space-y-4">
      {min !== undefined && (
        <div className="space-y-2">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="font-display text-xl font-semibold">
              {t("rosterCount", { count: value.length })}
            </p>
            <Badge tone={value.length >= min ? "success" : "warning"}>
              {value.length >= min
                ? t("rosterReady")
                : t("rosterShort", { count: min - value.length })}
            </Badge>
          </div>
          <Progress
            value={value.length}
            max={min}
            label={t("rosterNeeds", { min, max: limit })}
          />
          <p className="text-sm text-muted-foreground">
            {t("rosterNeeds", { min, max: limit })}
          </p>
        </div>
      )}

      {!!value.length && (
        <ul className="space-y-2">
          {value.map((entry, index) => {
            const player = find(entry.playerId);
            const name = player?.name ?? t("player");
            const problems = issues.filter(
              (issue) => issue.playerId === entry.playerId,
            );
            return (
              <li
                key={entry.playerId}
                className={cn(
                  "rounded-xl border bg-card p-3",
                  problems.length && "border-destructive/50",
                )}
              >
                <div className="flex items-center gap-3">
                  <Avatar name={name} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{name}</p>
                    <div className="flex flex-wrap items-center gap-x-2 text-sm text-muted-foreground">
                      {player?.isNew ? (
                        <Badge tone="warning">{t("newPlayerBadge")}</Badge>
                      ) : (
                        <span>
                          {player?.rating
                            ? t("playerRating", { rating: player.rating })
                            : t("unrated")}
                        </span>
                      )}
                      {!disabled && (
                        <button
                          type="button"
                          className="inline-flex min-h-11 items-center gap-1 font-semibold text-destructive hover:underline"
                          aria-label={t("removeNamed", { name })}
                          onClick={() => remove(index)}
                        >
                          <Icon name="close" className="size-4" />
                          {t("remove")}
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="w-20 shrink-0 space-y-1">
                    <label
                      htmlFor={disabled ? undefined : `${prefix}-${index}`}
                      className="block text-center text-xs font-semibold text-muted-foreground"
                    >
                      {t("jerseyShort")}
                    </label>
                    {disabled ? (
                      <p className="text-center font-display text-2xl font-semibold">
                        #{entry.jerseyNumber}
                      </p>
                    ) : (
                      <Input
                        id={`${prefix}-${index}`}
                        type="number"
                        inputMode="numeric"
                        min={0}
                        max={999}
                        className="px-2 text-center text-lg font-semibold"
                        value={entry.jerseyNumber}
                        aria-label={t("jerseyFor", { name })}
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
                    )}
                  </div>
                </div>
                {player?.isNew && (
                  <p className="mt-2 text-sm text-muted-foreground">
                    {t("newPlayerSaved")}
                  </p>
                )}
                {problems.map((issue) => (
                  <p
                    key={issue.code}
                    className="mt-2 text-sm font-semibold text-destructive"
                  >
                    {t(`eligibility.${issue.code}`, {
                      name,
                      rating: issue.rating ?? "",
                      maximumRating: issue.maximumRating ?? "",
                      min: issue.min ?? 0,
                      max: issue.max ?? 0,
                    })}
                  </p>
                ))}
              </li>
            );
          })}
        </ul>
      )}

      <div role="status" aria-live="polite">
        {removed ? (
          <p className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-accent p-3 text-sm font-semibold">
            {t("playerRemoved", { name: removed.player?.name ?? t("player") })}
            <Button
              type="button"
              variant="outline"
              className="min-h-11 px-4 py-2"
              onClick={undo}
            >
              {t("undo")}
            </Button>
          </p>
        ) : notice ? (
          <p className="text-sm font-semibold text-success">{notice}</p>
        ) : null}
      </div>

      {!disabled && (
        <div className="space-y-3 rounded-2xl border-2 border-dashed border-border bg-card p-4">
          <label htmlFor={`${prefix}-search`} className="block font-semibold">
            {t(onAddNewPlayer ? "findOrAddPlayer" : "findPlayer")}
          </label>
          <div className="relative">
            <Icon
              name="search"
              className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              ref={searchRef}
              id={`${prefix}-search`}
              type="search"
              autoComplete="off"
              className="pl-10"
              value={search}
              disabled={full}
              onChange={(event) => {
                setSearch(event.target.value);
                setNotice(undefined);
              }}
            />
          </div>
          {full ? (
            <p className="text-sm font-semibold text-muted-foreground">
              {t("rosterFull", { max: limit })}
            </p>
          ) : (
            <ul className="space-y-2" aria-label={t("searchResults")}>
              {shown.map((player) => (
                <li key={player.id}>
                  <button
                    type="button"
                    disabled={player.onAnotherTeam}
                    aria-label={t("addNamed", { name: player.name })}
                    onClick={() => add(player.id, player.name)}
                    className="flex min-h-14 w-full items-center gap-3 rounded-xl border border-border bg-background px-3 py-2 text-left transition-colors hover:border-navy disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <Avatar name={player.name} className="size-9 text-base" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold">
                        {player.name}
                      </span>
                      <span className="block text-sm text-muted-foreground">
                        {player.onAnotherTeam
                          ? t("unavailablePlayer")
                          : player.rating
                            ? t("playerRating", { rating: player.rating })
                            : t("unrated")}
                      </span>
                    </span>
                    {!player.onAnotherTeam && (
                      <span className="inline-flex items-center gap-1 text-sm font-bold text-orange-dark">
                        <Icon name="add" className="size-4" />
                        {t("add")}
                      </span>
                    )}
                  </button>
                </li>
              ))}
              {onAddNewPlayer && typed && !exact && (
                <li>
                  <button
                    type="button"
                    onClick={() => add(onAddNewPlayer(typed), typed)}
                    className="flex min-h-14 w-full items-center gap-3 rounded-xl border-2 border-primary/40 bg-orange-soft/50 px-3 py-2 text-left font-semibold text-orange-dark transition-colors hover:border-primary"
                  >
                    <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary text-white">
                      <Icon name="add" className="size-5" />
                    </span>
                    <span>{t("addNamedPlayerOption", { name: typed })}</span>
                  </button>
                </li>
              )}
            </ul>
          )}
          {!full && exact && onRoster(exact.id) && (
            <p className="text-sm text-muted-foreground">
              {t("alreadyOnRoster", { name: exact.name })}
            </p>
          )}
          {!full && typed && !shown.length && !onAddNewPlayer && (
            <p className="text-sm text-muted-foreground">{t("noMatches")}</p>
          )}
          {!full && !typed && matches.length > SUGGESTIONS && (
            <p className="text-sm text-muted-foreground">{t("findHint")}</p>
          )}
          {onAddNewPlayer && !full && (
            <p className="text-sm text-muted-foreground">
              {t("newPlayerInlineHelp")}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
