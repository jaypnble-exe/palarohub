import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { getTranslations } from "next-intl/server";
import { getLeagueAccess } from "@/lib/league-access";
import { divisionSchedule } from "@/lib/schedule-data";
import { toRiyadhDateTimeInput } from "@/lib/domain/riyadh-time";
import { AccessDenied } from "@/components/access-denied";
import { Button } from "@/components/ui/button";
import { ScheduleWizard } from "@/components/schedule/schedule-wizard";

export default async function NewSchedulePage({
  params,
}: {
  params: Promise<{ league: string; divisionId: string }>;
}) {
  const { league: slug, divisionId } = await params;
  if (!z.uuid().safeParse(divisionId).success) notFound();
  const { supabase, league, canView } = await getLeagueAccess(slug);
  if (!canView) return <AccessDenied />;
  const schedule = await divisionSchedule(supabase, league.id, divisionId);
  if (!schedule?.division.seasons) notFound();
  const { division, teams, games } = schedule;
  const season = division.seasons;
  const t = await getTranslations("Schedule");
  return (
    <main className="mx-auto max-w-2xl space-y-6 py-8">
      <Button asChild variant="ghost">
        <Link
          href={
            games.length
              ? `/admin/${slug}/schedule/${division.id}`
              : `/admin/${slug}/schedule`
          }
        >
          {t("back")}
        </Link>
      </Button>
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">
          {season.name} · {division.name}
        </p>
        <h1 className="font-display text-3xl font-semibold">
          {t(games.length ? "remakeSchedule" : "makeSchedule")}
        </h1>
      </div>
      {season.status !== "published" ? (
        <p className="rounded-2xl border bg-card p-5">
          {t("seasonNotPublished")}
        </p>
      ) : (
        <ScheduleWizard
          slug={slug}
          divisionId={division.id}
          teams={teams}
          seasonStart={season.start_date}
          seasonEnd={season.end_date}
          hasSchedule={games.length > 0}
          today={toRiyadhDateTimeInput(new Date().toISOString()).slice(0, 10)}
        />
      )}
    </main>
  );
}
