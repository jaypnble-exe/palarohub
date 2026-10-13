import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";
import { getLeagueAccess } from "@/lib/league-access";
import { AccessDenied } from "@/components/access-denied";

/** Games waiting for approval first, then games being played, then recent results. */
export default async function GamesPage({
  params,
}: {
  params: Promise<{ league: string }>;
}) {
  const { league: slug } = await params;
  const { supabase, league, canView } = await getLeagueAccess(slug);
  if (!canView) return <AccessDenied />;
  const { data: games, error } = await supabase
    .from("published_games")
    .select(
      "id,status,scheduled_at,division_name,home_team_name,away_team_name,home_score,away_score",
    )
    .eq("league_id", league.id)
    .in("status", ["submitted", "in_progress", "approved"])
    .order("scheduled_at", { ascending: false })
    .limit(100);
  if (error) throw new Error("Unable to load games.");
  const t = await getTranslations("Review");
  const schedule = await getTranslations("Schedule");
  const format = await getFormatter();
  const groups = (["submitted", "in_progress", "approved"] as const).map(
    (status) => ({
      status,
      games: games.filter((game) => game.status === status),
    }),
  );
  return (
    <main className="mx-auto max-w-2xl space-y-6 py-8">
      <h1 className="font-display text-3xl font-semibold">{t("gamesTitle")}</h1>
      {groups.map(({ status, games: list }) => (
        <section key={status} className="space-y-3">
          <h2 className="text-xl font-semibold">{t(`group.${status}`)}</h2>
          {list.length ? (
            <ul className="space-y-3">
              {list.map((game) => (
                <li key={game.id}>
                  <Link
                    href={`/admin/${slug}/games/${game.id}`}
                    className="block space-y-1 rounded-2xl border bg-card p-4 hover:bg-accent"
                  >
                    <span className="block font-semibold">
                      {schedule("matchup", {
                        home: game.home_team_name ?? "",
                        away: game.away_team_name ?? "",
                      })}
                      {game.home_score !== null &&
                        ` · ${game.home_score} – ${game.away_score}`}
                    </span>
                    <span className="block text-sm text-muted-foreground">
                      {game.division_name}
                      {game.scheduled_at &&
                        ` · ${format.dateTime(new Date(game.scheduled_at), { dateStyle: "medium" })}`}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">
              {t(`empty.${status}`)}
            </p>
          )}
        </section>
      ))}
    </main>
  );
}
