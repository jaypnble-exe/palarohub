import { notFound } from "next/navigation";
import { z } from "zod";
import { getTranslations } from "next-intl/server";
import { getLeagueAccess } from "@/lib/league-access";
import { divisionSchedule } from "@/lib/schedule-data";
import { toRiyadhDateTimeInput } from "@/lib/domain/riyadh-time";
import { AccessDenied } from "@/components/access-denied";
import { ScheduleWizard } from "@/components/schedule/schedule-wizard";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";

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
    <main className="mx-auto max-w-2xl space-y-6 py-6">
      <PageHeader
        back={{
          href: games.length
            ? `/admin/${slug}/schedule/${division.id}`
            : `/admin/${slug}/schedule`,
          label: t("back"),
        }}
        eyebrow={
          <>
            {season.name} · {division.name}
          </>
        }
        title={t(games.length ? "remakeSchedule" : "makeSchedule")}
      />
      {season.status !== "published" ? (
        <EmptyState title={t("seasonNotPublished")} />
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
