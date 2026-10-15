import { getFormatter, getTranslations } from "next-intl/server";
import { careerMetricValue, type CareerRow } from "@/lib/domain/career-stats";
import { getSportModule } from "@/lib/sports/registry";
import { DataTable } from "@/components/ui/data-table";

export async function CareerTable({
  rows,
  sport,
  slug,
  label,
}: {
  rows: readonly CareerRow[];
  sport: string;
  slug: string;
  label: string;
}) {
  const t = await getTranslations("Competition");
  const format = await getFormatter();
  const metrics = getSportModule(sport).careerMetrics.slice(0, 5);
  const value = (row: CareerRow, index: number) => {
    const number = careerMetricValue(row, metrics[index]);
    return number === null
      ? t("noValue")
      : format.number(number, { maximumFractionDigits: 1 });
  };
  const ordered = [...rows].sort(
    (a, b) =>
      (careerMetricValue(b, metrics[0]) ?? 0) -
        (careerMetricValue(a, metrics[0]) ?? 0) || a.name.localeCompare(b.name),
  );
  return (
    <DataTable
      label={label}
      rows={ordered}
      rowKey={(row) => row.playerId}
      rowHref={(row) => `/${slug}/players/${row.playerId}`}
      rowLabel={(row) => t("openPlayer", { player: row.name })}
      openLabel={t("profile")}
      columns={[
        {
          key: "player",
          header: t("player"),
          cell: (row) => <span className="font-semibold">{row.name}</span>,
        },
        {
          key: "games",
          header: t("games"),
          align: "right",
          cell: (row) => row.games,
        },
        ...metrics.map((metric, index) => ({
          key: metric.key,
          header: t(`metric.${metric.labelKey}`),
          align: "right" as const,
          className: index > 1 ? "hidden lg:table-cell" : undefined,
          cell: (row: CareerRow) => value(row, index),
        })),
      ]}
      phone={(row) => ({
        title: row.name,
        subtitle: t("playerLine", {
          games: row.games,
          metric: t(`metric.${metrics[0].labelKey}`),
          value: value(row, 0),
        }),
      })}
    />
  );
}
