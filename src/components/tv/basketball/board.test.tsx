// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import en from "@/messages/en.json";
import { defaultBasketballRules } from "@/lib/sports/basketball";
import type { TvEventRow, TvGame } from "@/lib/tv-feed";
import { BasketballTv } from "./board";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

/** The seeded live game (Royals 36, Kings 31, Q3 4:12) as the TV feed sends it. */
function seededRows(): TvEventRow[] {
  const seed = readFileSync(join(process.cwd(), "supabase/seed.sql"), "utf8");
  const row =
    /\('(e0000000-[0-9a-f-]{27})',(\d+),'([a-z_]+)','((?:[^']|'')*)'::jsonb,(null|\d+),(\d+),(\d+)\)/g;
  return [...seed.matchAll(row)].map((match) => {
    const at = new Date(
      Date.UTC(2026, 9, 23, 17) - Number(match[7]) * 1000,
    ).toISOString();
    return {
      id: match[1],
      sequence: Number(match[2]),
      type: match[3],
      payload: JSON.parse(match[4].replaceAll("''", "'")),
      clockMs: match[5] === "null" ? null : Number(match[5]),
      occurredAt: at,
      createdAt: at,
    };
  });
}
const game: TvGame = {
  id: "c0000000-0000-4000-8000-000000000007",
  status: "in_progress",
  scheduledAt: "2026-10-23T16:20:00Z",
  venue: "Main court",
  round: null,
  leagueName: "Sindikato",
  leagueSlug: "sindikato",
  seasonName: "Sindikato Cup 2026",
  divisionName: "Division B",
  sport: "basketball",
  rules: defaultBasketballRules,
  homeName: "Riyadh Royals",
  awayName: "Yanbu Kings",
};
function show(rows: TvEventRow[]) {
  return (
    <NextIntlClientProvider locale="en" messages={en} timeZone="Asia/Riyadh">
      <BasketballTv game={game} rows={rows} screenOffsetMs={0} />
    </NextIntlClientProvider>
  );
}

describe("TV scoreboard", () => {
  it("applies a logged time correction without changing the score or shot clock", () => {
    const rows = seededRows();
    const view = render(show(rows));
    const shotClock = screen.getByLabelText(en.Tv.shotClock).textContent;
    const last = rows.at(-1)!;
    view.rerender(
      show([
        ...rows,
        {
          id: "e0000000-0000-4000-8000-000000000904",
          sequence: last.sequence + 1,
          type: "clock_adjust",
          payload: { remainingMs: 155400, reason: "Referee correction" },
          clockMs: 252000,
          occurredAt: last.occurredAt,
          createdAt: last.createdAt,
        },
      ]),
    );
    expect(screen.getByText("2:36")).toBeInTheDocument();
    expect(screen.getByLabelText(en.Tv.shotClock)).toHaveTextContent(
      shotClock!,
    );
    expect(
      within(screen.getByRole("region", { name: "Riyadh Royals" })).getByText(
        "36",
      ),
    ).toBeInTheDocument();
  });
  it("hides the shot clock at 24 seconds and restores it in the next quarter", () => {
    vi.useFakeTimers();
    const rows = seededRows();
    const last = rows.at(-1)!;
    const at = new Date().toISOString();
    const action = (
      sequence: number,
      type: string,
      clockMs: number | null,
      payload: object = {},
    ): TvEventRow => ({
      id: `e0000000-0000-4000-8000-${String(sequence).padStart(12, "0")}`,
      sequence,
      type,
      clockMs,
      payload,
      occurredAt: at,
      createdAt: at,
    });
    const live = [
      ...rows,
      action(last.sequence + 1, "shot_clock", 25_000, { seconds: 24 }),
      action(last.sequence + 2, "clock_start", 25_000),
    ];
    const view = render(show(live));
    expect(screen.getByLabelText(en.Tv.shotClock)).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(1000));
    expect(screen.queryByLabelText(en.Tv.shotClock)).toBeNull();
    expect(screen.getByText("24.0")).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(1000));
    expect(screen.getByText("23.0")).toBeInTheDocument();
    view.rerender(
      show([
        ...live,
        action(last.sequence + 3, "clock_stop", 0),
        action(last.sequence + 4, "period_end", 0),
        action(last.sequence + 5, "period_start", null),
      ]),
    );
    expect(screen.getByText("Q4")).toBeInTheDocument();
    expect(screen.getByLabelText(en.Tv.shotClock)).toHaveTextContent("24");
  });
  it("shows the automatic reset from a recorded rebound without a separate clock action", () => {
    const rows = seededRows();
    const view = render(show(rows));
    const last = rows.at(-1)!;
    const rebound: TvEventRow = {
      id: "e0000000-0000-4000-8000-000000000903",
      sequence: last.sequence + 1,
      type: "stat",
      payload: {
        team: "home",
        playerId: "90000000-0000-4000-8000-000000000102",
        kind: "rebound",
        reboundType: "offensive",
        rimHit: true,
      },
      clockMs: 252000,
      occurredAt: last.occurredAt,
      createdAt: last.createdAt,
    };
    view.rerender(show([...rows, rebound]));
    expect(screen.getByLabelText(en.Tv.shotClock)).toHaveTextContent("14");
    expect(screen.getByText("4:12")).toBeInTheDocument();
  });
  it("rotates sponsors every eight seconds while keeping the scoreboard visible", () => {
    vi.useFakeTimers();
    render(show(seededRows()));
    const sponsor = screen.getByRole("complementary", {
      name: en.Tv.sponsoredBy,
    });
    expect(sponsor).toHaveTextContent("Giordano");
    act(() => vi.advanceTimersByTime(8000));
    expect(sponsor).toHaveTextContent("BPI");
    act(() => vi.advanceTimersByTime(8000));
    expect(sponsor).toHaveTextContent("McDonald's");
    act(() => vi.advanceTimersByTime(8000));
    expect(sponsor).toHaveTextContent("Giordano");
    expect(screen.getByText("4:12")).toBeInTheDocument();
    expect(screen.getByText(en.Tv.timeoutBanner)).toBeInTheDocument();
  });

  it("shows the score, the clock and each team's fouls and timeouts", () => {
    render(show(seededRows()));
    const royals = screen.getByRole("region", { name: "Riyadh Royals" });
    const kings = screen.getByRole("region", { name: "Yanbu Kings" });
    expect(within(royals).getByText("36")).toBeInTheDocument();
    expect(within(kings).getByText("31")).toBeInTheDocument();
    expect(screen.getByText("4:12")).toBeInTheDocument();
    expect(screen.getByText("Q3")).toBeInTheDocument();
    expect(within(kings).getByText(en.Tv.bonus)).toBeInTheDocument();
    // The game paused for a Royals timeout.
    expect(screen.getByText(en.Tv.timeoutBanner)).toBeInTheDocument();
    if (process.env.TV_PREVIEW)
      writeFileSync(process.env.TV_PREVIEW, document.body.innerHTML);
  });

  it("flashes what happens while it is on, not the game so far", () => {
    const rows = seededRows();
    const view = render(show(rows));
    expect(screen.queryByRole("status")).toBeNull();
    const last = rows.at(-1)!;
    const at = new Date(Date.parse(last.occurredAt) + 5000).toISOString();
    view.rerender(
      show([
        ...rows,
        {
          id: "e0000000-0000-4000-8000-000000000901",
          sequence: last.sequence + 1,
          type: "clock_start",
          payload: {},
          clockMs: 252000,
          occurredAt: at,
          createdAt: at,
        },
        {
          id: "e0000000-0000-4000-8000-000000000902",
          sequence: last.sequence + 2,
          type: "score",
          payload: {
            team: "home",
            playerId: "90000000-0000-4000-8000-000000000102",
            points: 3,
            made: true,
          },
          clockMs: 240000,
          occurredAt: at,
          createdAt: at,
        },
      ]),
    );
    expect(screen.getByRole("status")).toHaveTextContent("Three! #2 Dela Cruz");
    if (process.env.TV_FLASH_PREVIEW)
      writeFileSync(process.env.TV_FLASH_PREVIEW, document.body.innerHTML);
    expect(
      within(screen.getByRole("region", { name: "Riyadh Royals" })).getByText(
        "39",
      ),
    ).toBeInTheDocument();
  });
});
