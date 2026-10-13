import type { LiveScore } from "../types";
import type { BasketballGameState } from "./reducer";
import type { BasketballRules } from "./rules";

/** "4:12" from milliseconds left in the period. */
export function formatClock(ms: number) {
  const seconds = Math.ceil(Math.max(0, ms) / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

/** Score and game status, e.g. third quarter, 4:12 left, clock stopped. */
export function basketballLiveScore(
  state: BasketballGameState,
  rules: BasketballRules,
): LiveScore {
  const score = {
    homeScore: state.teams.home.score,
    awayScore: state.teams.away.score,
  };
  const overtime = state.period - rules.quarters;
  if (state.phase === "final")
    return { ...score, status: { key: "basketball.final" } };
  if (state.phase === "pregame" || state.period === 0)
    return { ...score, status: { key: "basketball.pregame" } };
  if (state.phase === "break")
    return {
      ...score,
      status:
        state.period === rules.quarters / 2
          ? { key: "basketball.halftime" }
          : overtime > 0
            ? { key: "basketball.endOfOvertime", values: { number: overtime } }
            : overtime === 0
              ? { key: "basketball.endOfRegulation" }
              : {
                  key: "basketball.endOfQuarter",
                  values: { period: state.period },
                },
    };
  const clock = formatClock(state.clock.remainingMs);
  return {
    ...score,
    status:
      overtime > 0
        ? {
            key: state.clock.running
              ? "basketball.overtimeRunning"
              : "basketball.overtime",
            values: { number: overtime, clock },
          }
        : {
            key: state.clock.running
              ? "basketball.quarterRunning"
              : "basketball.quarter",
            values: { period: state.period, clock },
          },
  };
}
