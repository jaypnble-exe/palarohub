import { z } from "zod";
import { gameEventEnvelopeSchema } from "../types";

export const sides = ["home", "away"] as const;
export type Side = (typeof sides)[number];
export const foulKinds = [
  "personal",
  "technical",
  "unsportsmanlike",
  "disqualifying",
] as const;
export type FoulKind = (typeof foulKinds)[number];
export const statKinds = [
  "rebound",
  "assist",
  "steal",
  "block",
  "turnover",
] as const;
export type StatKind = (typeof statKinds)[number];

const side = z.enum(sides);
const playerId = z.uuid();
const name = z.string().trim().min(1).max(100);
const jersey = z.number().int().min(0).max(999);
const empty = z.strictObject({});

function event<T extends string, P extends z.ZodType>(type: T, payload: P) {
  return gameEventEnvelopeSchema.extend({
    type: z.literal(type),
    payload,
  });
}

/** Every basketball action the scorer can record, as stored in game_events. */
export const basketballEventSchema = z.discriminatedUnion("type", [
  // Approved roster snapshot for one team, taken when the game is opened.
  event(
    "roster",
    z.strictObject({
      team: side,
      players: z
        .array(z.strictObject({ playerId, name, jersey }))
        .max(50)
        .refine(
          (players) =>
            new Set(players.map((player) => player.playerId)).size ===
            players.length,
        ),
    }),
  ),
  event("checkin", z.strictObject({ team: side, playerId })),
  // Jersey number for this game only.
  event("jersey", z.strictObject({ team: side, playerId, number: jersey })),
  event(
    "starters",
    z.strictObject({ team: side, playerIds: z.array(playerId).max(5) }),
  ),
  event(
    "officials",
    z.strictObject({
      referees: z.array(name).max(3),
      scorer: name.nullable(),
      timekeeper: name.nullable(),
    }),
  ),
  event("period_start", empty),
  event("period_end", empty),
  event("clock_start", empty),
  event("clock_stop", empty),
  event(
    "score",
    z.strictObject({
      team: side,
      playerId,
      points: z.union([z.literal(1), z.literal(2), z.literal(3)]),
      made: z.boolean(),
    }),
  ),
  // playerId null is a coach or bench technical, charged to the team.
  event(
    "foul",
    z
      .strictObject({
        team: side,
        playerId: playerId.nullable(),
        kind: z.enum(foulKinds),
      })
      .refine((foul) => foul.playerId || foul.kind === "technical"),
  ),
  event(
    "substitution",
    z
      .strictObject({ team: side, out: playerId, in: playerId })
      .refine((sub) => sub.out !== sub.in),
  ),
  event("timeout", z.strictObject({ team: side })),
  event(
    "stat",
    z.strictObject({ team: side, playerId, kind: z.enum(statKinds) }),
  ),
  event("possession", z.strictObject({ team: side })),
  event("game_end", empty),
  // Corrections never delete: a void hides one earlier event.
  event("void", z.strictObject({ eventId: z.uuid() })),
]);

export type BasketballEvent = z.output<typeof basketballEventSchema>;
export type BasketballEventType = BasketballEvent["type"];
export type BasketballEventOf<T extends BasketballEventType> = Extract<
  BasketballEvent,
  { type: T }
>;
