"use client";
import Link from "next/link";
import { useTranslations } from "next-intl";

export function PlayerOfGameStats({
  metrics,
  efficiency,
}: {
  metrics: Record<string, number>;
  efficiency?: number;
}) {
  const t = useTranslations("PlayerOfGame");
  const stats = useTranslations("Competition.metric");
  return (
    <dl className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
      {["points", "rebounds", "assists", "steals", "blocks", "turnovers"].map(
        (key) => (
          <div key={key}>
            <dt className="text-muted-foreground">{stats(key)}</dt>
            <dd className="font-semibold tabular-nums">{metrics[key] ?? 0}</dd>
          </div>
        ),
      )}
      <div>
        <dt className="text-muted-foreground">{t("fieldGoals")}</dt>
        <dd className="font-semibold tabular-nums">
          {metrics.fieldGoals ?? 0}/{metrics.fieldGoalAttempts ?? 0}
        </dd>
      </div>
      <div>
        <dt className="text-muted-foreground">{t("freeThrows")}</dt>
        <dd className="font-semibold tabular-nums">
          {metrics.freeThrows ?? 0}/{metrics.freeThrowAttempts ?? 0}
        </dd>
      </div>
      {efficiency !== undefined && (
        <div>
          <dt className="text-muted-foreground">{t("efficiency")}</dt>
          <dd className="font-semibold tabular-nums">{efficiency}</dd>
        </div>
      )}
    </dl>
  );
}

export function PlayerOfGameCard({
  slug,
  award,
}: {
  slug: string;
  award: {
    player_id: string;
    player_name: string;
    metrics: Record<string, number>;
    efficiency: number;
  };
}) {
  const t = useTranslations("PlayerOfGame");
  return (
    <section className="space-y-3 rounded-2xl border-2 border-primary bg-card p-5">
      <h2 className="font-display text-2xl font-semibold">{t("title")}</h2>
      <Link
        href={`/${slug}/players/${award.player_id}`}
        className="text-lg font-semibold text-orange-dark hover:underline"
      >
        {award.player_name}
      </Link>
      <p className="text-sm text-muted-foreground">{t("confirmed")}</p>
      <PlayerOfGameStats
        metrics={award.metrics}
        efficiency={award.efficiency}
      />
    </section>
  );
}
