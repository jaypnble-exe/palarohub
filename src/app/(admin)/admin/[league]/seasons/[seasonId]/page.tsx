import { notFound } from "next/navigation";
import { z } from "zod";
import { getTranslations, getFormatter } from "next-intl/server";
import { getLeagueAccess } from "@/lib/league-access";
import { AccessDenied } from "@/components/access-denied";
import { SeasonWizard } from "@/components/admin/season-wizard";
import { seasonFormValues } from "@/lib/season-data";
import { SportRulesFields } from "@/lib/sports/rules-fields";
import { allowedRatingLabels } from "@/lib/domain/ratings";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { CloseSeason } from "@/components/admin/close-season";
import { cardVariants } from "@/components/ui/card";
import { LinkCard } from "@/components/ui/link-card";
import { PageHeader } from "@/components/ui/page-header";
import { Section } from "@/components/ui/section";
import { cn } from "@/lib/utils";

/** A season: finish setting up a draft, or see a published season's setup. */
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
  const [closure, openGames] =
    season.status === "published"
      ? await Promise.all([
          supabase
            .from("season_closures")
            .select("closed_at")
            .eq("league_id", league.id)
            .eq("season_id", season.id)
            .maybeSingle(),
          supabase
            .from("games")
            .select("id", { count: "exact", head: true })
            .eq("league_id", league.id)
            .eq("season_id", season.id)
            .not("status", "in", "(approved,cancelled)"),
        ])
      : [null, null];
  if (closure?.error || openGames?.error)
    throw new Error("Unable to load season.");
  const closedAt = closure?.data?.closed_at ?? null;
  const t = await getTranslations("Seasons");
  const registrationText = await getTranslations("Registration");
  const format = await getFormatter();
  const date = (value: string) =>
    format.dateTime(new Date(`${value}T12:00:00Z`), { dateStyle: "medium" });
  const draft = season.status === "draft";
  const header = (
    <PageHeader
      back={{ href: `/admin/${slug}/seasons`, label: t("backToSeasons") }}
      eyebrow={
        <Badge tone={draft ? "warning" : closedAt ? "neutral" : "success"}>
          {t(closedAt ? "closed" : season.status)}
        </Badge>
      }
      title={season.name}
      description={t("dates", {
        start: date(season.start_date),
        end: date(season.end_date),
      })}
    />
  );

  if (draft && canManage)
    return (
      <main className="mx-auto max-w-2xl space-y-6 py-6">
        {header}
        <Alert tone="info" title={t("draftTitle")}>
          {t("draftIntro")}
        </Alert>
        <SeasonWizard slug={slug} seasonId={season.id} initial={values} />
      </main>
    );

  return (
    <main className="mx-auto max-w-2xl space-y-6 py-6">
      {header}
      {draft ? (
        <Alert tone="info">{t("draftViewOnly")}</Alert>
      ) : (
        <>
          <div className="grid gap-3">
            <LinkCard
              href={`/admin/${slug}/seasons/${season.id}/registration`}
              title={registrationText("registrationSettings")}
              subtitle={t("registrationShortcut")}
            />
            <LinkCard
              href={`/admin/${slug}/schedule`}
              title={t("scheduleShortcut")}
              subtitle={t("scheduleShortcutHelp")}
            />
            <LinkCard
              href={`/admin/${slug}/teams?season=${season.id}`}
              title={t("teamsShortcut")}
              subtitle={t("teamsShortcutHelp")}
            />
          </div>
          {closedAt ? (
            <Alert tone="success" title={t("closedTitle")}>
              {t("closedBody", {
                date: format.dateTime(new Date(closedAt), {
                  dateStyle: "medium",
                }),
              })}
            </Alert>
          ) : (
            <>
              <Alert tone="info">{t("publishedLocked")}</Alert>
              {canManage && (
                <CloseSeason
                  slug={slug}
                  seasonId={season.id}
                  seasonName={season.name}
                  openGames={openGames?.count ?? 0}
                />
              )}
            </>
          )}
        </>
      )}
      <Section id="season-ratings" title={t("ratingScale")}>
        <ol
          className="flex flex-wrap items-center gap-2"
          aria-label={t("scaleOrder")}
        >
          {season.rating_scale.map((label, index) => (
            <li key={label} className="flex items-center gap-2">
              <span className="grid min-h-10 min-w-10 place-items-center rounded-xl bg-navy px-3 font-display text-lg font-bold text-on-dark">
                {label}
              </span>
              {index < season.rating_scale.length - 1 && (
                <span aria-hidden="true" className="text-muted-foreground">
                  →
                </span>
              )}
            </li>
          ))}
        </ol>
        <p className="text-sm text-muted-foreground">{t("scaleOrder")}</p>
      </Section>
      <Section id="season-divisions" title={t("divisions")}>
        <ul className={cn(cardVariants({ padding: "none" }), "divide-y")}>
          {values.divisions.map((division) => (
            <li key={division.id} className="space-y-2 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-lg font-semibold">{division.name}</h3>
                <span className="rounded-lg bg-accent px-2.5 py-1 text-sm font-semibold">
                  {t("maximum", { rating: division.maxRating })}
                </span>
              </div>
              <p className="text-sm text-muted-foreground">
                {t("rosterRange", {
                  min: division.rosterMin,
                  max: division.rosterMax,
                })}
                {" · "}
                {t("allowedRatings", {
                  ratings: allowedRatingLabels(
                    season.rating_scale,
                    division.maxRating,
                  ).join(", "),
                })}
              </p>
              {division.rules ? (
                <details>
                  <summary className="min-h-11 cursor-pointer py-3 text-sm font-semibold">
                    {t("divisionRules")}
                  </summary>
                  <SportRulesFields
                    sport={division.sport}
                    value={division.rules}
                    disabled
                  />
                </details>
              ) : (
                <p className="text-sm text-muted-foreground">
                  {t("inheritRules")}
                </p>
              )}
            </li>
          ))}
        </ul>
      </Section>
      <Section id="season-rules" title={t("rules")}>
        <div className={cardVariants()}>
          <SportRulesFields
            sport={season.sport}
            value={values.rules}
            disabled
          />
        </div>
      </Section>
    </main>
  );
}
