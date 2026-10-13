import Link from "next/link";
import { useTranslations } from "next-intl";
import type { LiveScore } from "@/lib/sports/types";
import { Icon } from "@/components/ui/icon";

/** A game being played: both teams, the score so far, and where it stands. */
export function LiveGameCard({
  href,
  game,
  score,
  children,
}: {
  href: string;
  /** Extra controls under the score, e.g. the scorer buttons. */
  children?: React.ReactNode;
  game: {
    homeName: string;
    awayName: string;
    divisionName: string;
    round: number | null;
    venue: string;
  };
  score?: LiveScore;
}) {
  const t = useTranslations("Schedule");
  const status = useTranslations("LiveStatus");
  const leader =
    score && score.homeScore !== score.awayScore
      ? score.homeScore > score.awayScore
        ? "home"
        : "away"
      : null;
  const row = (side: "home" | "away", name: string, points?: number) => (
    <div className="flex items-center justify-between gap-4">
      <dt
        className={`truncate text-lg font-semibold ${leader && leader !== side ? "text-on-dark-muted" : ""}`}
      >
        {name}
      </dt>
      <dd
        className={`font-display text-4xl leading-none font-bold tabular-nums ${leader && leader !== side ? "text-on-dark-muted" : ""}`}
      >
        {points ?? "–"}
      </dd>
    </div>
  );
  return (
    <li className="space-y-4 rounded-2xl bg-navy p-5 text-on-dark">
      <Link
        href={href}
        className="-m-2 block space-y-4 rounded-xl p-2 transition-colors hover:bg-navy-secondary"
      >
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <span className="inline-flex items-center gap-2 rounded-full bg-primary px-3 py-1 font-semibold text-white">
            <span className="size-2 rounded-full bg-white" aria-hidden="true" />
            {t("liveBadge")}
          </span>
          <span className="font-semibold text-on-dark-muted">
            {[
              game.divisionName,
              game.round ? t("round", { round: game.round }) : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          </span>
        </div>
        <dl className="space-y-2">
          {row("home", game.homeName, score?.homeScore)}
          {row("away", game.awayName, score?.awayScore)}
        </dl>
        <div className="flex items-center justify-between gap-3 border-t border-white/15 pt-3 text-sm">
          <span className="font-display text-lg tracking-wide">
            {score
              ? status(score.status.key, score.status.values)
              : t("liveNoScore")}
          </span>
          <span className="inline-flex items-center gap-1 font-semibold text-on-dark-muted">
            {t("openGame")}
            <Icon name="arrow" className="size-4" />
          </span>
        </div>
      </Link>
      {children}
    </li>
  );
}
