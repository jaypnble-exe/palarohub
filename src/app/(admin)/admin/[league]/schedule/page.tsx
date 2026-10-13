import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { getLeagueAccess } from "@/lib/league-access";
import { scheduleOverview } from "@/lib/schedule-data";
import { AccessDenied } from "@/components/access-denied";
import { Button } from "@/components/ui/button";

export default async function ScheduleHome({
  params,
}: {
  params: Promise<{ league: string }>;
}) {
  const { league: slug } = await params;
  const { supabase, league, canView } = await getLeagueAccess(slug);
  if (!canView) return <AccessDenied />;
  const divisions = await scheduleOverview(supabase, league.id);
  const t = await getTranslations("Schedule");
  const seasons = [...new Set(divisions.map((division) => division.seasonId))];
  return (
    <main className="mx-auto max-w-2xl space-y-6 py-8">
      <div className="space-y-2">
        <h1 className="font-display text-3xl font-semibold">{t("title")}</h1>
        <p className="text-muted-foreground">{t("intro")}</p>
      </div>
      <div className="flex flex-wrap gap-3">
        <Button asChild variant="outline">
          <Link href={`/${slug}/schedule`}>{t("publicSchedule")}</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href={`/admin/${slug}/announcements`}>
            {t("announcements")}
          </Link>
        </Button>
      </div>
      {!seasons.length && (
        <p className="rounded-2xl border bg-card p-5">{t("noSeasons")}</p>
      )}
      {seasons.map((seasonId) => {
        const seasonDivisions = divisions.filter(
          (division) => division.seasonId === seasonId,
        );
        return (
          <section key={seasonId} className="space-y-3">
            <h2 className="text-2xl font-semibold">
              {seasonDivisions[0]?.seasonName}
            </h2>
            <ul className="space-y-3">
              {seasonDivisions.map((division) => (
                <li
                  key={division.id}
                  className="space-y-3 rounded-2xl border bg-card p-5"
                >
                  <div className="space-y-1">
                    <h3 className="text-xl font-semibold">{division.name}</h3>
                    <p className="text-sm text-muted-foreground">
                      {t("teamCount", { count: division.teamCount })}
                      {" · "}
                      {t("gameCount", { count: division.gameCount })}
                    </p>
                  </div>
                  {division.gameCount ? (
                    <Button asChild variant="outline">
                      <Link href={`/admin/${slug}/schedule/${division.id}`}>
                        {t("viewSchedule")}
                      </Link>
                    </Button>
                  ) : division.teamCount >= 2 ? (
                    <Button asChild>
                      <Link href={`/admin/${slug}/schedule/${division.id}/new`}>
                        {t("makeSchedule")}
                      </Link>
                    </Button>
                  ) : (
                    <p className="text-sm">{t("needTwoTeams")}</p>
                  )}
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </main>
  );
}
