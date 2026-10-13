import type {
  BasketballGameState,
  Effect,
  EffectKind,
  Side,
} from "@/lib/sports/basketball";
import { splitName } from "@/components/scorer/basketball/helpers";

/** The moments the gym screen announces, from CLAUDE.md, plus game flow. */
const shown: readonly EffectKind[] = [
  "madeThree",
  "foulWarning",
  "fouledOut",
  "ejected",
  "coachEjected",
  "teamPenalty",
  "timeout",
  "substitution",
  "shotClockViolation",
  "jumpBall",
];

/** Flashes about to get orange: 3-pointers; red: foul-outs and ejections. */
export type FlashTone = "celebrate" | "warning" | "danger" | "info";
export interface Flash {
  id: string;
  kind: EffectKind;
  tone: FlashTone;
  /** Message key under "Tv.flash". */
  key: string;
  values: Record<string, string | number>;
  team: Side | null;
}

const tone: Partial<Record<EffectKind, FlashTone>> = {
  madeThree: "celebrate",
  foulWarning: "warning",
  teamPenalty: "warning",
  fouledOut: "danger",
  ejected: "danger",
  coachEjected: "danger",
  shotClockViolation: "warning",
};

/** Turns new game effects into the messages the screen shows, oldest first. */
export function flashesFor(
  effects: readonly Effect[],
  state: BasketballGameState,
  teamNames: Record<Side, string>,
): Flash[] {
  return effects
    .filter((effect) => shown.includes(effect.kind))
    .map((effect, index) => {
      const team = effect.team;
      const line =
        team && effect.playerId
          ? state.teams[team].players[effect.playerId]
          : undefined;
      return {
        id: `${effect.eventId}-${effect.kind}-${index}`,
        kind: effect.kind,
        tone: tone[effect.kind] ?? "info",
        key: effect.kind,
        values: {
          team: team ? teamNames[team] : "",
          jersey: line?.jersey ?? "",
          player: line ? splitName(line.name).last : "",
          fouls: line?.foulCount ?? 0,
        },
        team,
      };
    });
}
