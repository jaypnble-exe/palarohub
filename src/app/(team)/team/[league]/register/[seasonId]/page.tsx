import { notFound } from "next/navigation";
import { z } from "zod";
import { getTranslations } from "next-intl/server";
import { getLeagueAccess } from "@/lib/league-access";
import { parsePlayerCatalog } from "@/lib/registration-data";
import { AccessDenied } from "@/components/access-denied";
import { NameForm } from "@/components/registration/name-form";
import { RegistrationWizard } from "@/components/registration/wizard";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
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
        .select("team_id,division_id")
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
  // A team registers once per division, so it stays available until it is in every division.
  const taken = (existing.data ?? []).map((registration) => ({
    teamId: registration.team_id,
    divisionId: registration.division_id,
  }));
  const divisionList = divisions.data ?? [];
  const openDivisions = (teamId: string) =>
    divisionList.filter(
      (division) =>
        !taken.some(
          (entry) =>
            entry.teamId === teamId && entry.divisionId === division.id,
        ),
    );
  const available = (teams.data ?? []).filter(
    (team) => openDivisions(team.id).length > 0,
  );
  const isOpen =
    settings.data?.is_open &&
    new Date(settings.data.deadline).getTime() > new Date().getTime();
  return (
    <main className="mx-auto max-w-2xl space-y-6 py-6">
      <PageHeader
        back={{ href: `/team/${slug}`, label: t("teamHome") }}
        eyebrow={season.data.name}
        title={t("registerTeam")}
      />
      {!isOpen || !settings.data ? (
        <EmptyState title={t("registrationClosed")} />
      ) : !available.length ? (
        <div className="space-y-4">
          <p className="text-muted-foreground">
            {t(teams.data?.length ? "allDivisionsEntered" : "firstTeamHelp")}
          </p>
          <NameForm slug={slug} kind="team" />
        </div>
      ) : (
        <RegistrationWizard
          slug={slug}
          teams={available}
          divisions={divisionList}
          taken={taken}
          catalog={parsePlayerCatalog(catalog.data)}
          ratingScale={season.data.rating_scale}
          deadline={settings.data.deadline}
          feeHalalas={settings.data.fee_halalas}
          requireDocuments={settings.data.require_documents}
          initial={{
            teamId: available[0].id,
            seasonId,
            divisionId: openDivisions(available[0].id)[0]?.id ?? "",
            roster: [],
          }}
        />
      )}
    </main>
  );
}
