import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { loadRegistration } from "@/lib/registration-data";
import { AccessDenied } from "@/components/access-denied";
import { Button } from "@/components/ui/button";
import { RegistrationDetails } from "@/components/registration/details";
import { RegistrationWizard } from "@/components/registration/wizard";
import { RosterChangeForm } from "@/components/registration/change-form";
import { seasonPayments } from "@/lib/payments-data";
import { PaymentSummary } from "@/components/payments/payment-summary";
import { LedgerList } from "@/components/payments/ledger-list";
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
  const editable =
    ["draft", "returned"].includes(data.registration.status) &&
    data.settings.is_open &&
    new Date(data.settings.deadline).getTime() > new Date().getTime();
  const { data: divisions, error } = await data.supabase
    .from("divisions")
    .select("*")
    .eq("league_id", data.league.id)
    .eq("season_id", data.season.id)
    .order("name");
  if (error) throw new Error("Unable to load divisions.");
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
    <main className="mx-auto max-w-2xl space-y-6 py-8">
      <Button asChild variant="ghost">
        <Link href={`/team/${slug}`}>{t("teamHome")}</Link>
      </Button>
      <h1 className="font-display text-3xl font-semibold">
        {data.registration.team_name}
      </h1>
      <RegistrationDetails data={data} />
      {payments && (
        <section className="space-y-3">
          <h2 className="font-display text-2xl font-semibold">
            {paymentText("teamTitle")}
          </h2>
          <PaymentSummary team={payments} />
          <LedgerList slug={slug} entries={payments.entries} canEdit={false} />
        </section>
      )}
      {editable ? (
        <section className="space-y-5">
          <h2 className="font-display text-2xl font-semibold">
            {t("editRegistration")}
          </h2>
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
            catalog={data.catalog}
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
            <p className="rounded-xl border bg-card p-4">
              {t("changeWaiting")}
            </p>
          ) : (
            <details className="rounded-2xl border bg-card p-5">
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
      ) : (
        <p className="rounded-xl border bg-card p-4 text-sm">
          {t(
            data.registration.status === "submitted"
              ? "awaitingReview"
              : "registrationLocked",
          )}
        </p>
      )}
      {data.changes
        .filter((change) => change.status !== "submitted")
        .map((change) => (
          <div
            key={change.id}
            className="space-y-2 rounded-xl border bg-card p-4 text-sm"
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
