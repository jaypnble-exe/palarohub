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
import { createMemoryScorebookStore } from "@/lib/offline/scorebook-store";
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
    suspended: false,
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
    events.push(
      make("roster", {
        team: side,
        players: players.map(({ playerId, name, jersey }) => ({
          playerId,
          name,
          jersey,
        })),
      }),
    );
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
  store = createMemoryScorebookStore(),
) {
  render(
    <NextIntlClientProvider locale="en" messages={en} timeZone="Asia/Riyadh">
      <BasketballScorebook
        supabase={supabase}
        store={store}
        setup={setup}
        log={{ events: saved, pending: [], conflicts: [], alreadySaved: [] }}
      />
    </NextIntlClientProvider>,
  );
  return store;
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
    // The stored snapshot holds only the fields the event schema allows.
    const [roster] = rpc.mock.calls[0][1].p_events;
    expect(Object.keys(roster.payload.players[0])).toEqual([
      "playerId",
      "name",
      "jersey",
    ]);
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

  it("saves each action on the device, then marks it synced", async () => {
    const offline = client({
      error: { message: "TypeError: Failed to fetch" },
    });
    const store = renderBoard(startedGame(), offline.supabase);
    tapPlayer("Royal 1");
    fireEvent.click(screen.getByRole("button", { name: "+2" }));
    await waitFor(() =>
      expect(store.dump().map((row) => row.state)).toEqual(["pending"]),
    );
    cleanup();
    const online = client();
    const again = renderBoard(startedGame(), online.supabase);
    tapPlayer("Royal 1");
    fireEvent.click(screen.getByRole("button", { name: "+3" }));
    await waitFor(() =>
      expect(again.dump().map((row) => row.state)).toEqual(["synced"]),
    );
  });

  it("sends actions left on this device from an earlier visit", async () => {
    const leftover = {
      id: id("f", 1),
      sequence: 100,
      clockMs: null,
      createdAt: "2026-10-23T16:05:00.000Z",
      type: "timeout",
      payload: { team: "home" },
    } as BasketballEvent;
    const { rpc, supabase } = client();
    render(
      <NextIntlClientProvider locale="en" messages={en} timeZone="Asia/Riyadh">
        <BasketballScorebook
          supabase={supabase}
          store={createMemoryScorebookStore()}
          setup={setup}
          log={{
            events: [...startedGame(), leftover],
            pending: [{ event: leftover, period: 1 }],
            conflicts: [],
            alreadySaved: [],
          }}
        />
      </NextIntlClientProvider>,
    );
    await waitFor(() => expect(sentTypes(rpc)).toEqual(["timeout"]));
    expect(rpc.mock.calls[0][1].p_events[0]).toMatchObject({
      id: leftover.id,
      period: 1,
    });
    expect(
      within(homePanel()).getByRole("button", { name: en.Scorer.timeout }),
    ).toBeInTheDocument();
  });

  it("sets aside actions another device already recorded over, without deleting them", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const clash = {
      id: id("f", 2),
      sequence: 2,
      clockMs: null,
      createdAt: "2026-10-23T16:05:00.000Z",
      type: "timeout",
      payload: { team: "away" },
    } as BasketballEvent;
    const store = createMemoryScorebookStore();
    await store.addEvent(setup.gameId, clash, 1);
    render(
      <NextIntlClientProvider locale="en" messages={en} timeZone="Asia/Riyadh">
        <BasketballScorebook
          supabase={client().supabase}
          store={store}
          setup={setup}
          log={{
            events: startedGame(),
            pending: [],
            conflicts: [clash],
            alreadySaved: [],
          }}
        />
      </NextIntlClientProvider>,
    );
    expect(
      screen.getByText(/1 action on this device could not be sent/),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: en.Scorer.setAside }));
    await waitFor(() =>
      expect(screen.queryByText(/could not be sent/)).not.toBeInTheDocument(),
    );
    expect(store.dump()).toMatchObject([{ id: clash.id, state: "discarded" }]);
  });

  function finishedGame() {
    const events = startedGame();
    let sequence = events.length;
    const make = (type: string) =>
      ({
        id: id("d", ++sequence),
        sequence,
        clockMs: null,
        createdAt: "2026-10-23T17:00:00.000Z",
        type,
        payload: {},
      }) as BasketballEvent;
    events.push({
      ...make("score"),
      payload: { team: "home", playerId: id("1", 1), points: 2, made: true },
    } as BasketballEvent);
    events.push(make("period_end"));
    for (let period = 2; period <= 4; period++)
      events.push(make("period_start"), make("period_end"));
    events.push(make("game_end"));
    return events;
  }

  it("sends the finished game to the commissioner once everything is synced", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const { rpc, supabase } = client();
    const events = finishedGame();
    renderBoard(events, supabase);
    fireEvent.click(screen.getByRole("button", { name: en.Scorer.submitGame }));
    expect(
      await screen.findByText(en.Scorer.submittedNote),
    ).toBeInTheDocument();
    expect(rpc).toHaveBeenCalledWith("submit_game", {
      p_game_id: setup.gameId,
      p_last_sequence: events.at(-1)!.sequence,
    });
    expect(screen.getByRole("button", { name: en.Scorer.undo })).toBeDisabled();
  });

  it("explains when the game cannot be sent yet", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const { supabase } = client({
      error: { code: "23514", message: "events_not_synced" },
    });
    renderBoard(finishedGame(), supabase);
    fireEvent.click(screen.getByRole("button", { name: en.Scorer.submitGame }));
    expect(
      await screen.findByText(en.Scorer.submitNotSynced),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: en.Scorer.submitGame }),
    ).toBeEnabled();
  });

  it("shows why a game was reopened and lets the scorer undo the final buzzer", () => {
    render(
      <NextIntlClientProvider locale="en" messages={en} timeZone="Asia/Riyadh">
        <BasketballScorebook
          supabase={client().supabase}
          store={createMemoryScorebookStore()}
          setup={{ ...setup, status: "in_progress" }}
          log={{
            events: finishedGame(),
            pending: [],
            conflicts: [],
            alreadySaved: [],
          }}
          reopenComment="Add the missing free throw."
        />
      </NextIntlClientProvider>,
    );
    expect(
      screen.getByText(/Add the missing free throw\./),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: en.Scorer.undo }));
    expect(
      within(homePanel()).getByRole("button", { name: /Royal 1/ }),
    ).toBeInTheDocument();
  });

  it("locks the scorebook of a game waiting for approval", () => {
    render(
      <NextIntlClientProvider locale="en" messages={en} timeZone="Asia/Riyadh">
        <BasketballScorebook
          supabase={client().supabase}
          store={createMemoryScorebookStore()}
          setup={{ ...setup, status: "submitted" }}
          log={{
            events: finishedGame(),
            pending: [],
            conflicts: [],
            alreadySaved: [],
          }}
        />
      </NextIntlClientProvider>,
    );
    expect(screen.getByText(en.Scorer.submittedNote)).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: en.Scorer.submitGame }),
    ).not.toBeInTheDocument();
  });

  it("does not let a suspended player be marked present", () => {
    const players = setup.teams.home.players.map((player, index) => ({
      ...player,
      suspended: index === 0,
    }));
    render(
      <NextIntlClientProvider locale="en" messages={en} timeZone="Asia/Riyadh">
        <BasketballScorebook
          supabase={client().supabase}
          store={createMemoryScorebookStore()}
          setup={{
            ...setup,
            teams: { ...setup.teams, home: { ...setup.teams.home, players } },
          }}
          log={{ events: [], pending: [], conflicts: [], alreadySaved: [] }}
        />
      </NextIntlClientProvider>,
    );
    const panel = screen.getByRole("region", { name: "Royals" });
    expect(within(panel).getByText(en.Scorer.suspended)).toBeInTheDocument();
    expect(
      within(panel).getAllByRole("button", { name: en.Scorer.markHere }),
    ).toHaveLength(5);
  });
});
