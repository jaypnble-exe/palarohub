import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { getLeagueAccess } from "@/lib/league-access";
import { AccessDenied } from "@/components/access-denied";
import { Button } from "@/components/ui/button";
import { NameForm } from "@/components/registration/name-form";
export default async function PlayersPage({
  params,
}: {
  params: Promise<{ league: string }>;
}) {
  const { league: slug } = await params;
  const { supabase, league, canView } = await getLeagueAccess(slug);
  if (!canView) return <AccessDenied />;
  const t = await getTranslations("Registration");
  const { data: players, error } = await supabase
    .from("league_player_catalog")
    .select("id,display_name,current_rating")
    .eq("league_id", league.id)
    .order("display_name");
  if (error) throw new Error("Unable to load players.");
  return (
    <main className="space-y-6 py-8">
      <Button asChild variant="ghost">
        <Link href={`/admin/${slug}`}>{t("leagueHome")}</Link>
      </Button>
      <h1 className="font-display text-3xl font-semibold">{t("players")}</h1>
      <details className="rounded-2xl border bg-card p-5">
        <summary className="min-h-11 cursor-pointer py-3 font-semibold">
          {t("addNewPlayer")}
        </summary>
        <NameForm slug={slug} kind="player" />
      </details>
      {!players?.length ? (
        <p className="rounded-2xl border bg-card p-5">{t("noPlayers")}</p>
      ) : (
        <ul className="space-y-3">
          {players.map((player) => (
            <li
              key={player.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-card p-5"
            >
              <div>
                <h2 className="font-semibold">{player.display_name}</h2>
                <p className="text-sm text-muted-foreground">
                  {player.current_rating
                    ? t("playerRating", { rating: player.current_rating })
                    : t("unrated")}
                </p>
              </div>
              <Button asChild variant="outline">
                <Link href={`/admin/${slug}/players/${player.id}`}>
                  {t("viewPlayer")}
                </Link>
              </Button>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
