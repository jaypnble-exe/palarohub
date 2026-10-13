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
import { cardVariants } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/ui/page-header";

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
    <main className="mx-auto max-w-2xl space-y-6 py-6">
      <PageHeader
        back={{ href: `/admin/${slug}/schedule`, label: t("backToSchedules") }}
        eyebrow={division.seasons?.name}
        title={division.name}
        description={
          <>
            {t("teamCount", { count: teams.length })}
            {" · "}
            {t("gameCount", { count: games.length })}
          </>
        }
      />
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
        <section className={cn(cardVariants(), "space-y-3")}>
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
