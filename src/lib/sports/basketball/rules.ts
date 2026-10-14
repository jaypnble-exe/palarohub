import { z } from "zod";

const timeoutsSchema = z.strictObject({
  firstHalf: z.number().int().min(0).max(10).default(2),
  secondHalf: z.number().int().min(0).max(10).default(3),
  overtime: z.number().int().min(0).max(10).default(1),
});

const shotClockSchema = z
  .strictObject({
    // Accept legacy saved flags, but every basketball game now uses a shot clock.
    enabled: z
      .boolean()
      .default(true)
      .transform(() => true),
    seconds: z.number().int().min(10).max(35).default(24),
    resetSeconds: z.number().int().min(1).max(35).default(14),
  })
  .refine((clock) => clock.resetSeconds <= clock.seconds);

export const basketballRulesSchema = z.strictObject({
  foulOut: z.number().int().min(1).max(10).default(5),
  teamBonusAfter: z.number().int().min(0).max(20).default(4),
  quarters: z.number().int().min(1).max(8).default(4),
  quarterMinutes: z.number().int().min(1).max(30).default(10),
  overtimeMinutes: z.number().int().min(1).max(15).default(5),
  timeouts: timeoutsSchema.prefault({}),
  // Older seasons without these settings receive the mandatory 24/14 defaults.
  shotClock: shotClockSchema.prefault({}),
});

export type BasketballRules = z.infer<typeof basketballRulesSchema>;
export const defaultBasketballRules = Object.freeze(
  basketballRulesSchema.parse({}),
);
