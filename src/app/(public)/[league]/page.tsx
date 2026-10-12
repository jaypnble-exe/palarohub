import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { hasSupabaseConfig } from "@/lib/supabase/env";
import { SeasonList } from "@/components/admin/season-list";
import { AnnouncementList } from "@/components/schedule/announcement-list";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default async function PublicLeaguePage({
  params,
}: {
  params: Promise<{ league: string }>;
}) {
  const { league: slug } = await params;
  if (!hasSupabaseConfig()) notFound();
  const supabase = await createClient();
  const { data: league, error } = await supabase
    .from("leagues")
    .select("id,name,sport")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw new Error("Unable to load league.");
  if (!league) notFound();
  const t = await getTranslations("PublicLeague");
  const sport = await getTranslations("Sports");
  const seasonText = await getTranslations("Seasons");
  const { data: seasons, error: seasonError } = await supabase
    .from("seasons")
    .select("id,name,status,start_date,end_date,divisions(id,name,max_rating)")
    .eq("league_id", league.id)
    .eq("status", "published")
    .order("start_date", { ascending: false });
  if (seasonError) throw new Error("Unable to load published seasons.");
  const registrationText = await getTranslations("Registration");
  const scheduleText = await getTranslations("Schedule");
  const [settings, teams, announcements] = await Promise.all([
    supabase
      .from("registration_settings")
      .select("season_id")
      .eq("league_id", league.id)
      .eq("is_open", true)
      .gt("deadline", new Date().toISOString()),
    supabase
      .from("published_season_teams")
      .select("id,team_name,division_name,season_id")
      .eq("league_id", league.id),
    supabase
      .from("announcements")
      .select("id,title,body,created_at,season_id,division_id")
      .eq("league_id", league.id)
      .order("created_at", { ascending: false })
      .limit(10),
  ]);
  if (settings.error || teams.error || announcements.error)
    throw new Error("Unable to load public league details.");
  // Signed-in members may also read draft-season posts; keep this page public-only.
  const divisionLabels = new Map(
    (seasons ?? []).flatMap((season) =>
      season.divisions.map((division) => [
        division.id,
        `${season.name} · ${division.name}`,
      ]),
    ),
  );
  const publicAnnouncements = announcements.data
    .filter((item) => !item.division_id || divisionLabels.has(item.division_id))
    .slice(0, 5)
    .map((item) => ({
      id: item.id,
      title: item.title,
      body: item.body,
      createdAt: item.created_at,
      audience: item.division_id
        ? (divisionLabels.get(item.division_id) ?? null)
        : null,
    }));
  return (
    <main className="space-y-5 py-12">
      <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
        {sport(league.sport)}
      </p>
      <h1 className="text-4xl font-bold tracking-tight">{league.name}</h1>
      <Button asChild>
        <Link href={`/${slug}/schedule`}>
          {scheduleText("viewPublicSchedule")}
        </Link>
      </Button>
      {settings.data?.map((setting) => (
        <Button key={setting.season_id} asChild variant="outline">
          <Link href={`/${slug}/register/${setting.season_id}`}>
            {registrationText("registerTeam")} ·{" "}
            {seasons?.find((season) => season.id === setting.season_id)?.name}
          </Link>
        </Button>
      ))}
      {publicAnnouncements.length > 0 && (
        <section className="space-y-4">
          <h2 className="font-display text-2xl font-semibold">
            {scheduleText("announcements")}
          </h2>
          <AnnouncementList announcements={publicAnnouncements} />
        </section>
      )}
      <section className="space-y-4">
        <h2 className="font-display text-2xl font-semibold">
          {registrationText("teams")}
        </h2>
        {teams.data?.length ? (
          <ul className="space-y-3">
            {teams.data.map((team) => (
              <li key={team.id} className="rounded-xl border bg-card p-4">
                <p className="font-semibold">{team.team_name}</p>
                <p className="text-sm text-muted-foreground">
                  {
                    seasons?.find((season) => season.id === team.season_id)
                      ?.name
                  }{" "}
                  · {team.division_name}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p>{registrationText("noTeams")}</p>
        )}
      </section>
      <section className="space-y-5 pt-4" aria-labelledby="seasons-heading">
        <h2
          id="seasons-heading"
          className="font-display text-2xl font-semibold"
        >
          {seasonText("title")}
        </h2>
        <SeasonList
          slug={slug}
          seasons={seasons ?? []}
          canManage={false}
          publicView
        />
      </section>
      <p className="max-w-lg text-lg leading-relaxed text-muted-foreground">
        {t("placeholder")}
      </p>
    </main>
  );
}
