import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";

export async function SeasonList({
  slug,
  seasons,
  canManage,
  publicView = false,
}: {
  slug: string;
  seasons: {
    id: string;
    name: string;
    status: string;
    start_date: string;
    end_date: string;
    divisions: { name: string; max_rating: string }[];
  }[];
  canManage: boolean;
  publicView?: boolean;
}) {
  const t = await getTranslations("Seasons");
  const format = await getFormatter();
  return (
    <div className="space-y-5">
      {canManage && (
        <Button asChild>
          <Link href={`/admin/${slug}/seasons/new`}>{t("create")}</Link>
        </Button>
      )}
      {!seasons.length ? (
        <p className="rounded-2xl border bg-card p-5 text-muted-foreground">
          {t(publicView ? "noPublished" : "empty")}
        </p>
      ) : (
        <ul className="space-y-4">
          {seasons.map((season) => (
            <li
              key={season.id}
              className="space-y-4 rounded-2xl border bg-card p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <h3 className="text-2xl font-semibold">{season.name}</h3>
                <span className="rounded-full bg-accent px-3 py-1 text-sm font-semibold">
                  {t(season.status)}
                </span>
              </div>
              <p className="text-sm text-muted-foreground">
                {format.dateTime(new Date(`${season.start_date}T12:00:00Z`), {
                  dateStyle: "medium",
                })}{" "}
                –{" "}
                {format.dateTime(new Date(`${season.end_date}T12:00:00Z`), {
                  dateStyle: "medium",
                })}
              </p>
              <div className="flex flex-wrap gap-2">
                {season.divisions.map((division) => (
                  <span
                    key={division.name}
                    className="rounded-lg border bg-background px-3 py-2 text-sm"
                  >
                    {division.name} ·{" "}
                    {t("maximum", { rating: division.max_rating })}
                  </span>
                ))}
              </div>
              {!publicView && (
                <Button asChild variant="outline">
                  <Link href={`/admin/${slug}/seasons/${season.id}`}>
                    {t("viewSetup")}
                  </Link>
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
