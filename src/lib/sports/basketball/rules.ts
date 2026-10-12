import { z } from "zod";

const timeoutsSchema = z.strictObject({
  firstHalf: z.number().int().min(0).max(10).default(2),
  secondHalf: z.number().int().min(0).max(10).default(3),
  overtime: z.number().int().min(0).max(10).default(1),
});

export const basketballRulesSchema = z.strictObject({
  foulOut: z.number().int().min(1).max(10).default(5),
  teamBonusAfter: z.number().int().min(0).max(20).default(4),
  quarters: z.number().int().min(1).max(8).default(4),
  quarterMinutes: z.number().int().min(1).max(30).default(10),
  overtimeMinutes: z.number().int().min(1).max(15).default(5),
  timeouts: timeoutsSchema.prefault({}),
});

export type BasketballRules = z.infer<typeof basketballRulesSchema>;
export const defaultBasketballRules = Object.freeze(
  basketballRulesSchema.parse({}),
);
