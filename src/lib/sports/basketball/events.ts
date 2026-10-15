import { z } from "zod";
import { gameEventEnvelopeSchema } from "../types";

export const sides = ["home", "away"] as const;
export type Side = (typeof sides)[number];
export const foulKinds = [
  "personal",
  "technical",
  "unsportsmanlike",
  "disqualifying",
  // F on the scoresheet: leaving the bench area during a fight.
  "fighting",
] as const;
export type FoulKind = (typeof foulKinds)[number];
/** Who a team foul without a player is charged to: C or B on the scoresheet. */
export const benchOffenders = ["coach", "bench"] as const;
export type BenchOffender = (typeof benchOffenders)[number];
export const confirmationRoles = [
  "referee",
  "homeCaptain",
  "awayCaptain",
] as const;
export type ConfirmationRole = (typeof confirmationRoles)[number];
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
      shotClockOperator: name.nullable().optional(),
    }),
  ),
  // Head coach, assistant coach and captain, as written at the top of the scoresheet.
  event(
    "team_staff",
    z.strictObject({
      team: side,
      coach: name.nullable(),
      assistantCoach: name.nullable(),
      captainId: playerId.nullable(),
    }),
  ),
  event("period_start", empty),
  event("period_end", empty),
  event("clock_start", empty),
  event("clock_stop", empty),
  event(
    "clock_adjust",
    z.strictObject({
      remainingMs: z.number().int().min(0).max(3_600_000),
      reason: z.string().trim().min(1).max(300),
    }),
  ),
  event(
    "score",
    z.strictObject({
      team: side,
      playerId,
      points: z.union([z.literal(1), z.literal(2), z.literal(3)]),
      made: z.boolean(),
    }),
  ),
  // playerId null is a coach (C) or bench (B) foul, charged to the team.
  // freeThrows is what the opponents shoot for it: P2 on the scoresheet.
  event(
    "foul",
    z
      .strictObject({
        team: side,
        playerId: playerId.nullable(),
        kind: z.enum(foulKinds),
        freeThrows: z.number().int().min(0).max(3).optional(),
        offender: z.enum(benchOffenders).optional(),
      })
      .refine((foul) =>
        foul.playerId
          ? foul.offender === undefined
          : foul.kind !== "personal" && foul.kind !== "unsportsmanlike",
      ),
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
    z
      .strictObject({
        team: side,
        playerId,
        kind: z.enum(statKinds),
        // Optional for legacy stat events, which did not distinguish rebounds.
        reboundType: z.enum(["offensive", "defensive"]).optional(),
        rimHit: z.boolean().optional(),
      })
      .refine(
        (stat) =>
          (stat.kind === "rebound" ||
            (stat.reboundType === undefined && stat.rimHit === undefined)) &&
          (stat.rimHit === undefined || stat.reboundType === "offensive"),
      ),
  ),
  // Sets the possession arrow by hand, to correct it.
  event("possession", z.strictObject({ team: side })),
  // The team that won the opening jump ball; the arrow then points to the other.
  event("jump_ball_won", z.strictObject({ team: side })),
  // A jump-ball situation (held ball, ball stuck on the rim): the arrow's team
  // gets the ball and the arrow flips.
  event("alternating_possession", z.strictObject({ team: side })),
  // The shot clock is reset to this many seconds (24, 14, or what is left).
  event(
    "shot_clock",
    z.strictObject({ seconds: z.number().int().min(0).max(35) }),
  ),
  event("shot_clock_violation", z.strictObject({ team: side })),
  // Referee and captains confirm the result on the scorer's device.
  event(
    "confirmation",
    z.strictObject({ role: z.enum(confirmationRoles), name }),
  ),
  // A captain signs "under protest"; the note says why.
  event(
    "protest",
    z.strictObject({ team: side, note: z.string().trim().max(500) }),
  ),
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
