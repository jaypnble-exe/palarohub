import { getTranslations } from "next-intl/server";
import { loadRegistration } from "@/lib/registration-data";
import { AccessDenied } from "@/components/access-denied";
import { RegistrationDetails } from "@/components/registration/details";
import { RegistrationWizard } from "@/components/registration/wizard";
import { RosterChangeForm } from "@/components/registration/change-form";
import { TakeBackButton } from "@/components/registration/take-back-button";
import { seasonPayments } from "@/lib/payments-data";
import { PaymentSummary } from "@/components/payments/payment-summary";
import { LedgerList } from "@/components/payments/ledger-list";
import { cardVariants } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Alert } from "@/components/ui/alert";
import { Section } from "@/components/ui/section";
import { RegistrationStatus } from "@/components/team/registration-status";
import type { ManagerRegistration } from "@/lib/team-data";
export default async function ManagerRegistrationPage({
  params,
}: {
  params: Promise<{ league: string; registrationId: string }>;
}) {
  const { league: slug, registrationId } = await params;
  const data = await loadRegistration(slug, registrationId, "team");
  if (data.denied) return <AccessDenied />;
  const t = await getTranslations("Registration");
  const roster = data.entries
    .filter((entry) => entry.active)
    .map((entry) => ({
      playerId: entry.player_id,
      jerseyNumber: entry.jersey_number,
    }));
  const registrationOpen =
    data.settings.is_open &&
    new Date(data.settings.deadline).getTime() > new Date().getTime();
  const returned = data.registration.status === "returned";
  // A roster the commissioner sent back stays editable after the deadline.
  const editable =
    returned || (data.registration.status === "draft" && registrationOpen);
  const canTakeBack =
    data.registration.status === "submitted" && registrationOpen;
  const [{ data: divisions, error }, others] = await Promise.all([
    data.supabase
      .from("divisions")
      .select("*")
      .eq("league_id", data.league.id)
      .eq("season_id", data.season.id)
      .order("name"),
    // The team's other divisions this season, which this draft cannot move into.
    data.supabase
      .from("season_teams")
      .select("division_id")
      .eq("league_id", data.league.id)
      .eq("season_id", data.season.id)
      .eq("team_id", data.team.id)
      .neq("id", registrationId),
  ]);
  if (error || others.error) throw new Error("Unable to load divisions.");
  const [payments] =
    data.registration.status === "approved"
      ? await seasonPayments(
          data.supabase,
          data.league.id,
          data.season.id,
          registrationId,
        )
      : [];
  const paymentText = await getTranslations("Payments");
  const pendingChange = data.changes.find(
    (change) => change.status === "submitted",
  );
  return (
    <main className="mx-auto max-w-2xl space-y-6 py-6">
      <PageHeader
        back={{ href: `/team/${slug}`, label: t("teamHome") }}
        eyebrow={`${data.season.name} · ${data.division.name}`}
        title={data.registration.team_name}
      />
      <RegistrationStatus
        status={data.registration.status as ManagerRegistration["status"]}
        seasonName={data.season.name}
        comment={data.registration.review_comment}
      />
      <RegistrationDetails data={data} showStatus={false} />
      {payments && (
        <Section id="payments" title={paymentText("teamTitle")}>
          <PaymentSummary team={payments} />
          <LedgerList slug={slug} entries={payments.entries} canEdit={false} />
        </Section>
      )}
      {editable ? (
        <section className="space-y-5">
          <h2 className="font-display text-2xl font-semibold">
            {t("editRegistration")}
          </h2>
          {returned && !registrationOpen && (
            <Alert tone="info">{t("returnedAfterDeadline")}</Alert>
          )}
          <RegistrationWizard
            slug={slug}
            registrationId={registrationId}
            initial={{
              teamId: data.team.id,
              seasonId: data.season.id,
              divisionId: data.division.id,
              roster,
            }}
            teams={[data.team]}
            divisions={divisions ?? []}
            taken={others.data.map((row) => ({
              teamId: data.team.id,
              divisionId: row.division_id,
            }))}
            catalog={data.playerCatalog}
            ratingScale={data.season.rating_scale}
            deadline={data.settings.deadline}
            feeHalalas={data.registration.fee_halalas}
            requireDocuments={data.settings.require_documents}
          />
        </section>
      ) : data.registration.status === "approved" ? (
        <section className="space-y-5">
          <h2 className="font-display text-2xl font-semibold">
            {t("rosterChanges")}
          </h2>
          {pendingChange ? (
            <Alert tone="info">{t("changeWaiting")}</Alert>
          ) : (
            <details className={cardVariants()}>
              <summary className="min-h-11 cursor-pointer py-3 font-semibold">
                {t("requestChange")}
              </summary>
              <RosterChangeForm
                slug={slug}
                registrationId={registrationId}
                initial={roster}
                catalog={data.catalog}
                rules={{
                  ratingScale: data.season.rating_scale,
                  maximumRating: data.division.max_rating,
                  rosterMin: data.division.roster_min,
                  rosterMax: data.division.roster_max,
                  requireDocuments: data.settings.require_documents,
                }}
              />
            </details>
          )}
        </section>
      ) : canTakeBack ? (
        <TakeBackButton slug={slug} registrationId={registrationId} />
      ) : (
        data.registration.status !== "submitted" && (
          <Alert tone="info">{t("registrationLocked")}</Alert>
        )
      )}
      {data.changes
        .filter((change) => change.status !== "submitted")
        .map((change) => (
          <div
            key={change.id}
            className={`${cardVariants()} space-y-2 text-sm`}
          >
            <p className="font-semibold">
              {t(`changeStatus.${change.status}`)}
            </p>
            <p>{change.reason}</p>
            {change.review_comment && <p>{change.review_comment}</p>}
          </div>
        ))}
    </main>
  );
}
