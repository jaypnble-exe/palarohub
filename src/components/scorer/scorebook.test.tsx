// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import en from "@/messages/en.json";
import type { ScorerSetup } from "@/lib/game-events";
import { defaultBasketballRules } from "@/lib/sports/basketball";
import { Scorebook } from "./scorebook";

const id = (prefix: string, n: number) =>
  `${prefix}0000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const players = (prefix: string, name: string) =>
  Array.from({ length: 6 }, (_, i) => ({
    playerId: id(prefix, i + 1),
    name: `${name} ${i + 1}`,
    jersey: i + 4,
    suspended: false,
  }));
const gameId = id("9", 1);
const setup: ScorerSetup = {
  gameId,
  leagueId: id("8", 1),
  leagueName: "Sindikato",
  paymentPolicy: "warn",
  seasonName: "Cup",
  divisionName: "Division B",
  sport: "basketball",
  rules: defaultBasketballRules,
  scheduledAt: null,
  venue: "Main court",
  status: "scheduled",
  teams: {
    home: {
      seasonTeamId: id("7", 1),
      name: "Royals",
      payment: null,
      players: players("1", "Royal"),
    },
    away: {
      seasonTeamId: id("7", 2),
      name: "Hawks",
      payment: null,
      players: players("2", "Hawk"),
    },
  },
};

/** A Supabase stand-in: a signed-in commissioner who may or may not be the scorer yet. */
function fakeSupabase(initiallyScorer: boolean) {
  let scorer = initiallyScorer;
  const realtime = {
    on: vi.fn(),
    subscribe: vi.fn(),
    send: vi.fn().mockResolvedValue("ok"),
  };
  realtime.on.mockReturnValue(realtime);
  realtime.subscribe.mockReturnValue(realtime);
  const rpc = vi.fn(async (name: string) => {
    if (name === "scorer_game_setup") return { data: setup, error: null };
    if (name === "claim_scorer_access") {
      scorer = true;
      return { data: "granted", error: null };
    }
    return { data: 1, error: null };
  });
  const from = vi.fn((table: string) => {
    const result =
      table === "game_scorers"
        ? { data: scorer ? { user_id: "staff" } : null, error: null }
        : { data: table === "game_events" ? [] : null, error: null };
    const chain: Record<string, unknown> = {};
    for (const method of ["select", "eq", "is", "order", "limit"])
      chain[method] = () => chain;
    chain.maybeSingle = async () => result;
    chain.then = (resolve: (value: unknown) => unknown) => resolve(result);
    return chain;
  });
  return {
    channel: vi.fn(() => realtime),
    removeChannel: vi.fn().mockResolvedValue("ok"),
    rpc,
    from,
    auth: {
      getSession: async () => ({
        data: { session: { user: { id: "staff", is_anonymous: false } } },
      }),
      signInAnonymously: vi.fn(),
    },
  };
}
let client = fakeSupabase(false);
vi.mock("@/lib/supabase/browser", () => ({ createClient: () => client }));
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
function renderScorebook() {
  render(
    <NextIntlClientProvider locale="en" messages={en} timeZone="Asia/Riyadh">
      <Scorebook gameId={gameId} />
    </NextIntlClientProvider>,
  );
}

describe("opening the scorebook as league staff", () => {
  it("asks before scoring, so opening a game never takes it over", async () => {
    client = fakeSupabase(false);
    renderScorebook();
    expect(
      await screen.findByRole("heading", { name: en.Scorer.staffTitle }),
    ).toBeInTheDocument();
    expect(screen.getByText(en.Scorer.staffNotScorer)).toBeInTheDocument();
    expect(client.rpc).not.toHaveBeenCalledWith(
      "claim_scorer_access",
      expect.anything(),
    );
  });
  it("makes this device the scorer when asked, then opens the game", async () => {
    client = fakeSupabase(false);
    renderScorebook();
    fireEvent.click(
      await screen.findByRole("button", { name: en.Scorer.scoreHere }),
    );
    expect(
      await screen.findByRole("region", { name: "Royals" }),
    ).toBeInTheDocument();
    expect(client.rpc).toHaveBeenCalledWith("claim_scorer_access", {
      p_game_id: gameId,
      p_pin: undefined,
    });
  });
  it("goes straight to the game when this device already scores it", async () => {
    client = fakeSupabase(true);
    renderScorebook();
    expect(
      await screen.findByRole("region", { name: "Royals" }),
    ).toBeInTheDocument();
  });
});
