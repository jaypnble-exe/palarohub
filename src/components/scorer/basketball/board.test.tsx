// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import en from "@/messages/en.json";
import type { ScorerSetup } from "@/lib/game-events";
import {
  defaultBasketballRules,
  type BasketballEvent,
} from "@/lib/sports/basketball";
import type { createClient } from "@/lib/supabase/browser";
import { BasketballScorebook } from "./board";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const id = (prefix: string, n: number) =>
  `${prefix}0000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const roster = (prefix: string, name: string) =>
  Array.from({ length: 6 }, (_, i) => ({
    playerId: id(prefix, i + 1),
    name: `${name} ${i + 1}`,
    jersey: i + 4,
  }));
const setup: ScorerSetup = {
  gameId: id("9", 1),
  leagueId: id("8", 1),
  leagueName: "Sindikato",
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
      players: roster("1", "Royal"),
    },
    away: {
      seasonTeamId: id("7", 2),
      name: "Hawks",
      players: roster("2", "Hawk"),
    },
  },
};

/** Saved events for a game already at tip-off. */
function startedGame(): BasketballEvent[] {
  let sequence = 0;
  const make = (type: string, payload: object) =>
    ({
      id: id("e", ++sequence),
      sequence,
      clockMs: null,
      createdAt: "2026-10-23T16:00:00.000Z",
      type,
      payload,
    }) as BasketballEvent;
  const events: BasketballEvent[] = [];
  for (const side of ["home", "away"] as const) {
    const players = setup.teams[side].players;
    events.push(make("roster", { team: side, players }));
    for (const player of players)
      events.push(make("checkin", { team: side, playerId: player.playerId }));
    events.push(
      make("starters", {
        team: side,
        playerIds: players.slice(0, 5).map((player) => player.playerId),
      }),
    );
  }
  events.push(make("period_start", {}));
  return events;
}

function client(
  result: { error: { code?: string; message: string } | null } = {
    error: null,
  },
) {
  const rpc = vi.fn().mockResolvedValue({ data: 1, ...result });
  return {
    rpc,
    supabase: { rpc } as unknown as ReturnType<typeof createClient>,
  };
}
function renderBoard(
  saved: BasketballEvent[] = [],
  supabase = client().supabase,
) {
  render(
    <NextIntlClientProvider locale="en" messages={en} timeZone="Asia/Riyadh">
      <BasketballScorebook supabase={supabase} setup={setup} saved={saved} />
    </NextIntlClientProvider>,
  );
}
const sentTypes = (rpc: ReturnType<typeof vi.fn>) =>
  rpc.mock.calls.flatMap(([, args]) =>
    (args.p_events as { type: string }[]).map((event) => event.type),
  );
const homePanel = () => screen.getByRole("region", { name: "Royals" });
const tapPlayer = (name: string) =>
  fireEvent.click(
    within(homePanel()).getByRole("button", { name: new RegExp(name) }),
  );

describe("basketball scorer screen", () => {
  it("freezes rosters, checks players in, and tips off", async () => {
    const { rpc, supabase } = client();
    renderBoard([], supabase);
    await waitFor(() => expect(sentTypes(rpc)).toEqual(["roster", "roster"]));
    for (const side of ["Royals", "Hawks"]) {
      const panel = screen.getByRole("region", { name: side });
      for (const button of within(panel).getAllByRole("button", {
        name: en.Scorer.markHere,
      }))
        fireEvent.click(button);
      const starters = within(panel).getAllByRole("button", {
        name: en.Scorer.starter,
      });
      starters.slice(0, 5).forEach((button) => fireEvent.click(button));
      fireEvent.click(
        within(panel).getByRole("button", {
          name: /Confirm starting five \(5 of 5\)/,
        }),
      );
    }
    fireEvent.click(screen.getByRole("button", { name: en.Scorer.tipOff }));
    expect(await screen.findByText("Q1")).toBeInTheDocument();
    expect(
      within(homePanel()).getByRole("button", { name: /Royal 1/ }),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent(
        en.Scorer.sync.synced,
      ),
    );
    expect(sentTypes(rpc).filter((type) => type === "checkin")).toHaveLength(
      12,
    );
  });

  it("scores in two taps and undoes the last action", async () => {
    renderBoard(startedGame());
    tapPlayer("Royal 1");
    fireEvent.click(screen.getByRole("button", { name: "+3" }));
    const scores = () => screen.getByRole("banner");
    expect(within(scores()).getByText("3")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: en.Scorer.undo }));
    expect(within(scores()).queryByText("3")).not.toBeInTheDocument();
  });

  it("warns on a player's 4th foul and when a team reaches the penalty", async () => {
    renderBoard(startedGame());
    for (let foul = 0; foul < 4; foul++) {
      tapPlayer("Royal 1");
      fireEvent.click(
        screen.getByRole("button", { name: en.Scorer.personalFoul }),
      );
    }
    expect(
      await screen.findByText("#4 Royal 1 has 4 fouls."),
    ).toBeInTheDocument();
    expect(screen.getByText(/Royals is in the penalty/)).toBeInTheDocument();
    expect(
      within(screen.getByRole("banner")).getByText(en.Scorer.penalty),
    ).toBeInTheDocument();
  });

  it("blocks a timeout when none are left, with a plain reason", () => {
    renderBoard(startedGame());
    const timeout = () =>
      within(homePanel()).getByRole("button", { name: en.Scorer.timeout });
    fireEvent.click(timeout());
    fireEvent.click(timeout());
    fireEvent.click(timeout());
    expect(
      screen.getByText(en.Scorer.errors.noTimeoutsLeft),
    ).toBeInTheDocument();
  });

  it("substitutes from the bench", () => {
    renderBoard(startedGame());
    const onCourt = () =>
      within(homePanel())
        .getAllByRole("button", { name: /pts/ })
        .map((button) => /Royal \d/.exec(button.textContent ?? "")?.[0]);
    expect(onCourt()).toEqual([
      "Royal 1",
      "Royal 2",
      "Royal 3",
      "Royal 4",
      "Royal 5",
    ]);
    tapPlayer("Royal 2");
    fireEvent.click(screen.getByRole("button", { name: en.Scorer.substitute }));
    fireEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "#9 Royal 6",
      }),
    );
    expect(onCourt()).toEqual([
      "Royal 1",
      "Royal 6",
      "Royal 3",
      "Royal 4",
      "Royal 5",
    ]);
  });

  it("keeps actions on the device while the connection is down", async () => {
    const { supabase } = client({
      error: { message: "TypeError: Failed to fetch" },
    });
    renderBoard(startedGame(), supabase);
    tapPlayer("Royal 1");
    fireEvent.click(screen.getByRole("button", { name: "+2" }));
    expect(
      await screen.findByText("1 action saved on this device"),
    ).toBeInTheDocument();
  });

  it("stops recording when another device takes over", async () => {
    const { supabase } = client({
      error: { code: "42501", message: "scorer_required" },
    });
    renderBoard(startedGame(), supabase);
    tapPlayer("Royal 1");
    fireEvent.click(screen.getByRole("button", { name: "+2" }));
    expect(
      await screen.findByText(en.Scorer.blocked.replaced),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: en.Scorer.undo })).toBeDisabled();
  });

  it("removes an older action from the play-by-play after confirming", () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    renderBoard(startedGame());
    tapPlayer("Royal 1");
    fireEvent.click(screen.getByRole("button", { name: "+2" }));
    fireEvent.click(
      within(homePanel()).getByRole("button", { name: en.Scorer.timeout }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: en.Scorer.showPlayByPlay }),
    );
    const list = screen.getByRole("region", { name: en.Scorer.playByPlay });
    const basket = within(list).getByText("#4 Royal 1 +2").closest("li")!;
    fireEvent.click(
      within(basket).getByRole("button", { name: en.Scorer.remove }),
    );
    expect(
      within(list).getByText("Removed: #4 Royal 1 +2"),
    ).toBeInTheDocument();
    expect(
      within(screen.getByRole("banner")).queryByText("2"),
    ).not.toBeInTheDocument();
  });
});
