import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { getTranslations, getFormatter } from "next-intl/server";
import { getLeagueAccess } from "@/lib/league-access";
import { AccessDenied } from "@/components/access-denied";
import { SeasonWizard } from "@/components/admin/season-wizard";
import { Button } from "@/components/ui/button";
import { seasonFormValues } from "@/lib/season-data";
import { SportRulesFields } from "@/lib/sports/rules-fields";
import { allowedRatingLabels } from "@/lib/domain/ratings";
import { cardVariants } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

export default async function SeasonPage({
  params,
}: {
  params: Promise<{ league: string; seasonId: string }>;
}) {
  const { league: slug, seasonId } = await params;
  if (!z.uuid().safeParse(seasonId).success) notFound();
  const { supabase, league, canView, canManage } = await getLeagueAccess(slug);
  if (!canView) return <AccessDenied />;
  const { data: season, error } = await supabase
    .from("seasons")
    .select("*,divisions(*)")
    .eq("league_id", league.id)
    .eq("id", seasonId)
    .maybeSingle();
  if (error) throw new Error("Unable to load season.");
  if (!season) notFound();
  const values = seasonFormValues(season, season.divisions);
  const t = await getTranslations("Seasons");
  const registrationText = await getTranslations("Registration");
  const format = await getFormatter();
  return (
    <main className="mx-auto max-w-2xl space-y-6 py-8">
      <Button variant="ghost" asChild>
        <Link href={`/admin/${slug}/seasons`}>{t("backToSeasons")}</Link>
      </Button>
      <div className="space-y-3">
        <h1 className="text-3xl font-bold">{season.name}</h1>
        <Badge>{t(season.status)}</Badge>
      </div>
      {season.status === "published" && (
        <Button asChild variant="outline">
          <Link href={`/admin/${slug}/seasons/${season.id}/registration`}>
            {registrationText("registrationSettings")}
          </Link>
        </Button>
      )}
      {season.status === "draft" && canManage ? (
        <SeasonWizard slug={slug} seasonId={season.id} initial={values} />
      ) : (
        <>
          <p className="text-muted-foreground">
            {format.dateTime(new Date(`${season.start_date}T12:00:00Z`), {
              dateStyle: "medium",
            })}{" "}
            â€“{" "}
            {format.dateTime(new Date(`${season.end_date}T12:00:00Z`), {
              dateStyle: "medium",
            })}
          </p>
          {season.status === "published" && (
            <p className="rounded-xl border bg-card p-4 text-sm">
              {t("publishedLocked")}
            </p>
          )}
          <section className="space-y-4">
            <h2 className="text-2xl font-semibold">{t("ratingScale")}</h2>
            <p>{season.rating_scale.join(" â†’ ")}</p>
          </section>
          <section className="space-y-4">
            <h2 className="text-2xl font-semibold">{t("divisions")}</h2>
            {values.divisions.map((division) => (
              <div
                key={division.id}
                className={cn(cardVariants(), "space-y-3")}
              >
                <h3 className="text-xl font-semibold">{division.name}</h3>
                <p>{t("maximum", { rating: division.maxRating })}</p>
                <p className="text-sm text-muted-foreground">
                  {t("allowedRatings", {
                    ratings: allowedRatingLabels(
                      season.rating_scale,
                      division.maxRating,
                    ).join(", "),
                  })}
                </p>
                <p>
                  {t("rosterRange", {
                    min: division.rosterMin,
                    max: division.rosterMax,
                  })}
                </p>
                {division.rules ? (
                  <SportRulesFields
                    sport={division.sport}
                    value={division.rules}
                    disabled
                  />
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {t("inheritRules")}
                  </p>
                )}
              </div>
            ))}
          </section>
          <section className="space-y-4">
            <h2 className="text-2xl font-semibold">{t("rules")}</h2>
            <SportRulesFields
              sport={season.sport}
              value={values.rules}
              disabled
            />
          </section>
        </>
      )}
    </main>
  );
}
