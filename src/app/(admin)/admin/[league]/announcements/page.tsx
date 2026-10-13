import { getTranslations } from "next-intl/server";
import { getLeagueAccess } from "@/lib/league-access";
import { scheduleOverview } from "@/lib/schedule-data";
import { AccessDenied } from "@/components/access-denied";
import { AnnouncementList } from "@/components/schedule/announcement-list";
import {
  AnnouncementForm,
  DeleteAnnouncementButton,
} from "@/components/schedule/announcement-form";
import { PageHeader } from "@/components/ui/page-header";

export default async function AnnouncementsPage({
  params,
}: {
  params: Promise<{ league: string }>;
}) {
  const { league: slug } = await params;
  const { supabase, league, canView } = await getLeagueAccess(slug);
  if (!canView) return <AccessDenied />;
  const [divisions, announcements] = await Promise.all([
    scheduleOverview(supabase, league.id),
    supabase
      .from("announcements")
      .select("id,title,body,created_at,division_id")
      .eq("league_id", league.id)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);
  if (announcements.error) throw new Error("Unable to load announcements.");
  const t = await getTranslations("Announcements");
  const labels = new Map(
    divisions.map((division) => [
      division.id,
      `${division.seasonName} · ${division.name}`,
    ]),
  );
  return (
    <main className="mx-auto max-w-2xl space-y-6 py-6">
      <PageHeader title={t("heading")} description={t("intro")} />
      <AnnouncementForm
        slug={slug}
        divisions={divisions.map((division) => ({
          id: division.id,
          label: labels.get(division.id) ?? division.name,
        }))}
      />
      <section className="space-y-3">
        <h2 className="font-display text-2xl font-semibold">{t("recent")}</h2>
        <AnnouncementList
          announcements={announcements.data.map((item) => ({
            id: item.id,
            title: item.title,
            body: item.body,
            createdAt: item.created_at,
            audience: item.division_id
              ? (labels.get(item.division_id) ?? t("oneDivision"))
              : null,
          }))}
          actions={(item) => (
            <DeleteAnnouncementButton slug={slug} id={item.id} />
          )}
        />
      </section>
    </main>
  );
}
