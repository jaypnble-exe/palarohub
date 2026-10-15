import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { getLeagueAccess } from "@/lib/league-access";
import { bracketData } from "@/lib/competition-data";
import { seasonStandings } from "@/lib/standings-data";
import { AccessDenied } from "@/components/access-denied";
import { BracketBoard } from "@/components/public/bracket-board";
import { BracketSetup } from "@/components/admin/bracket-setup";
import { PageHeader } from "@/components/ui/page-header";
import { ChipLinks } from "@/components/ui/chip";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";

export default async function AdminBracketsPage({
  params,
  searchParams,
}: {
  params: Promise<{ league: string }>;
  searchParams: Promise<{ division?: string }>;
}) {
  const { league: slug } = await params;
  const query = await searchParams;
  const { supabase, league, canView, canManage } = await getLeagueAccess(slug);
  if (!canView) return <AccessDenied />;
  const t = await getTranslations("Competition");
  const { data: seasons, error } = await supabase
    .from("seasons")
    .select("id,name,divisions(id,name,sport)")
    .eq("league_id", league.id)
    .eq("status", "published")
    .order("start_date", { ascending: false });
  if (error) throw new Error("Unable to load playoff divisions.");
  const divisions = seasons.flatMap((season) =>
    season.divisions.map((division) => ({
      ...division,
      seasonId: season.id,
      seasonName: season.name,
    })),
  );
  const division =
    divisions.find((d) => d.id === query.division) ?? divisions[0];
  const [data, standings] = division
    ? await Promise.all([
        bracketData(supabase, league.id, division.seasonId),
        seasonStandings(supabase, league.id, division.seasonId, [division]),
      ])
    : [undefined, []];
  const bracket = data?.brackets.find((b) => b.division_id === division?.id);
  const rows = standings[0]?.rows ?? [];
  return (
    <main className="min-w-0 space-y-6 py-6">
      <PageHeader
        back={{ href: `/admin/${slug}/more`, label: t("backAdmin") }}
        eyebrow={division?.seasonName}
        title={t("manageBrackets")}
        description={t("adminBracketIntro")}
        actions={
          <Button asChild variant="outline">
            <Link
              href={`/${slug}/brackets${division ? `?season=${division.seasonId}` : ""}`}
            >
              {t("publicBrackets")}
            </Link>
          </Button>
        }
      />
      {divisions.length > 0 && (
        <ChipLinks
          label={t("chooseDivision")}
          links={divisions.map((d) => ({
            href: `/admin/${slug}/brackets?division=${d.id}`,
            label: `${d.seasonName} · ${d.name}`,
            current: d.id === division?.id,
          }))}
        />
      )}
      {division && data ? (
        bracket ? (
          <BracketBoard
            slug={slug}
            admin
            divisions={[division]}
            data={{ ...data, brackets: [bracket] }}
          />
        ) : canManage ? (
          <BracketSetup
            key={division.id}
            slug={slug}
            divisionId={division.id}
            teams={rows.map((row) => ({ id: row.teamId, name: row.name }))}
            tiedSeeds={rows.some((row) => row.tied)}
            pendingGames={
              data.games.filter(
                (game) =>
                  game.division_id === division.id &&
                  !game.bracket_slot_id &&
                  !["approved", "cancelled"].includes(game.status ?? ""),
              ).length
            }
          />
        ) : (
          <EmptyState title={t("commissionerCreates")} />
        )
      ) : (
        <EmptyState title={t("noSeason")} />
      )}
    </main>
  );
}
