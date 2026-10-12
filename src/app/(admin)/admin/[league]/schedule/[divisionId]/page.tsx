import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { getTranslations } from "next-intl/server";
import { getLeagueAccess } from "@/lib/league-access";
import { getSiteUrl } from "@/lib/auth";
import { divisionSchedule } from "@/lib/schedule-data";
import { AccessDenied } from "@/components/access-denied";
import { Button } from "@/components/ui/button";
import { ShareButtons } from "@/components/share-buttons";
import { GameList } from "@/components/schedule/game-list";
import { GameEditor } from "@/components/schedule/game-editor";
import { AddGameForm } from "@/components/schedule/add-game-form";
import { ScorerAccess } from "@/components/schedule/scorer-access";
import {
  canBeScored,
  isSchedulable,
  type GameStatus,
} from "@/lib/validation/schedule";

export default async function DivisionSchedulePage({
  params,
}: {
  params: Promise<{ league: string; divisionId: string }>;
}) {
  const { league: slug, divisionId } = await params;
  if (!z.uuid().safeParse(divisionId).success) notFound();
  const { supabase, league, canView } = await getLeagueAccess(slug);
  if (!canView) return <AccessDenied />;
  const schedule = await divisionSchedule(supabase, league.id, divisionId);
  if (!schedule) notFound();
  const { division, teams, games } = schedule;
  const t = await getTranslations("Schedule");
  const publicUrl = `${getSiteUrl()}/${slug}/schedule?division=${division.id}`;
  return (
    <main className="mx-auto max-w-2xl space-y-6 py-8">
      <Button asChild variant="ghost">
        <Link href={`/admin/${slug}/schedule`}>{t("backToSchedules")}</Link>
      </Button>
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">
          {division.seasons?.name}
        </p>
        <h1 className="font-display text-3xl font-semibold">{division.name}</h1>
        <p className="text-sm text-muted-foreground">
          {t("teamCount", { count: teams.length })}
          {" · "}
          {t("gameCount", { count: games.length })}
        </p>
      </div>
      {teams.length >= 2 && (
        <div className="flex flex-wrap gap-3">
          <Button asChild variant={games.length ? "outline" : "default"}>
            <Link href={`/admin/${slug}/schedule/${division.id}/new`}>
              {t(games.length ? "remakeSchedule" : "makeSchedule")}
            </Link>
          </Button>
        </div>
      )}
      {games.length > 0 && (
        <section className="space-y-3 rounded-2xl border bg-card p-5">
          <h2 className="font-display text-xl font-semibold">
            {t("shareSchedule")}
          </h2>
          <ShareButtons
            url={publicUrl}
            text={t("shareText", { division: division.name })}
          />
        </section>
      )}
      {teams.length >= 2 && (
        <AddGameForm
          slug={slug}
          divisionId={division.id}
          teams={teams}
          defaultVenue={games.find((game) => game.venue)?.venue ?? ""}
        />
      )}
      <GameList
        games={games}
        actions={(game) => (
          <div className="space-y-3">
            {canBeScored(game.status) && (
              <ScorerAccess
                slug={slug}
                gameId={game.id}
                siteUrl={getSiteUrl()}
              />
            )}
            {isSchedulable(game.status) && (
              <GameEditor
                slug={slug}
                game={{ ...game, status: game.status as GameStatus }}
              />
            )}
          </div>
        )}
      />
    </main>
  );
}
