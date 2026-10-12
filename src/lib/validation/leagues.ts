import { z } from "zod";
import { supportedSports } from "../sports/registry";

export const reservedSlugs = [
  "admin",
  "team",
  "score",
  "tv",
  "api",
  "login",
  "auth",
  "leagues",
] as const;
export const leagueSchema = z.object({
  name: z.string().trim().min(1).max(100),
  slug: z
    .string()
    .min(3)
    .max(63)
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/)
    .refine((slug) => !reservedSlugs.some((reserved) => reserved === slug)),
  sport: z.enum(supportedSports),
  commissionerEmail: z.string().trim().toLowerCase().pipe(z.email()),
});
export type LeagueInput = z.infer<typeof leagueSchema>;
