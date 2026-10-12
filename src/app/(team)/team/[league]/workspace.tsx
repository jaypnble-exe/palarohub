import Link from "next/link";
import { getTranslations, getFormatter } from "next-intl/server";
import { getLeagueAccess } from "@/lib/league-access";
import { AccessDenied } from "@/components/access-denied";
import { Button } from "@/components/ui/button";
import { RegistrationList } from "@/components/registration/list";
export default async function TeamHome({
  params,
}: {
  params: Promise<{ league: string }>;
}) {
  const { league: slug } = await params;
  const { supabase, user, league, canRegister, canView } =
    await getLeagueAccess(slug, "team");
  if (!canRegister) return <AccessDenied />;
  const t = await getTranslations("Registration");
  const format = await getFormatter();
  const [teams, settings] = await Promise.all([
    supabase
      .from("teams")
      .select("id,name")
      .eq("league_id", league.id)
      .eq("manager_id", user.id),
    supabase
      .from("registration_settings")
      .select("season_id,deadline,fee_halalas,seasons!inner(name,status)")
      .eq("league_id", league.id)
      .eq("is_open", true)
      .eq("seasons.status", "published")
      .gt("deadline", new Date().toISOString())
      .order("deadline"),
  ]);
  if (teams.error || settings.error)
    throw new Error("Unable to load team workspace.");
  const registrations = teams.data?.length
    ? await supabase
        .from("season_teams")
        .select("id,team_name,status,created_at,seasons(name),divisions(name)")
        .eq("league_id", league.id)
        .in(
          "team_id",
          teams.data.map((team) => team.id),
        )
        .order("created_at", { ascending: false })
    : { data: [], error: null };
  if (registrations.error)
    throw new Error("Unable to load your registrations.");
  return (
    <main className="space-y-6 py-8">
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">{league.name}</p>
        <h1 className="font-display text-3xl font-semibold">
          {t("teamWorkspace")}
        </h1>
      </div>
      <section className="space-y-4">
        <h2 className="font-display text-2xl font-semibold">
          {t("openSeasons")}
        </h2>
        {!settings.data?.length ? (
          <p className="rounded-2xl border bg-card p-5">{t("noOpenSeasons")}</p>
        ) : (
          settings.data.map((setting, index) => (
            <div
              key={setting.season_id}
              className="space-y-3 rounded-2xl border bg-card p-5"
            >
              <h3 className="text-xl font-semibold">{setting.seasons.name}</h3>
              <p className="text-sm text-muted-foreground">
                {t("deadlineValue", {
                  date: format.dateTime(new Date(setting.deadline), {
                    dateStyle: "medium",
                    timeStyle: "short",
                  }),
                })}
              </p>
              <Button asChild variant={index === 0 ? "default" : "outline"}>
                <Link href={`/team/${slug}/register/${setting.season_id}`}>
                  {t("registerTeam")}
                </Link>
              </Button>
            </div>
          ))
        )}
      </section>
      <section className="space-y-4">
        <h2 className="font-display text-2xl font-semibold">
          {t("myRegistrations")}
        </h2>
        <RegistrationList
          slug={slug}
          workspace="team"
          registrations={registrations.data ?? []}
        />
      </section>
      {canView && (
        <Button asChild variant="outline">
          <Link href={`/admin/${slug}`}>{t("leagueHome")}</Link>
        </Button>
      )}
    </main>
  );
}
