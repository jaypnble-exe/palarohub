import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { getLeagueAccess } from "@/lib/league-access";
import { AccessDenied } from "@/components/access-denied";
import { RatingScaleForm } from "@/components/admin/rating-scale-form";
import { Button } from "@/components/ui/button";

export default async function RatingsPage({
  params,
}: {
  params: Promise<{ league: string }>;
}) {
  const { league: slug } = await params;
  const { supabase, league, canView, canManage } = await getLeagueAccess(slug);
  if (!canView) return <AccessDenied />;
  const { data, error } = await supabase
    .from("league_rating_scales")
    .select("labels")
    .eq("league_id", league.id)
    .single();
  if (error) throw new Error("Unable to load rating scale.");
  const t = await getTranslations("Seasons");
  return (
    <main className="mx-auto max-w-xl space-y-6 py-8">
      <Button asChild variant="ghost">
        <Link href={`/admin/${slug}/seasons`}>{t("backToSeasons")}</Link>
      </Button>
      <h1 className="text-3xl font-bold">{t("ratingScale")}</h1>
      <RatingScaleForm slug={slug} labels={data.labels} canManage={canManage} />
    </main>
  );
}
