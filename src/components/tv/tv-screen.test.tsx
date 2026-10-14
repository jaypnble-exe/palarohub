// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextIntlClientProvider } from "next-intl";
import en from "@/messages/en.json";
import { gameLiveChannel } from "@/lib/game-live";
import { TvScreen } from "./tv-screen";

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  send: vi.fn(),
  close: vi.fn(),
}));
vi.mock("@/lib/supabase/browser", () => ({
  createClient: () => ({ rpc: mocks.rpc }),
}));
vi.mock("@/lib/game-live", async (original) => ({
  ...(await original<typeof import("@/lib/game-live")>()),
  gameLiveChannel: vi.fn(() => ({ send: mocks.send, close: mocks.close })),
}));
vi.mock("./basketball/board", () => ({
  BasketballTv: ({
    rows,
    scorerTimeOffsetMs,
  }: {
    rows: { sequence: number }[];
    scorerTimeOffsetMs?: number;
  }) => (
    <div data-testid="board" data-offset={scorerTimeOffsetMs}>
      {rows.at(-1)?.sequence ?? 0}
    </div>
  ),
}));
const gameId = "c0000000-0000-4000-8000-000000000007";
const eventId = "e0000000-0000-4000-8000-000000000001";
const feed = (sequence = 1) => ({
  data: {
    game: {
      id: gameId,
      status: "in_progress",
      scheduledAt: null,
      venue: "Court",
      round: null,
      leagueName: "Sindikato",
      leagueSlug: "sindikato",
      seasonName: "Cup",
      divisionName: "Open",
      sport: "basketball",
      rules: {},
      homeName: "Home",
      awayName: "Away",
    },
    serverTime: new Date().toISOString(),
    events: [
      {
        id: eventId,
        sequence,
        type: "clock_start",
        payload: {},
        clockMs: 300000,
        occurredAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      },
    ],
  },
  error: null,
});
const handlers = () => vi.mocked(gameLiveChannel).mock.calls.at(-1)![2];
async function show() {
  await act(async () => {
    render(
      <NextIntlClientProvider locale="en" messages={en}>
        <TvScreen gameId={gameId} />
      </NextIntlClientProvider>,
    );
  });
}
beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  mocks.rpc.mockResolvedValue(feed());
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("TV live updates", () => {
  it("fetches saved actions immediately instead of waiting for the polling interval", async () => {
    await show();
    await act(async () => handlers().connected?.(true));
    const calls = mocks.rpc.mock.calls.length;
    mocks.rpc.mockResolvedValue(feed(2));
    await act(async () => handlers().saved?.());
    expect(mocks.rpc).toHaveBeenCalledTimes(calls + 1);
    expect(mocks.rpc).toHaveBeenLastCalledWith("tv_game", {
      p_game_id: gameId,
      p_after: 1,
    });
    expect(screen.getByTestId("board")).toHaveTextContent("2");
  });

  it("polls every 250 ms if the live connection is unavailable", async () => {
    await show();
    await act(async () => vi.advanceTimersByTimeAsync(250));
    expect(mocks.rpc).toHaveBeenCalledTimes(2);
  });

  it("coalesces notifications while a request is in flight", async () => {
    let resolve!: (value: ReturnType<typeof feed>) => void;
    mocks.rpc.mockImplementationOnce(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
    await show();
    await act(async () => {
      handlers().saved?.();
      handlers().saved?.();
    });
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
    await act(async () => resolve(feed()));
    await act(async () => vi.advanceTimersByTimeAsync(0));
    expect(mocks.rpc).toHaveBeenCalledTimes(2);
  });

  it("calibrates against the scorer and ignores replies for other event histories", async () => {
    await show();
    await act(async () => vi.advanceTimersByTimeAsync(2000));
    const [, request] = mocks.send.mock.calls.at(-1)!;
    const sent = Date.now();
    await act(async () => vi.advanceTimersByTimeAsync(200));
    const reply = {
      requestId: request.requestId,
      eventId,
      receivedAt: sent + 30100,
      repliedAt: sent + 30100,
    };
    await act(async () =>
      handlers().clockReply?.({ ...reply, eventId: gameId }),
    );
    expect(screen.getByTestId("board")).not.toHaveAttribute("data-offset");
    await act(async () => handlers().clockReply?.(reply));
    expect(screen.getByTestId("board")).toHaveAttribute("data-offset", "30000");
  });

  it("recovers from a thrown network error and cleans up live connections", async () => {
    mocks.rpc.mockRejectedValueOnce(new Error("network"));
    await show();
    await act(async () => vi.advanceTimersByTimeAsync(1000));
    expect(screen.getByTestId("board")).toBeInTheDocument();
    cleanup();
    expect(mocks.close).toHaveBeenCalledTimes(1);
    const calls = mocks.rpc.mock.calls.length;
    await act(async () => vi.advanceTimersByTimeAsync(10000));
    expect(mocks.rpc).toHaveBeenCalledTimes(calls);
  });
});
