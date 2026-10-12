"use client";

import { BasketballRulesFields } from "./basketball/rules-fields";

export function SportRulesFields({
  sport,
  ...props
}: {
  sport: string;
  value: Record<string, unknown>;
  onChange?: (value: Record<string, unknown>) => void;
  disabled?: boolean;
}) {
  if (sport === "basketball") return <BasketballRulesFields {...props} />;
  throw new Error(`Unsupported sport settings: ${sport}`);
}
