import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { hasSupabaseConfig } from "@/lib/supabase/env";
import { getSiteUrl } from "@/lib/auth";
import { seasonStandings } from "@/lib/standings-data";
import { Button } from "@/components/ui/button";
import { ShareButtons } from "@/components/share-buttons";
import { StandingsTable } from "@/components/public/standings-table";

export default async function StandingsPage({
  params,
  searchParams,
}: {
  params: Promise<{ league: string }>;
  searchParams: Promise<{ season?: string }>;
}) {
  const { league: slug } = await params;
  const query = await searchParams;
  if (!hasSupabaseConfig()) notFound();
  const supabase = await createClient();
  const { data: league, error } = await supabase
    .from("leagues")
    .select("id,name")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw new Error("Unable to load league.");
  if (!league) notFound();
  const { data: seasons, error: seasonError } = await supabase
    .from("seasons")
    .select("id,name,divisions(id,name,sport)")
    .eq("league_id", league.id)
    .eq("status", "published")
    .order("start_date", { ascending: false });
  if (seasonError) throw new Error("Unable to load seasons.");
  const season = seasons.find((item) => item.id === query.season) ?? seasons[0];
  const standings = season
    ? await seasonStandings(supabase, league.id, season.id, season.divisions)
    : [];
  const t = await getTranslations("Standings");
  const path = `/${slug}/standings`;
  const chip =
    "inline-flex min-h-11 items-center rounded-xl border-2 bg-background px-4 font-semibold aria-[current=true]:border-navy aria-[current=true]:bg-navy aria-[current=true]:text-on-dark";
  return (
    <main className="space-y-6 py-8">
      <div className="flex flex-wrap gap-2">
        <Button asChild variant="ghost">
          <Link href={`/${slug}`}>{league.name}</Link>
        </Button>
        <Button asChild variant="ghost">
          <Link
            href={`/${slug}/schedule${season ? `?season=${season.id}` : ""}`}
          >
            {t("schedule")}
          </Link>
        </Button>
      </div>
      <div className="space-y-2">
        <h1 className="font-display text-3xl font-semibold">{t("title")}</h1>
        {season && <p className="text-muted-foreground">{season.name}</p>}
      </div>
      {seasons.length > 1 && (
        <nav aria-label={t("chooseSeason")} className="flex flex-wrap gap-2">
          {seasons.map((item) => (
            <Link
              key={item.id}
              href={`${path}?season=${item.id}`}
              aria-current={item.id === season?.id}
              className={chip}
            >
              {item.name}
            </Link>
          ))}
        </nav>
      )}
      {standings.length ? (
        standings.map((division) => (
          <StandingsTable key={division.divisionId} standings={division} />
        ))
      ) : (
        <p className="rounded-2xl border bg-card p-5">{t("noSeason")}</p>
      )}
      {season &&
        [...new Set(season.divisions.map((division) => division.sport))].map(
          (sport) => (
            <p key={sport} className="text-sm text-muted-foreground">
              {t(`pointsRule.${sport}`)} {t("tiebreakNote")}
            </p>
          ),
        )}
      {season && (
        <section className="space-y-3 rounded-2xl border bg-card p-5">
          <h2 className="font-display text-xl font-semibold">{t("share")}</h2>
          <ShareButtons
            url={`${getSiteUrl()}${path}?season=${season.id}`}
            text={t("shareText", { season: season.name })}
          />
        </section>
      )}
    </main>
  );
}
