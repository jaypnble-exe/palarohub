import { z } from "zod";

const uuid = z.uuid();
export const eligibilityIssueSchema = z.object({
  code: z.enum([
    "rosterTooSmall",
    "rosterTooLarge",
    "ratingMissing",
    "ratingTooHigh",
    "ratingUnknown",
    "playerSuspended",
    "documentsMissing",
    "anotherTeam",
    "duplicatePlayer",
    "duplicateJersey",
  ]),
  playerId: uuid.optional(),
  name: z.string().optional(),
  rating: z.string().optional(),
  maximumRating: z.string().optional(),
  min: z.number().optional(),
  max: z.number().optional(),
});
export const registrationPlayerSchema = z.object({
  id: uuid,
  name: z.string(),
  rating: z.string().nullable(),
  suspended: z.boolean(),
  documentsPresent: z.boolean(),
  onAnotherTeam: z.boolean(),
});
export type RegistrationPlayer = z.output<typeof registrationPlayerSchema>;
export interface RegistrationActionResult {
  success?: true;
  id?: string;
  error?: string;
  issues?: z.output<typeof eligibilityIssueSchema>[];
}
export const teamSchema = z.strictObject({
  name: z.string().trim().min(1).max(100),
});
export const playerSchema = z.strictObject({
  name: z.string().trim().min(1).max(100),
});
export const rosterEntrySchema = z.strictObject({
  playerId: uuid,
  jerseyNumber: z.number().int().min(0).max(999),
});
export const registrationSchema = z
  .strictObject({
    teamId: uuid,
    seasonId: uuid,
    divisionId: uuid,
    roster: z.array(rosterEntrySchema).max(50),
  })
  .superRefine((input, context) => {
    const ids = new Set<string>();
    const jerseys = new Set<number>();
    input.roster.forEach((entry, index) => {
      if (ids.has(entry.playerId))
        context.addIssue({
          code: "custom",
          path: ["roster", index, "playerId"],
          message: "duplicatePlayer",
        });
      if (jerseys.has(entry.jerseyNumber))
        context.addIssue({
          code: "custom",
          path: ["roster", index, "jerseyNumber"],
          message: "duplicateJersey",
        });
      ids.add(entry.playerId);
      jerseys.add(entry.jerseyNumber);
    });
  });
export const registrationSettingsSchema = z.strictObject({
  seasonId: uuid,
  isOpen: z.boolean(),
  deadline: z.iso.datetime({ offset: true }),
  feeHalalas: z.number().int().min(0).max(100_000_000),
  requireDocuments: z.boolean(),
});
export const reviewSchema = z
  .strictObject({
    registrationId: uuid,
    decision: z.enum(["approved", "rejected", "returned"]),
    comment: z.string().trim().max(1000),
  })
  .refine(
    (input) => input.decision === "approved" || input.comment.length > 0,
    { path: ["comment"], message: "commentRequired" },
  );
export const ratingEntrySchema = z.strictObject({
  playerId: uuid,
  rating: z
    .string()
    .trim()
    .min(1)
    .max(16)
    .transform((value) => value.toUpperCase()),
  effectiveFrom: z.iso.datetime({ offset: true }),
  reason: z.string().trim().min(1).max(500),
});
export const playerChecksSchema = z.strictObject({
  playerId: uuid,
  documentsPresent: z.boolean(),
  suspended: z.boolean(),
});
export const rosterChangeSchema = z
  .strictObject({
    registrationId: uuid,
    roster: z.array(rosterEntrySchema).min(1).max(50),
    reason: z.string().trim().min(1).max(1000),
  })
  .superRefine((input, context) => {
    if (
      new Set(input.roster.map((entry) => entry.playerId)).size !==
      input.roster.length
    )
      context.addIssue({
        code: "custom",
        path: ["roster"],
        message: "duplicatePlayer",
      });
    if (
      new Set(input.roster.map((entry) => entry.jerseyNumber)).size !==
      input.roster.length
    )
      context.addIssue({
        code: "custom",
        path: ["roster"],
        message: "duplicateJersey",
      });
  });
export type RegistrationInput = z.output<typeof registrationSchema>;
export type RegistrationSettingsInput = z.output<
  typeof registrationSettingsSchema
>;
export type RosterEntryInput = z.output<typeof rosterEntrySchema>;
export type ReviewInput = z.output<typeof reviewSchema>;
export type RatingEntryInput = z.output<typeof ratingEntrySchema>;
export type PlayerChecksInput = z.output<typeof playerChecksSchema>;
export type RosterChangeInput = z.output<typeof rosterChangeSchema>;

/** Money is parsed from text into integer halalas without float arithmetic. */
export function sarToHalalas(value: string): number | null {
  const match = /^(\d{1,7})(?:\.(\d{1,2}))?$/.exec(value.trim());
  if (!match) return null;
  const amount =
    Number(match[1]) * 100 + Number((match[2] ?? "").padEnd(2, "0"));
  return amount <= 100_000_000 ? amount : null;
}
