"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { createBracket } from "@/app/(admin)/admin/[league]/brackets/actions";
import { buildBracket, type BracketPreset } from "@/lib/domain/brackets";
import { Button } from "@/components/ui/button";
import { cardVariants } from "@/components/ui/card";

export function BracketSetup({
  slug,
  divisionId,
  teams,
  pendingGames,
  tiedSeeds,
}: {
  slug: string;
  divisionId: string;
  teams: readonly { id: string; name: string }[];
  pendingGames: number;
  tiedSeeds: boolean;
}) {
  const t = useTranslations("Competition");
  const router = useRouter();
  const [preset, setPreset] = useState<BracketPreset>("single");
  const [count, setCount] = useState(Math.min(8, teams.length));
  const [seeds, setSeeds] = useState(teams.map((team) => team.id));
  const [confirmed, setConfirmed] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string>();
  if (teams.length < 2)
    return <p className={cardVariants()}>{t("needTeams")}</p>;
  if (pendingGames)
    return (
      <p className={cardVariants({ tone: "warning" })}>
        {t("pendingGames", { count: pendingGames })}
      </p>
    );
  const preview = buildBracket(count, preset).filter(
    (node) => node.round === 1,
  );
  const selectClass =
    "min-h-12 w-full rounded-xl border-2 border-input bg-card px-3 py-2";
  return (
    <form
      className={`${cardVariants()} space-y-5`}
      onSubmit={(event) => {
        event.preventDefault();
        start(async () => {
          try {
            const result = await createBracket(slug, {
              divisionId,
              preset,
              teamIds: seeds.slice(0, count),
              confirmed,
            });
            if (result.error) setError(t(`error.${result.error}`));
            else router.refresh();
          } catch {
            setError(t("error.saveFailed"));
          }
        });
      }}
    >
      <h2 className="font-display text-2xl font-semibold">
        {t("createBracket")}
      </h2>
      <p className="text-sm text-muted-foreground">{t("setupHelp")}</p>
      {tiedSeeds && (
        <p className="rounded-xl bg-orange-soft p-3 text-sm text-orange-dark">
          {t("tiedSeeds")}
        </p>
      )}
      <fieldset disabled={pending} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-2">
            <span className="font-semibold">{t("format")}</span>
            <select
              className={selectClass}
              value={preset}
              onChange={(event) => {
                setPreset(event.target.value as BracketPreset);
                setConfirmed(false);
              }}
            >
              {(["single", "best3", "best5", "twice"] as const).map((value) => (
                <option key={value} value={value}>
                  {t(`preset.${value}`)}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-2">
            <span className="font-semibold">{t("qualifiers")}</span>
            <select
              className={selectClass}
              value={count}
              onChange={(event) => {
                setCount(Number(event.target.value));
                setConfirmed(false);
              }}
            >
              {Array.from(
                { length: Math.min(16, teams.length) - 1 },
                (_, index) => index + 2,
              ).map((number) => (
                <option key={number} value={number}>
                  {number}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {seeds.slice(0, count).map((id, index) => (
            <label key={index} className="space-y-1 text-sm">
              <span className="font-semibold">
                {t("seed", { number: index + 1 })}
              </span>
              <select
                className={selectClass}
                value={id}
                onChange={(event) => {
                  const next = [...seeds];
                  const other = next.indexOf(event.target.value);
                  next[index] = event.target.value;
                  if (other >= 0) next[other] = id;
                  setSeeds(next);
                  setConfirmed(false);
                }}
              >
                {teams.map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.name}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>
        <div className="rounded-xl bg-accent p-4">
          <h3 className="mb-2 font-semibold">{t("firstRound")}</h3>
          <ul className="space-y-1 text-sm">
            {preview.map((node) => (
              <li key={node.key}>
                {t("previewMatch", {
                  home:
                    teams.find(
                      (team) => team.id === seeds[(node.homeSeed ?? 1) - 1],
                    )?.name ?? t("bye"),
                  away:
                    (node.awaySeed ?? 0) > count
                      ? t("bye")
                      : (teams.find(
                          (team) => team.id === seeds[(node.awaySeed ?? 1) - 1],
                        )?.name ?? t("bye")),
                })}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-sm text-muted-foreground">
            {t(preset === "twice" ? "twiceHelp" : "bracketHelp")}
          </p>
        </div>
        <label className="flex min-h-12 items-start gap-3">
          <input
            type="checkbox"
            className="mt-1 size-5 shrink-0"
            checked={confirmed}
            onChange={(event) => setConfirmed(event.target.checked)}
          />
          <span>{t("confirmSeeds")}</span>
        </label>
      </fieldset>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <Button type="submit" disabled={pending || !confirmed}>
        {t(pending ? "creating" : "createBracket")}
      </Button>
    </form>
  );
}
