import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";
import type { LiveScore } from "@/lib/sports/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cardVariants } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { Section } from "@/components/ui/section";
import { cn } from "@/lib/utils";

export interface BoardGame {
  id: string;
  status: "submitted" | "in_progress" | "approved" | "scheduled";
  scheduledAt: string | null;
  venue: string;
  divisionName: string;
  homeName: string;
  awayName: string;
  homeScore: number | null;
  awayScore: number | null;
  outcome: string | null;
  /** When the scorer sent the result, for games waiting for approval. */
  sentAt?: string | null;
}

const groups = ["submitted", "in_progress", "upcoming", "approved"] as const;
type Group = (typeof groups)[number];

/**
 * The commissioner's games desk: results to approve first, then games being
 * played, the next week's games, and the latest approved results.
 */
export async function GamesBoard({
  slug,
  games,
  scores,
  approvedLimit,
}: {
  slug: string;
  games: readonly BoardGame[];
  /** The score so far for games being played. */
  scores: ReadonlyMap<string, LiveScore>;
  /** How many approved results were loaded, to say when there are more. */
  approvedLimit: number;
}) {
  const [t, live, format] = await Promise.all([
    getTranslations("Review"),
    getTranslations("LiveStatus"),
    getFormatter(),
  ]);
  const byGroup: Record<Group, BoardGame[]> = {
    submitted: games.filter((game) => game.status === "submitted"),
    in_progress: games.filter((game) => game.status === "in_progress"),
    upcoming: games.filter((game) => game.status === "scheduled"),
    approved: games.filter((game) => game.status === "approved"),
  };
  const statLabel: Record<Group, string> = {
    submitted: t("statWaiting"),
    in_progress: t("statLive"),
    upcoming: t("statUpcoming"),
    approved: t("statApproved"),
  };
  const when = (iso: string | null) =>
    iso
      ? format.dateTime(new Date(iso), {
          weekday: "short",
          day: "numeric",
          month: "short",
          hour: "numeric",
          minute: "2-digit",
        })
      : t("dateTba");
  const href = (game: BoardGame) => `/admin/${slug}/games/${game.id}`;
  const scoreOf = (game: BoardGame) =>
    game.homeScore !== null && game.awayScore !== null
      ? { home: game.homeScore, away: game.awayScore }
      : scores.has(game.id)
        ? {
            home: scores.get(game.id)!.homeScore,
            away: scores.get(game.id)!.awayScore,
          }
        : null;

  /** Two team lines with scores; the winner of a finished game in bold. */
  const scoreLines = (game: BoardGame, size: "lg" | "md") => {
    const score = scoreOf(game);
    const finished = game.status === "approved" || game.status === "submitted";
    const winner =
      finished && score && score.home !== score.away
        ? score.home > score.away
          ? "home"
          : "away"
        : null;
    return (
      <span className="block space-y-1">
        {(["home", "away"] as const).map((side) => (
          <span key={side} className="flex items-center justify-between gap-3">
            <span
              className={cn(
                "min-w-0 break-words",
                size === "lg" ? "text-lg" : "",
                winner === side ? "font-bold" : "font-semibold",
                winner && winner !== side && "text-muted-foreground",
              )}
            >
              {side === "home" ? game.homeName : game.awayName}
            </span>
            {score && (
              <span
                className={cn(
                  "font-display font-semibold tabular-nums",
                  size === "lg" ? "text-3xl" : "text-2xl",
                  winner && winner !== side && "text-muted-foreground",
                )}
              >
                {score[side]}
              </span>
            )}
          </span>
        ))}
      </span>
    );
  };
  const meta = (game: BoardGame) =>
    [game.divisionName, when(game.scheduledAt), game.venue]
      .filter(Boolean)
      .join(" · ");

  return (
    <div className="space-y-8">
      <nav aria-label={t("jump")}>
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {groups.map((group) => {
            const count = byGroup[group].length;
            const urgent = group === "submitted" && count > 0;
            return (
              <li key={group}>
                <a
                  href={`#${group}`}
                  className={cn(
                    cardVariants({
                      tone: urgent ? "warning" : "default",
                      interactive: !urgent,
                      padding: "sm",
                    }),
                    "block space-y-1 sm:p-4",
                  )}
                >
                  <span className="block text-sm font-semibold">
                    {statLabel[group]}
                  </span>
                  <span className="flex items-center gap-2 font-display text-3xl leading-none font-semibold">
                    {count}
                    {group === "in_progress" && count > 0 && (
                      <span
                        className="size-2.5 animate-pulse rounded-full bg-primary"
                        aria-hidden="true"
                      />
                    )}
                  </span>
                </a>
              </li>
            );
          })}
        </ul>
      </nav>

      <Section
        id="submitted"
        title={t("group.submitted")}
        description={
          byGroup.submitted.length ? t("groupHelp.submitted") : undefined
        }
        className="scroll-mt-24"
      >
        {byGroup.submitted.length ? (
          <ul className="grid gap-3 md:grid-cols-2">
            {byGroup.submitted.map((game) => (
              <li
                key={game.id}
                className={cn(cardVariants({ tone: "highlight" }), "space-y-4")}
              >
                <p className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
                  <span>{meta(game)}</span>
                  {game.sentAt && (
                    <Badge tone="warning">
                      {t("sentAt", { when: when(game.sentAt) })}
                    </Badge>
                  )}
                </p>
                {scoreLines(game, "lg")}
                <Button asChild className="w-full">
                  <Link href={href(game)}>
                    <Icon name="review" className="size-5" />
                    {t("reviewButton")}
                  </Link>
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <p
            className={cn(
              cardVariants({ tone: "muted" }),
              "flex items-center gap-3 font-semibold",
            )}
          >
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-success text-white">
              <Icon name="check" className="size-5" />
            </span>
            {t("allCaughtUp")}
          </p>
        )}
      </Section>

      <Section
        id="in_progress"
        title={t("group.in_progress")}
        description={
          byGroup.in_progress.length ? t("groupHelp.in_progress") : undefined
        }
        className="scroll-mt-24"
      >
        {byGroup.in_progress.length ? (
          <ul className="grid gap-3 md:grid-cols-2">
            {byGroup.in_progress.map((game) => {
              const status = scores.get(game.id)?.status;
              return (
                <li
                  key={game.id}
                  className={cn(cardVariants(), "space-y-4 border-primary/50")}
                >
                  <p className="flex flex-wrap items-center justify-between gap-2 text-sm">
                    <Badge tone="primary">
                      <span
                        className="size-2 animate-pulse rounded-full bg-white"
                        aria-hidden="true"
                      />
                      {status ? live(status.key, status.values) : t("statLive")}
                    </Badge>
                    <span className="text-muted-foreground">
                      {[game.divisionName, game.venue]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </p>
                  {scoreLines(game, "lg")}
                  <span className="grid grid-cols-2 gap-2">
                    <Button asChild variant="dark">
                      <Link href={href(game)}>{t("openGame")}</Link>
                    </Button>
                    <Button asChild variant="outline">
                      <a
                        href={`/tv/${game.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <Icon name="live" className="size-5" />
                        {t("watchTv")}
                      </a>
                    </Button>
                  </span>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">
            {t("empty.in_progress")}
          </p>
        )}
      </Section>

      <Section
        id="upcoming"
        title={t("group.upcoming")}
        description={
          byGroup.upcoming.length ? t("groupHelp.upcoming") : undefined
        }
        action={{ href: `/admin/${slug}/schedule`, label: t("fullSchedule") }}
        className="scroll-mt-24"
      >
        {byGroup.upcoming.length ? (
          <ul className={cn(cardVariants({ padding: "none" }), "divide-y")}>
            {byGroup.upcoming.map((game) => (
              <li key={game.id}>
                <Link
                  href={href(game)}
                  className="flex items-center gap-4 px-4 py-3 transition-colors hover:bg-accent"
                >
                  <span className="w-20 shrink-0 text-center">
                    {game.scheduledAt ? (
                      <>
                        <span className="block text-xs font-bold text-muted-foreground uppercase">
                          {format.dateTime(new Date(game.scheduledAt), {
                            weekday: "short",
                            day: "numeric",
                            month: "short",
                          })}
                        </span>
                        <span className="block font-display text-lg font-semibold">
                          {format.dateTime(new Date(game.scheduledAt), {
                            hour: "numeric",
                            minute: "2-digit",
                          })}
                        </span>
                      </>
                    ) : (
                      <span className="block text-xs font-bold text-muted-foreground uppercase">
                        {t("dateTba")}
                      </span>
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold break-words">
                      {game.homeName}{" "}
                      <span className="font-normal text-muted-foreground">
                        {t("versus")}
                      </span>{" "}
                      {game.awayName}
                    </span>
                    <span className="block truncate text-sm text-muted-foreground">
                      {[game.divisionName, game.venue]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </span>
                  <Icon
                    name="arrow"
                    className="size-5 shrink-0 text-muted-foreground"
                  />
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">{t("empty.upcoming")}</p>
        )}
      </Section>

      <Section
        id="approved"
        title={t("group.approved")}
        description={
          byGroup.approved.length ? t("groupHelp.approved") : undefined
        }
        className="scroll-mt-24"
      >
        {byGroup.approved.length ? (
          <>
            <ul className="grid gap-3 sm:grid-cols-2">
              {byGroup.approved.map((game) => (
                <li key={game.id}>
                  <Link
                    href={href(game)}
                    className={cn(
                      cardVariants({ interactive: true }),
                      "block h-full space-y-2",
                    )}
                  >
                    <span className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
                      <span>
                        {[game.divisionName, when(game.scheduledAt)]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                      {(game.outcome === "forfeit" ||
                        game.outcome === "default") && (
                        <Badge tone="warning">
                          {t(`outcomeNote.${game.outcome}`)}
                        </Badge>
                      )}
                    </span>
                    {scoreLines(game, "md")}
                  </Link>
                </li>
              ))}
            </ul>
            {byGroup.approved.length >= approvedLimit && (
              <p className="text-sm text-muted-foreground">
                {t("showingLatest", { count: approvedLimit })}{" "}
                <Link
                  href={`/admin/${slug}/schedule`}
                  className="font-semibold text-orange-dark hover:underline"
                >
                  {t("fullSchedule")}
                </Link>
              </p>
            )}
          </>
        ) : (
          <p className="text-sm text-muted-foreground">{t("empty.approved")}</p>
        )}
      </Section>
    </div>
  );
}
