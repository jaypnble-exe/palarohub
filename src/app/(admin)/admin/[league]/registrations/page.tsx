import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { getLeagueAccess } from "@/lib/league-access";
import { AccessDenied } from "@/components/access-denied";
import { Button } from "@/components/ui/button";
import { RegistrationList } from "@/components/registration/list";
import { cardVariants } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/ui/page-header";
export default async function RegistrationInbox({
  params,
}: {
  params: Promise<{ league: string }>;
}) {
  const { league: slug } = await params;
  const { supabase, league, canView } = await getLeagueAccess(slug);
  if (!canView) return <AccessDenied />;
  const t = await getTranslations("Registration");
  const [registrations, changes] = await Promise.all([
    supabase
      .from("season_teams")
      .select("id,team_name,status,created_at,seasons(name),divisions(name)")
      .eq("league_id", league.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("roster_change_requests")
      .select("id,registration_id,reason,season_teams(team_name)")
      .eq("league_id", league.id)
      .eq("status", "submitted")
      .order("created_at"),
  ]);
  if (registrations.error || changes.error)
    throw new Error("Unable to load registration inbox.");
  return (
    <main className="space-y-6 py-6">
      <PageHeader title={t("registrations")} />
      <section className="space-y-4">
        <h2 className="font-display text-2xl font-semibold">
          {t("teamsWaiting")}
        </h2>
        <RegistrationList
          slug={slug}
          workspace="admin"
          registrations={
            registrations.data?.filter((item) => item.status === "submitted") ??
            []
          }
        />
      </section>
      {!!changes.data?.length && (
        <section className="space-y-4">
          <h2 className="font-display text-2xl font-semibold">
            {t("changesWaiting")}
          </h2>
          <ul className="space-y-3">
            {changes.data.map((change) => (
              <li key={change.id} className={cn(cardVariants(), "space-y-3")}>
                <p className="font-semibold">
                  {change.season_teams?.team_name}
                </p>
                <p className="text-sm text-muted-foreground">{change.reason}</p>
                <Button asChild variant="outline">
                  <Link
                    href={`/admin/${slug}/registrations/${change.registration_id}`}
                  >
                    {t("reviewChange")}
                  </Link>
                </Button>
              </li>
            ))}
          </ul>
        </section>
      )}
      <section className="space-y-4">
        <h2 className="font-display text-2xl font-semibold">
          {t("otherRegistrations")}
        </h2>
        <RegistrationList
          slug={slug}
          workspace="admin"
          registrations={
            registrations.data?.filter((item) => item.status !== "submitted") ??
            []
          }
        />
      </section>
    </main>
  );
}
