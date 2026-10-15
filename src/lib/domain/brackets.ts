export type BracketPreset = "single" | "best3" | "best5" | "twice";
export interface BracketNode {
  key: string;
  round: number;
  position: number;
  homeSeed: number | null;
  awaySeed: number | null;
  homeSource: string | null;
  awaySource: string | null;
  homeRequired: number;
  awayRequired: number;
}

/** Standard seeding: the two highest seeds can meet only in the final. */
export function buildBracket(
  teamCount: number,
  preset: BracketPreset,
): BracketNode[] {
  if (!Number.isInteger(teamCount) || teamCount < 2 || teamCount > 16)
    throw new Error("A bracket needs 2 to 16 teams.");
  let seeds = [1, 2];
  while (seeds.length < teamCount) {
    const size = seeds.length * 2;
    seeds = seeds.flatMap((seed) => [seed, size + 1 - seed]);
  }
  const nodes: BracketNode[] = [];
  const required = preset === "best3" ? 2 : preset === "best5" ? 3 : 1;
  for (let round = 1, count = seeds.length / 2; count >= 1; round++, count /= 2)
    for (let position = 1; position <= count; position++) {
      nodes.push({
        key: `${round}:${position}`,
        round,
        position,
        homeSeed: round === 1 ? seeds[(position - 1) * 2] : null,
        awaySeed: round === 1 ? seeds[(position - 1) * 2 + 1] : null,
        homeSource: round > 1 ? `${round - 1}:${position * 2 - 1}` : null,
        awaySource: round > 1 ? `${round - 1}:${position * 2}` : null,
        homeRequired: required,
        awayRequired: preset === "twice" && round === 1 ? 2 : required,
      });
    }
  return nodes;
}
