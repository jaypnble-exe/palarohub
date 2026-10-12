import { z } from "zod";

const uuid = z.uuid();
const venue = z.string().trim().max(80);
const unique = <T>(values: readonly T[]) =>
  new Set(values).size === values.length;

export const gameStatuses = ["scheduled", "postponed", "cancelled"] as const;
export type GameStatus = (typeof gameStatuses)[number];

export const scheduleSetupSchema = z.strictObject({
  divisionId: uuid,
  twice: z.boolean(),
  startDate: z.iso.date(),
  gameDays: z
    .array(z.number().int().min(0).max(6))
    .min(1, "pickGameDay")
    .max(7)
    .refine(unique),
  times: z
    .array(z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "invalidTime"))
    .min(1, "timeMissing")
    .max(8)
    .refine(unique, "duplicateTime"),
  venues: z
    .array(venue.min(1, "venueRequired"))
    .min(1, "venueMissing")
    .max(6)
    .refine(
      (values) => unique(values.map((value) => value.toLowerCase())),
      "duplicateVenue",
    ),
  replace: z.boolean(),
});
export type ScheduleSetupInput = z.output<typeof scheduleSetupSchema>;

export const gameUpdateSchema = z
  .strictObject({
    gameId: uuid,
    status: z.enum(gameStatuses),
    scheduledAt: z.iso.datetime({ offset: true }).nullable(),
    venue,
  })
  .refine((input) => input.status === "postponed" || input.scheduledAt, {
    path: ["scheduledAt"],
    message: "timeRequired",
  });
export type GameUpdateInput = z.output<typeof gameUpdateSchema>;

export const addGameSchema = z
  .strictObject({
    divisionId: uuid,
    homeTeamId: uuid,
    awayTeamId: uuid,
    scheduledAt: z.iso.datetime({ offset: true }),
    venue,
  })
  .refine((input) => input.homeTeamId !== input.awayTeamId, {
    path: ["awayTeamId"],
    message: "sameTeam",
  });
export type AddGameInput = z.output<typeof addGameSchema>;

export const announcementSchema = z.strictObject({
  title: z.string().trim().min(1).max(120),
  body: z.string().trim().min(1).max(2000),
  divisionId: uuid.nullable(),
});
export type AnnouncementInput = z.output<typeof announcementSchema>;

export interface ScheduleActionResult {
  success?: true;
  count?: number;
  error?: string;
}
