import type { z } from "zod";

export type Sport = "basketball";
export type GameResult = "win" | "loss" | "draw" | "forfeit";
export interface StatDefinition {
  key: string;
  labelKey: string;
}

/** Sport-specific event payloads and rules stay inside each module. */
export interface SportModule<Rules, Event, State> {
  sport: Sport;
  eventSchemas: Readonly<Record<string, z.ZodType<Event>>>;
  rulesSchema: z.ZodType<Rules, unknown>;
  defaultRules: Readonly<Rules>;
  reduceGame(events: readonly Event[], rules: Rules): State;
  stats: readonly StatDefinition[];
  standingsPoints(result: GameResult): number;
  tiebreakers: readonly string[];
  ui: {
    rulesForm: string | null;
    scorer: string | null;
    tv: string | null;
    pdf: string | null;
    flashes: readonly string[];
  };
}
