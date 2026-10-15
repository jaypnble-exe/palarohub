export interface PlayerPerformance {
  playerId: string;
  name: string;
  metrics: Record<string, number>;
}
export interface PlayerGame extends PlayerPerformance {
  gameId: string;
  seasonId: string;
  seasonName: string;
  divisionId: string;
  divisionName: string;
  teamName: string;
  opponent: string;
  sport: string;
  playedAt: string | null;
  won: boolean;
}
export interface CareerRow extends PlayerPerformance {
  games: number;
  wins: number;
}

/** Each approved game counts once per player, even if a feed is repeated. */
export function aggregateCareer(games: readonly PlayerGame[]): CareerRow[] {
  const rows = new Map<string, CareerRow>();
  const seen = new Set<string>();
  for (const game of games) {
    const key = `${game.playerId}:${game.gameId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const row = rows.get(game.playerId) ?? {
      playerId: game.playerId,
      name: game.name,
      metrics: {},
      games: 0,
      wins: 0,
    };
    row.games++;
    row.wins += Number(game.won);
    for (const [metric, value] of Object.entries(game.metrics))
      if (Number.isFinite(value))
        row.metrics[metric] = (row.metrics[metric] ?? 0) + value;
    rows.set(game.playerId, row);
  }
  return [...rows.values()].sort(
    (a, b) =>
      a.name.localeCompare(b.name) || a.playerId.localeCompare(b.playerId),
  );
}

export interface CareerMetric {
  key: string;
  labelKey: string;
  denominator?: string;
}
export function careerMetricValue(
  row: CareerRow,
  metric: CareerMetric,
): number | null {
  const denominator = metric.denominator
    ? row.metrics[metric.denominator]
    : row.games;
  return denominator
    ? ((row.metrics[metric.key] ?? 0) / denominator) *
        (metric.denominator ? 100 : 1)
    : null;
}

/** Statistical awards use totals, with shared winners for ties. Zero is not an award. */
export function statisticalLeaders(rows: readonly CareerRow[], metric: string) {
  const maximum = Math.max(0, ...rows.map((row) => row.metrics[metric] ?? 0));
  return maximum > 0
    ? rows.filter((row) => row.metrics[metric] === maximum)
    : [];
}
