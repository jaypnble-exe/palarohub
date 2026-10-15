import { z } from "zod";
export const bracketSetupSchema = z.object({
  divisionId: z.uuid(),
  preset: z.enum(["single", "best3", "best5", "twice"]),
  teamIds: z
    .array(z.uuid())
    .min(2)
    .max(16)
    .refine((ids) => new Set(ids).size === ids.length),
  confirmed: z.literal(true),
});
export type BracketSetup = z.infer<typeof bracketSetupSchema>;
