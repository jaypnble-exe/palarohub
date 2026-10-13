import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { z } from "zod";
import { loadRegistration, rosterEligibility } from "@/lib/registration-data";
import { rosterEntrySchema } from "@/lib/validation/registration";
import { AccessDenied } from "@/components/access-denied";
import { Button } from "@/components/ui/button";
import { RegistrationDetails } from "@/components/registration/details";
import { ReviewForm } from "@/components/registration/review-form";
import { EligibilityFeedback } from "@/components/registration/feedback";
import { PageHeader } from "@/components/ui/page-header";
export default async function RegistrationReviewPage({
  params,
}: {
  params: Promise<{ league: string; registrationId: string }>;
}) {
  const { league: slug, registrationId } = await params;
  const data = await loadRegistration(slug, registrationId, "admin");
  if (data.denied) return <AccessDenied />;
  const t = await getTranslations("Registration");
  const roster = data.entries
    .filter((entry) => entry.active)
    .map((entry) => ({
      playerId: entry.player_id,
      jerseyNumber: entry.jersey_number,
    }));
  return (
    <main className="mx-auto max-w-2xl space-y-6 py-6">
      <PageHeader
        back={{
          href: `/admin/${slug}/registrations`,
          label: t("backRegistrations"),
        }}
        title={data.registration.team_name}
      />
      <RegistrationDetails data={data} />
      {data.registration.status === "submitted" && (
        <section className="space-y-4">
          <h2 className="font-display text-2xl font-semibold">
            {t("reviewTeam")}
          </h2>
          <EligibilityFeedback
            issues={rosterEligibility(
              roster,
              data.catalog,
              data.season,
              data.division,
              data.settings,
            )}
          />
          <ReviewForm slug={slug} registrationId={registrationId} />
        </section>
      )}
      {data.changes
        .filter((change) => change.status === "submitted")
        .map((change) => {
          const candidate = z.array(rosterEntrySchema).parse(change.roster);
          return (
            <section key={change.id} className="space-y-4">
              <h2 className="font-display text-2xl font-semibold">
                {t("reviewChange")}
              </h2>
              <p className="rounded-xl border bg-card p-4 text-sm">
                {change.reason}
              </p>
              <ul className="divide-y rounded-xl border bg-card">
                {candidate.map((entry) => (
                  <li key={entry.playerId} className="p-4 text-sm">
                    <p className="font-semibold">
                      {
                        data.catalog.find(
                          (player) => player.id === entry.playerId,
                        )?.name
                      }
                    </p>
                    <p>
                      {t("rosterPlayer", {
                        jersey: entry.jerseyNumber,
                        rating:
                          data.catalog.find(
                            (player) => player.id === entry.playerId,
                          )?.rating ?? t("unrated"),
                      })}
                    </p>
                  </li>
                ))}
              </ul>
              <EligibilityFeedback
                issues={rosterEligibility(
                  candidate,
                  data.catalog,
                  data.season,
                  data.division,
                  data.settings,
                )}
              />
              <ReviewForm
                slug={slug}
                registrationId={registrationId}
                changeRequestId={change.id}
              />
            </section>
          );
        })}
      {data.canManage && (
        <Button asChild variant="outline">
          <Link href={`/team/${slug}/registrations/${registrationId}`}>
            {t("managerWorkspace")}
          </Link>
        </Button>
      )}
    </main>
  );
}
