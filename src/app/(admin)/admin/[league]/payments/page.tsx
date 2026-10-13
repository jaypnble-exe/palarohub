import { getFormatter, getTranslations } from "next-intl/server";
import { getLeagueAccess } from "@/lib/league-access";
import { seasonPayments } from "@/lib/payments-data";
import { parsePaymentPolicy } from "@/lib/domain/payments";
import { formatSar } from "@/lib/format";
import { AccessDenied } from "@/components/access-denied";
import { ChipLinks } from "@/components/ui/chip";
import { EmptyState } from "@/components/ui/empty-state";
import { LinkCard } from "@/components/ui/link-card";
import { PageHeader } from "@/components/ui/page-header";
import { Section } from "@/components/ui/section";
import { StatTile } from "@/components/ui/stat";
import { PolicyForm } from "@/components/payments/policy-form";
import { PaymentBadge } from "@/components/payments/payment-summary";

export default async function PaymentsPage({
  params,
  searchParams,
}: {
  params: Promise<{ league: string }>;
  searchParams: Promise<{ season?: string }>;
}) {
  const { league: slug } = await params;
  const query = await searchParams;
  const { supabase, league, canView, canManage } = await getLeagueAccess(slug);
  if (!canView) return <AccessDenied />;
  const { data: seasons, error } = await supabase
    .from("seasons")
    .select("id,name")
    .eq("league_id", league.id)
    .eq("status", "published")
    .order("start_date", { ascending: false });
  if (error) throw new Error("Unable to load seasons.");
  const season = seasons.find((item) => item.id === query.season) ?? seasons[0];
  const teams = season
    ? (await seasonPayments(supabase, league.id, season.id)).sort(
        (a, b) =>
          b.status.behindByHalalas - a.status.behindByHalalas ||
          a.teamName.localeCompare(b.teamName),
      )
    : [];
  const t = await getTranslations("Payments");
  const format = await getFormatter();
  const sar = (halalas: number) => formatSar(format, halalas);
  const behind = teams.filter((team) => team.status.behind);
  const collected = teams.reduce((sum, team) => sum + team.paidHalalas, 0);
  const expected = teams.reduce(
    (sum, team) => sum + team.quotaHalalas + team.finesHalalas,
    0,
  );
  return (
    <main className="mx-auto max-w-2xl space-y-6 py-6">
      <PageHeader title={t("title")} eyebrow={season?.name} />
      {seasons.length > 1 && (
        <ChipLinks
          label={t("chooseSeason")}
          links={seasons.map((item) => ({
            href: `/admin/${slug}/payments?season=${item.id}`,
            label: item.name,
            current: item.id === season?.id,
          }))}
        />
      )}
      {season && teams.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2">
          <StatTile
            label={t("collected")}
            value={sar(collected)}
            detail={t("collectedOf", { total: sar(expected) })}
            progress={{ value: collected, max: expected }}
          />
          <StatTile
            label={t("behindTitle")}
            value={behind.length}
            detail={t("behindCount", { count: behind.length })}
          />
        </div>
      )}
      <Section id="teams" title={t("teamsTitle")}>
        {!teams.length ? (
          <EmptyState
            icon="teams"
            title={t("noTeams")}
            description={t("noTeamsHelp")}
          />
        ) : (
          <ul className="space-y-3">
            {teams.map((team) => (
              <li key={team.seasonTeamId}>
                <LinkCard
                  href={`/admin/${slug}/payments/${team.seasonTeamId}`}
                  title={team.teamName}
                  subtitle={`${team.divisionName} · ${t("paidOf", {
                    paid: sar(team.paidHalalas),
                    total: sar(team.quotaHalalas + team.finesHalalas),
                  })}`}
                  trailing={<PaymentBadge status={team.status} />}
                />
              </li>
            ))}
          </ul>
        )}
      </Section>
      {canManage && (
        <PolicyForm slug={slug} initial={parsePaymentPolicy(league.settings)} />
      )}
    </main>
  );
}
