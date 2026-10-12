import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { getLeagueAccess } from "@/lib/league-access";
import { AccessDenied } from "@/components/access-denied";
import { SeasonList } from "@/components/admin/season-list";
import { Button } from "@/components/ui/button";

export default async function SeasonsPage({
  params,
}: {
  params: Promise<{ league: string }>;
}) {
  const { league: slug } = await params;
  const { supabase, league, canView, canManage } = await getLeagueAccess(slug);
  if (!canView) return <AccessDenied />;
  const { data, error } = await supabase
    .from("seasons")
    .select("id,name,status,start_date,end_date,divisions(name,max_rating)")
    .eq("league_id", league.id)
    .order("start_date", { ascending: false });
  if (error) throw new Error("Unable to load seasons.");
  const t = await getTranslations("Seasons");
  return (
    <main className="space-y-6 py-8">
      <Button asChild variant="ghost">
        <Link href={`/admin/${slug}`}>{t("leagueHome")}</Link>
      </Button>
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">{league.name}</p>
        <h1 className="text-3xl font-bold">{t("title")}</h1>
      </div>
      <SeasonList slug={slug} seasons={data ?? []} canManage={canManage} />
      <Button variant="outline" asChild>
        <Link href={`/admin/${slug}/ratings`}>{t("ratingScale")}</Link>
      </Button>
    </main>
  );
}
