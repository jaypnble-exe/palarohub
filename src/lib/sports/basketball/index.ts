import type { SportModule } from "../types";
import { basketballEventSchema, type BasketballEvent } from "./events";
import {
  reduceBasketballGame,
  validateBasketballEvent,
  type BasketballEventError,
  type BasketballGameState,
} from "./reducer";
import {
  basketballRulesSchema,
  defaultBasketballRules,
  type BasketballRules,
} from "./rules";

export * from "./events";
export * from "./reducer";
export * from "./rules";

export const basketball: SportModule<
  BasketballRules,
  BasketballEvent,
  BasketballGameState,
  BasketballEventError
> = {
  sport: "basketball",
  eventSchema: basketballEventSchema,
  rulesSchema: basketballRulesSchema,
  defaultRules: defaultBasketballRules,
  reduceGame: reduceBasketballGame,
  validateEvent: validateBasketballEvent,
  stats: [
    { key: "points", labelKey: "points" },
    { key: "fieldGoals", labelKey: "fieldGoals" },
    { key: "threePointers", labelKey: "threePointers" },
    { key: "freeThrows", labelKey: "freeThrows" },
    { key: "fouls", labelKey: "fouls" },
    { key: "minutes", labelKey: "minutes" },
    { key: "rebound", labelKey: "rebounds" },
    { key: "assist", labelKey: "assists" },
    { key: "steal", labelKey: "steals" },
    { key: "block", labelKey: "blocks" },
    { key: "turnover", labelKey: "turnovers" },
  ],
  // Standings arrive in Phase 1, step 6.
  standingsPoints: () => {
    throw new Error("Basketball standings are not implemented yet.");
  },
  tiebreakers: [],
  ui: {
    rulesForm: "basketball",
    scorer: null,
    tv: null,
    pdf: null,
    flashes: [
      "madeThree",
      "foulWarning",
      "fouledOut",
      "ejected",
      "teamPenalty",
      "timeout",
      "substitution",
    ],
  },
};
