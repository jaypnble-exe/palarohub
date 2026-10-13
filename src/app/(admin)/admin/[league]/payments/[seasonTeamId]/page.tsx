import { notFound } from "next/navigation";
import { z } from "zod";
import { getTranslations } from "next-intl/server";
import { getLeagueAccess } from "@/lib/league-access";
import { seasonPayments } from "@/lib/payments-data";
import { toRiyadhDateTimeInput } from "@/lib/domain/riyadh-time";
import { AccessDenied } from "@/components/access-denied";
import { PageHeader } from "@/components/ui/page-header";
import { Section } from "@/components/ui/section";
import { PaymentSummary } from "@/components/payments/payment-summary";
import { LedgerForm } from "@/components/payments/ledger-form";
import { LedgerList } from "@/components/payments/ledger-list";

export default async function TeamPaymentsPage({
  params,
}: {
  params: Promise<{ league: string; seasonTeamId: string }>;
}) {
  const { league: slug, seasonTeamId } = await params;
  if (!z.uuid().safeParse(seasonTeamId).success) notFound();
  const { supabase, league, canView } = await getLeagueAccess(slug);
  if (!canView) return <AccessDenied />;
  const { data: registration, error } = await supabase
    .from("season_teams")
    .select("season_id")
    .eq("league_id", league.id)
    .eq("id", seasonTeamId)
    .maybeSingle();
  if (error) throw new Error("Unable to load the team.");
  if (!registration) notFound();
  const [team] = await seasonPayments(
    supabase,
    league.id,
    registration.season_id,
    seasonTeamId,
  );
  if (!team) notFound();
  const t = await getTranslations("Payments");
  const today = toRiyadhDateTimeInput(new Date().toISOString()).slice(0, 10);
  return (
    <main className="mx-auto max-w-2xl space-y-6 py-6">
      <PageHeader
        back={{
          href: `/admin/${slug}/payments?season=${registration.season_id}`,
          label: t("backToPayments"),
        }}
        eyebrow={team.divisionName}
        title={team.teamName}
      />
      <PaymentSummary team={team} />
      <LedgerForm
        slug={slug}
        seasonTeamId={team.seasonTeamId}
        today={today}
        suggestedHalalas={team.status.behindByHalalas}
      />
      <Section id="history" title={t("history")}>
        <LedgerList slug={slug} entries={team.entries} canEdit />
      </Section>
    </main>
  );
}
