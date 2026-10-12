import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { getTranslations } from "next-intl/server";
import { getLeagueAccess } from "@/lib/league-access";
import { parsePlayerCatalog } from "@/lib/registration-data";
import { AccessDenied } from "@/components/access-denied";
import { Button } from "@/components/ui/button";
import { NameForm } from "@/components/registration/name-form";
import { RegistrationWizard } from "@/components/registration/wizard";
export default async function NewRegistrationPage({
  params,
}: {
  params: Promise<{ league: string; seasonId: string }>;
}) {
  const { league: slug, seasonId } = await params;
  if (!z.uuid().safeParse(seasonId).success) notFound();
  const { supabase, league, user, canRegister } = await getLeagueAccess(
    slug,
    "team",
  );
  if (!canRegister) return <AccessDenied />;
  const t = await getTranslations("Registration");
  const [season, settings, divisions, teams, existing, catalog] =
    await Promise.all([
      supabase
        .from("seasons")
        .select("*")
        .eq("league_id", league.id)
        .eq("id", seasonId)
        .eq("status", "published")
        .maybeSingle(),
      supabase
        .from("registration_settings")
        .select("*")
        .eq("league_id", league.id)
        .eq("season_id", seasonId)
        .maybeSingle(),
      supabase
        .from("divisions")
        .select("*")
        .eq("league_id", league.id)
        .eq("season_id", seasonId)
        .order("name"),
      supabase
        .from("teams")
        .select("id,name")
        .eq("league_id", league.id)
        .eq("manager_id", user.id)
        .order("name"),
      supabase
        .from("season_teams")
        .select("team_id")
        .eq("league_id", league.id)
        .eq("season_id", seasonId),
      supabase.rpc("registration_player_catalog", {
        p_league_id: league.id,
        p_season_id: seasonId,
      }),
    ]);
  if (!season.error && !season.data) notFound();
  if (
    [season, settings, divisions, teams, existing, catalog].some(
      (result) => result.error,
    )
  )
    throw new Error("Unable to load registration setup.");
  if (!season.data) notFound();
  const available = (teams.data ?? []).filter(
    (team) =>
      !existing.data?.some((registration) => registration.team_id === team.id),
  );
  const isOpen =
    settings.data?.is_open &&
    new Date(settings.data.deadline).getTime() > new Date().getTime();
  return (
    <main className="mx-auto max-w-2xl space-y-6 py-8">
      <Button asChild variant="ghost">
        <Link href={`/team/${slug}`}>{t("teamHome")}</Link>
      </Button>
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">{season.data.name}</p>
        <h1 className="font-display text-3xl font-semibold">
          {t("registerTeam")}
        </h1>
      </div>
      {!isOpen || !settings.data ? (
        <p className="rounded-2xl border bg-card p-5">
          {t("registrationClosed")}
        </p>
      ) : !available.length ? (
        <div className="space-y-4">
          <p className="text-muted-foreground">{t("firstTeamHelp")}</p>
          <NameForm slug={slug} kind="team" />
        </div>
      ) : (
        <RegistrationWizard
          slug={slug}
          teams={available}
          divisions={divisions.data ?? []}
          catalog={parsePlayerCatalog(catalog.data)}
          ratingScale={season.data.rating_scale}
          deadline={settings.data.deadline}
          feeHalalas={settings.data.fee_halalas}
          requireDocuments={settings.data.require_documents}
          initial={{
            teamId: available[0].id,
            seasonId,
            divisionId: divisions.data?.[0]?.id ?? "",
            roster: [],
          }}
        />
      )}
    </main>
  );
}
