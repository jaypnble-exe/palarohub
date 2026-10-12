import { z } from "zod";
import { getSportModule, supportedSports } from "@/lib/sports/registry";

const ratingLabel = z
  .string()
  .trim()
  .min(1)
  .max(16)
  .transform((value) => value.toUpperCase());
export const ratingScaleSchema = z
  .array(ratingLabel)
  .min(2)
  .max(12)
  .refine((labels) => new Set(labels).size === labels.length);
const rulesValue = z.record(z.string(), z.unknown());
export const seasonDetailsSchema = z
  .object({
    name: z.string().trim().min(1).max(100),
    startDate: z.iso.date(),
    endDate: z.iso.date(),
    sport: z.enum(supportedSports),
  })
  .refine((details) => details.endDate >= details.startDate, {
    path: ["endDate"],
    message: "dateOrder",
  });
export const divisionSchema = z.strictObject({
  id: z.uuid().optional(),
  name: z.string().trim().min(1).max(80),
  sport: z.enum(supportedSports),
  maxRating: ratingLabel,
  rosterMin: z.number().int().min(1).max(50),
  rosterMax: z.number().int().min(1).max(50),
  rules: rulesValue.nullable(),
});
export const seasonSchema = z
  .strictObject({
    ...seasonDetailsSchema.shape,
    rules: rulesValue,
    ratingScale: ratingScaleSchema,
    status: z.enum(["draft", "published"]),
    divisions: z.array(divisionSchema).min(1).max(12),
  })
  .superRefine((season, context) => {
    if (season.endDate < season.startDate)
      context.addIssue({
        code: "custom",
        path: ["endDate"],
        message: "dateOrder",
      });
    const rules = getSportModule(season.sport).rulesSchema.safeParse(
      season.rules,
    );
    if (!rules.success)
      context.addIssue({
        code: "custom",
        path: ["rules"],
        message: "rulesInvalid",
      });
    const names = new Set<string>();
    const ids = new Set<string>();
    season.divisions.forEach((division, index) => {
      const path = ["divisions", index];
      const name = division.name.toLocaleLowerCase("en");
      if (names.has(name))
        context.addIssue({
          code: "custom",
          path: [...path, "name"],
          message: "duplicateDivision",
        });
      names.add(name);
      if (division.id && ids.has(division.id))
        context.addIssue({
          code: "custom",
          path: [...path, "id"],
          message: "duplicateDivision",
        });
      if (division.id) ids.add(division.id);
      if (!season.ratingScale.includes(division.maxRating))
        context.addIssue({
          code: "custom",
          path: [...path, "maxRating"],
          message: "invalidRating",
        });
      if (division.rosterMax < division.rosterMin)
        context.addIssue({
          code: "custom",
          path: [...path, "rosterMax"],
          message: "rosterOrder",
        });
      if (division.sport !== season.sport && division.rules === null)
        context.addIssue({
          code: "custom",
          path: [...path, "rules"],
          message: "rulesInvalid",
        });
      if (
        division.rules !== null &&
        !getSportModule(division.sport).rulesSchema.safeParse(division.rules)
          .success
      )
        context.addIssue({
          code: "custom",
          path: [...path, "rules"],
          message: "rulesInvalid",
        });
    });
  });
export type SeasonInput = z.output<typeof seasonSchema>;
export type SeasonFormInput = z.input<typeof seasonSchema>;
export type DivisionInput = z.output<typeof divisionSchema>;

export function newDivision(
  sport: SeasonInput["sport"],
  scale: readonly string[],
): DivisionInput {
  return {
    name: "",
    sport,
    maxRating: scale.at(-1) ?? "",
    rosterMin: 8,
    rosterMax: 15,
    rules: null,
  };
}
