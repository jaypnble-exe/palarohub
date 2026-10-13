import { getTranslations } from "next-intl/server";
import { getLeagueAccess } from "@/lib/league-access";
import { managerOverview } from "@/lib/team-data";
import { AccessDenied } from "@/components/access-denied";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { Section } from "@/components/ui/section";
import { PaymentSummary } from "@/components/payments/payment-summary";
import { LedgerList } from "@/components/payments/ledger-list";

/** What each approved team owes and has paid. Only the league records payments. */
export default async function TeamPaymentsPage({
  params,
}: {
  params: Promise<{ league: string }>;
}) {
  const { league: slug } = await params;
  const { supabase, user, league, canRegister } = await getLeagueAccess(
    slug,
    "team",
  );
  if (!canRegister) return <AccessDenied />;
  const { payments } = await managerOverview(supabase, league.id, user.id);
  const t = await getTranslations("TeamHome");
  return (
    <main className="space-y-6 py-6">
      <PageHeader
        eyebrow={league.name}
        title={t("paymentsTitle")}
        description={t("paymentsHelp")}
      />
      {!payments.length ? (
        <EmptyState icon="payments" title={t("noPayments")} />
      ) : (
        payments.map((team) => (
          <Section
            key={team.seasonTeamId}
            id={`team-${team.seasonTeamId}`}
            title={team.teamName}
            description={team.divisionName}
          >
            <PaymentSummary team={team} />
            <LedgerList slug={slug} entries={team.entries} canEdit={false} />
          </Section>
        ))
      )}
    </main>
  );
}
