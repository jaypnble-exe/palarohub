import { getTranslations } from "next-intl/server";
import { getLeagueAccess } from "@/lib/league-access";
import { seasonPayments } from "@/lib/payments-data";
import { parsePaymentPolicy } from "@/lib/domain/payments";
import { AccessDenied } from "@/components/access-denied";
import { ChipLinks } from "@/components/ui/chip";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { PolicyForm } from "@/components/payments/policy-form";
import {
  PaymentsBoard,
  paymentFilters,
  type PaymentFilter,
} from "@/components/payments/payments-board";

export default async function PaymentsPage({
  params,
  searchParams,
}: {
  params: Promise<{ league: string }>;
  searchParams: Promise<{ season?: string; show?: string; division?: string }>;
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
    ? (await seasonPayments(supabase, league.id, season.id)).sort((a, b) =>
        a.teamName.localeCompare(b.teamName),
      )
    : [];
  const t = await getTranslations("Payments");
  const filter: PaymentFilter =
    paymentFilters.find((item) => item === query.show) ?? "all";
  const division =
    teams.find((team) => team.divisionName === query.division)?.divisionName ??
    null;
  const link = (changes: {
    filter?: PaymentFilter;
    division?: string | null;
  }) => {
    const search = new URLSearchParams();
    if (season && season.id !== seasons[0]?.id) search.set("season", season.id);
    const nextFilter = changes.filter ?? filter;
    if (nextFilter !== "all") search.set("show", nextFilter);
    const nextDivision =
      changes.division === undefined ? division : changes.division;
    if (nextDivision) search.set("division", nextDivision);
    const text = search.toString();
    return `/admin/${slug}/payments${text ? `?${text}` : ""}`;
  };
  const policy = parsePaymentPolicy(league.settings);
  return (
    <main className="mx-auto max-w-4xl space-y-6 py-6">
      <PageHeader
        title={t("title")}
        eyebrow={season?.name}
        description={t("intro")}
      />
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
      {season ? (
        <PaymentsBoard
          slug={slug}
          teams={teams}
          filter={filter}
          division={division}
          link={link}
        />
      ) : (
        <EmptyState
          icon="payments"
          title={t("noTeams")}
          description={t("noTeamsHelp")}
        />
      )}
      {canManage && (
        <details className="group rounded-2xl border bg-card">
          <summary className="flex min-h-14 cursor-pointer items-center justify-between gap-3 px-5 py-3 font-semibold">
            {t("policyShort", { rule: t(`policy.${policy}`) })}
          </summary>
          <div className="px-2 pb-2">
            <PolicyForm slug={slug} initial={policy} />
          </div>
        </details>
      )}
    </main>
  );
}
