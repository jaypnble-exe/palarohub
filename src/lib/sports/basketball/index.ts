import type { SportModule } from "../types";
import { basketballEventSchema, type BasketballEvent } from "./events";
import {
  reduceBasketballGame,
  validateBasketballEvent,
  type BasketballEventError,
  type BasketballGameState,
} from "./reducer";
import { summarizeBasketballGame } from "./summary";
import { basketballLiveScore } from "./live-score";
import { basketballPerformances } from "./career";
import { basketballPlayerOfGameCandidates } from "./player-of-game";
import {
  basketballRulesSchema,
  defaultBasketballRules,
  type BasketballRules,
} from "./rules";

export * from "./events";
export * from "./reducer";
export * from "./rules";
export * from "./clock-time";
export * from "./summary";
export * from "./live-score";
export * from "./scoresheet-data";

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
  summarizeGame: summarizeBasketballGame,
  liveScore: basketballLiveScore,
  playerPerformances: basketballPerformances,
  playerOfGameCandidates: basketballPlayerOfGameCandidates,
  careerMetrics: [
    ...[
      "points",
      "rebounds",
      "assists",
      "steals",
      "blocks",
      "turnovers",
      "minutes",
    ].map((key) => ({ key, labelKey: key })),
    {
      key: "fieldGoals",
      labelKey: "fieldGoalPercent",
      denominator: "fieldGoalAttempts",
    },
    {
      key: "threePointers",
      labelKey: "threePointPercent",
      denominator: "threePointAttempts",
    },
    {
      key: "freeThrows",
      labelKey: "freeThrowPercent",
      denominator: "freeThrowAttempts",
    },
  ],
  statisticalAwards: [
    "points",
    "rebounds",
    "assists",
    "steals",
    "blocks",
    "threePointers",
  ].map((key) => ({ key, labelKey: key })),
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
  // FIBA: 2 points for a win, 1 for a loss, 0 for a loss by forfeit.
  standingsPoints: (result) =>
    result === "win" ? 2 : result === "forfeit" ? 0 : 1,
  tiebreakers: [
    "headToHeadPoints",
    "headToHeadDifference",
    "headToHeadScored",
    "pointDifference",
    "pointsScored",
  ],
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
