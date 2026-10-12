import { basketball } from "./basketball";

export const supportedSports = ["basketball"] as const;

export function getSportModule(sport: string) {
  if (sport === "basketball") return basketball;
  throw new Error(`Unsupported sport: ${sport}`);
}
