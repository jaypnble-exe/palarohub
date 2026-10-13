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
import { EmptyState } from "@/components/ui/empty-state";
import { cardVariants } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { ChipLinks } from "@/components/ui/chip";
import { PageHeader } from "@/components/ui/page-header";

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
  return (
    <main className="space-y-6 py-6">
      <PageHeader
        back={{ href: `/${slug}`, label: league.name }}
        eyebrow={season?.name}
        title={t("title")}
        actions={
          <Button asChild variant="outline">
            <Link
              href={`/${slug}/schedule${season ? `?season=${season.id}` : ""}`}
            >
              {t("schedule")}
            </Link>
          </Button>
        }
      />
      {seasons.length > 1 && (
        <ChipLinks
          label={t("chooseSeason")}
          links={seasons.map((item) => ({
            href: `${path}?season=${item.id}`,
            label: item.name,
            current: item.id === season?.id,
          }))}
        />
      )}
      {standings.length ? (
        standings.map((division) => (
          <StandingsTable key={division.divisionId} standings={division} />
        ))
      ) : (
        <EmptyState title={t("noSeason")} />
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
        <section className={cn(cardVariants(), "space-y-3")}>
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
