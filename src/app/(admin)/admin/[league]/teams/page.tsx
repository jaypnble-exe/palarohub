import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";
import { getLeagueAccess } from "@/lib/league-access";
import { seasonPayments } from "@/lib/payments-data";
import {
  filterCounts,
  parseStatusFilter,
  sortTeamRows,
  statusFilters,
  statusGroup,
  statusTone,
  type RegistrationStatus,
} from "@/lib/teams-table";
import { AccessDenied } from "@/components/access-denied";
import { paymentBadge } from "@/components/payments/payment-summary";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cardVariants } from "@/components/ui/card";
import { ChipLinks } from "@/components/ui/chip";
import { DataTable } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";

interface TeamRow {
  id: string;
  teamName: string;
  manager: string;
  divisionName: string;
  status: RegistrationStatus;
  players: number;
  payment?: { tone: "danger" | "success" | "neutral"; text: string };
}

/** Every team registered in a season, as a table the commissioner can filter. */
export default async function TeamsPage({
  params,
  searchParams,
}: {
  params: Promise<{ league: string }>;
  searchParams: Promise<{ season?: string; status?: string }>;
}) {
  const { league: slug } = await params;
  const query = await searchParams;
  const { supabase, league, canView } = await getLeagueAccess(slug);
  if (!canView) return <AccessDenied />;
  const t = await getTranslations("Teams");
  const registration = await getTranslations("Registration");
  const paymentText = await getTranslations("Payments");
  const format = await getFormatter();

  const { data: seasons, error } = await supabase
    .from("seasons")
    .select("id,name")
    .eq("league_id", league.id)
    .eq("status", "published")
    .order("start_date", { ascending: false });
  if (error) throw new Error("Unable to load seasons.");
  const season = seasons.find((item) => item.id === query.season) ?? seasons[0];
  const filter = parseStatusFilter(query.status);

  const [registrations, rosters, teams, payments] = await Promise.all([
    season
      ? supabase
          .from("season_teams")
          .select(
            "id,team_id,team_name,status,divisions(name),teams(profiles(display_name))",
          )
          .eq("league_id", league.id)
          .eq("season_id", season.id)
      : Promise.resolve({ data: [], error: null }),
    season
      ? supabase
          .from("roster_entries")
          .select("registration_id")
          .eq("league_id", league.id)
          .eq("season_id", season.id)
          .eq("active", true)
      : Promise.resolve({ data: [], error: null }),
    supabase
      .from("teams")
      .select("id,name,profiles(display_name)")
      .eq("league_id", league.id)
      .order("name"),
    season ? seasonPayments(supabase, league.id, season.id) : [],
  ]);
  if (registrations.error || rosters.error || teams.error)
    throw new Error("Unable to load teams.");

  const players = new Map<string, number>();
  for (const entry of rosters.data ?? [])
    players.set(
      entry.registration_id,
      (players.get(entry.registration_id) ?? 0) + 1,
    );
  const paid = new Map(payments.map((team) => [team.seasonTeamId, team]));
  const all: TeamRow[] = sortTeamRows(
    (registrations.data ?? []).map((row) => {
      const payment = paid.get(row.id);
      return {
        id: row.id,
        teamName: row.team_name,
        manager: row.teams?.profiles?.display_name || t("noManager"),
        divisionName: row.divisions?.name ?? "",
        status: row.status as RegistrationStatus,
        players: players.get(row.id) ?? 0,
        payment: payment
          ? paymentBadge(payment.status, paymentText, format)
          : undefined,
      };
    }),
  );
  const counts = filterCounts(all);
  const rows =
    filter === "all"
      ? all
      : all.filter((row) => statusGroup(row.status) === filter);
  const inSeason = new Set(
    (registrations.data ?? []).map((row) => row.team_id),
  );
  const others = (teams.data ?? []).filter((team) => !inSeason.has(team.id));
  const href = (extra: { season?: string; status?: string }) => {
    const search = new URLSearchParams();
    const seasonId = extra.season ?? season?.id;
    if (seasonId) search.set("season", seasonId);
    const status = extra.status ?? filter;
    if (status !== "all") search.set("status", status);
    return `/admin/${slug}/teams?${search}`;
  };
  const status = (row: TeamRow) => (
    <Badge tone={statusTone[row.status]}>
      {registration(`status.${row.status}`)}
    </Badge>
  );

  return (
    <main className="space-y-6 py-6">
      <PageHeader
        eyebrow={season?.name}
        title={t("title")}
        description={
          season
            ? t("intro", { count: all.length, season: season.name })
            : undefined
        }
      />
      {seasons.length > 1 && (
        <ChipLinks
          label={t("seasonFilter")}
          links={seasons.map((item) => ({
            href: href({ season: item.id, status: "all" }),
            label: item.name,
            current: item.id === season?.id,
          }))}
        />
      )}
      {!season ? (
        <EmptyState icon="teams" title={t("noSeason")} />
      ) : !all.length ? (
        <EmptyState
          icon="teams"
          title={t("noTeams")}
          description={t("noTeamsHelp")}
        />
      ) : (
        <>
          <ChipLinks
            label={t("statusFilter")}
            links={statusFilters
              .filter(
                (item) => item === "all" || item === filter || counts[item] > 0,
              )
              .map((item) => ({
                href: href({ status: item }),
                label: t(`filter.${item}`, { count: counts[item] }),
                current: item === filter,
              }))}
          />
          {!rows.length ? (
            <EmptyState icon="teams" title={t("noneInFilter")} />
          ) : (
            <DataTable
              label={t("tableLabel", { season: season.name })}
              rows={rows}
              rowKey={(row) => row.id}
              rowHref={(row) => `/admin/${slug}/registrations/${row.id}`}
              rowLabel={(row) => t("openTeam", { team: row.teamName })}
              openLabel={t("open")}
              columns={[
                {
                  key: "team",
                  header: t("colTeam"),
                  cell: (row) => (
                    <span className="flex items-center gap-3">
                      <Avatar
                        name={row.teamName}
                        className="size-9 text-base"
                      />
                      <span className="min-w-0">
                        <span className="block font-semibold">
                          {row.teamName}
                        </span>
                        <span className="block text-muted-foreground">
                          {row.manager}
                        </span>
                      </span>
                    </span>
                  ),
                },
                {
                  key: "division",
                  header: t("colDivision"),
                  cell: (row) => row.divisionName,
                },
                {
                  key: "players",
                  header: t("colPlayers"),
                  align: "right",
                  cell: (row) => row.players,
                },
                { key: "status", header: t("colStatus"), cell: status },
                {
                  key: "payment",
                  header: t("colPayment"),
                  className: "hidden md:table-cell",
                  cell: (row) =>
                    row.payment ? (
                      <Badge tone={row.payment.tone}>{row.payment.text}</Badge>
                    ) : (
                      <span className="text-muted-foreground">–</span>
                    ),
                },
              ]}
              phone={(row) => ({
                title: row.teamName,
                subtitle: (
                  <>
                    {t("phoneLine", {
                      division: row.divisionName,
                      count: row.players,
                    })}
                    <span className="block truncate">{row.manager}</span>
                  </>
                ),
                trailing: (
                  <>
                    {status(row)}
                    {row.payment && row.payment.tone !== "neutral" && (
                      <Badge tone={row.payment.tone}>{row.payment.text}</Badge>
                    )}
                  </>
                ),
              })}
            />
          )}
        </>
      )}
      {others.length > 0 && (
        <details className={cardVariants()}>
          <summary className="min-h-11 cursor-pointer py-3 font-semibold">
            {t("otherTeams", { count: others.length })}
          </summary>
          <ul className="divide-y">
            {others.map((team) => (
              <li key={team.id} className="flex items-center gap-3 py-3">
                <Avatar name={team.name} className="size-9 text-base" />
                <span className="min-w-0">
                  <span className="block font-semibold">{team.name}</span>
                  <span className="block text-sm text-muted-foreground">
                    {team.profiles?.display_name || t("noManager")}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}
      <Button asChild variant="outline">
        <Link href={`/team/${slug}`}>{registration("teamWorkspace")}</Link>
      </Button>
    </main>
  );
}
