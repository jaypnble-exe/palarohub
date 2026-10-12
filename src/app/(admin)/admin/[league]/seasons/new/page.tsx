import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { getLeagueAccess } from "@/lib/league-access";
import { AccessDenied } from "@/components/access-denied";
import { SeasonWizard } from "@/components/admin/season-wizard";
import { Button } from "@/components/ui/button";
import { getSportModule } from "@/lib/sports/registry";
import { newDivision, type SeasonFormInput } from "@/lib/validation/seasons";
import { seasonFormValues } from "@/lib/season-data";

export default async function NewSeasonPage({
  params,
}: {
  params: Promise<{ league: string }>;
}) {
  const { league: slug } = await params;
  const { supabase, league, canManage } = await getLeagueAccess(slug);
  if (!canManage) return <AccessDenied />;
  const { data: scale, error } = await supabase
    .from("league_rating_scales")
    .select("labels")
    .eq("league_id", league.id)
    .single();
  if (error) throw new Error("Unable to load rating scale.");
  const { data: previous, error: previousError } = await supabase
    .from("seasons")
    .select("*,divisions(*)")
    .eq("league_id", league.id)
    .eq("status", "published")
    .order("start_date", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (previousError) throw new Error("Unable to load previous season.");
  const sportModule = getSportModule(league.sport);
  const initial: SeasonFormInput = {
    name: "",
    startDate: "",
    endDate: "",
    sport: sportModule.sport,
    rules: { ...sportModule.defaultRules },
    ratingScale: scale.labels,
    status: "draft",
    divisions: [newDivision(sportModule.sport, scale.labels)],
  };
  const t = await getTranslations("Seasons");
  return (
    <main className="mx-auto max-w-2xl space-y-6 py-8">
      <Button asChild variant="ghost">
        <Link href={`/admin/${slug}/seasons`}>{t("backToSeasons")}</Link>
      </Button>
      <h1 className="text-3xl font-bold">{t("create")}</h1>
      <SeasonWizard
        slug={slug}
        initial={initial}
        copyTemplate={
          previous ? seasonFormValues(previous, previous.divisions) : undefined
        }
      />
    </main>
  );
}
