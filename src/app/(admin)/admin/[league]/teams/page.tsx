import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { getLeagueAccess } from "@/lib/league-access";
import { AccessDenied } from "@/components/access-denied";
import { Button } from "@/components/ui/button";
export default async function TeamsPage({
  params,
}: {
  params: Promise<{ league: string }>;
}) {
  const { league: slug } = await params;
  const { supabase, league, canView } = await getLeagueAccess(slug);
  if (!canView) return <AccessDenied />;
  const t = await getTranslations("Registration");
  const { data: teams, error } = await supabase
    .from("teams")
    .select(
      "id,name,profiles(display_name),season_teams(id,status,team_name,seasons(name))",
    )
    .eq("league_id", league.id)
    .order("name");
  if (error) throw new Error("Unable to load teams.");
  return (
    <main className="space-y-6 py-8">
      <h1 className="font-display text-3xl font-semibold">{t("teams")}</h1>
      {!teams?.length ? (
        <p className="rounded-2xl border bg-card p-5">{t("noTeams")}</p>
      ) : (
        <ul className="space-y-4">
          {teams.map((team) => (
            <li
              key={team.id}
              className="space-y-4 rounded-2xl border bg-card p-5"
            >
              <h2 className="font-display text-2xl font-semibold">
                {team.name}
              </h2>
              <p className="text-sm text-muted-foreground">
                {t("managerName", {
                  name: team.profiles?.display_name || t("leagueMember"),
                })}
              </p>
              <ul className="space-y-3">
                {team.season_teams.map((registration) => (
                  <li key={registration.id} className="space-y-2 border-t pt-3">
                    <p className="text-sm">{registration.seasons?.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {t(`status.${registration.status}`)}
                    </p>
                    <Button asChild variant="outline">
                      <Link
                        href={`/admin/${slug}/registrations/${registration.id}`}
                      >
                        {t("viewRegistration")}
                      </Link>
                    </Button>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
      <Button asChild variant="outline">
        <Link href={`/team/${slug}`}>{t("teamWorkspace")}</Link>
      </Button>
    </main>
  );
}
