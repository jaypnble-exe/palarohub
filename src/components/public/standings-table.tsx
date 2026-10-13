import { getTranslations } from "next-intl/server";
import type { DivisionStandings } from "@/lib/standings-data";
import { EmptyState } from "@/components/ui/empty-state";
import { cardVariants } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/** One division's table. Phone first: points-for/against show on wider screens. */
export async function StandingsTable({
  standings,
}: {
  standings: DivisionStandings;
}) {
  const t = await getTranslations("Standings");
  const { rows } = standings;
  const draws = rows.some((row) => row.draws > 0);
  const tied = rows.some((row) => row.tied);
  const cell = "px-2 py-3 text-right tabular-nums";
  const wide = `${cell} hidden sm:table-cell`;
  return (
    <section
      className="space-y-2"
      aria-labelledby={`division-${standings.divisionId}`}
    >
      <h2
        id={`division-${standings.divisionId}`}
        className="font-display text-2xl font-semibold"
      >
        {standings.divisionName}
      </h2>
      {rows.length === 0 ? (
        <EmptyState title={t("noTeams")} />
      ) : (
        <div
          className={cn(cardVariants({ padding: "none" }), "overflow-hidden")}
        >
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="px-2 py-2 text-right" scope="col">
                  <abbr title={t("rankLong")}>#</abbr>
                </th>
                <th className="px-2 py-2" scope="col">
                  {t("team")}
                </th>
                <th className="px-2 py-2 text-right" scope="col">
                  <abbr title={t("playedLong")}>{t("played")}</abbr>
                </th>
                <th className="px-2 py-2 text-right" scope="col">
                  <abbr title={t("winsLong")}>{t("wins")}</abbr>
                </th>
                <th className="px-2 py-2 text-right" scope="col">
                  <abbr title={t("lossesLong")}>{t("losses")}</abbr>
                </th>
                {draws && (
                  <th className="px-2 py-2 text-right" scope="col">
                    <abbr title={t("drawsLong")}>{t("draws")}</abbr>
                  </th>
                )}
                <th
                  className="hidden px-2 py-2 text-right sm:table-cell"
                  scope="col"
                >
                  <abbr title={t("forLong")}>{t("for")}</abbr>
                </th>
                <th
                  className="hidden px-2 py-2 text-right sm:table-cell"
                  scope="col"
                >
                  <abbr title={t("againstLong")}>{t("against")}</abbr>
                </th>
                <th className="px-2 py-2 text-right" scope="col">
                  <abbr title={t("differenceLong")}>+/-</abbr>
                </th>
                <th className="px-2 py-2 text-right" scope="col">
                  <abbr title={t("pointsLong")}>{t("points")}</abbr>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.teamId} className="border-b last:border-0">
                  <td className={`${cell} text-muted-foreground`}>
                    {row.rank}
                    {row.tied ? "=" : ""}
                  </td>
                  <th
                    scope="row"
                    className="max-w-[9rem] truncate px-2 py-3 text-left font-semibold"
                  >
                    {row.name}
                  </th>
                  <td className={cell}>{row.played}</td>
                  <td className={cell}>{row.wins}</td>
                  <td className={cell}>{row.losses}</td>
                  {draws && <td className={cell}>{row.draws}</td>}
                  <td className={wide}>{row.pointsFor}</td>
                  <td className={wide}>{row.pointsAgainst}</td>
                  <td className={cell}>
                    {row.difference > 0 ? `+${row.difference}` : row.difference}
                  </td>
                  <td className={`${cell} font-bold`}>{row.points}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-sm text-muted-foreground">
        {t("gamesCounted", { count: standings.gamesCounted })}
        {tied ? ` ${t("tiedNote")}` : ""}
      </p>
    </section>
  );
}
