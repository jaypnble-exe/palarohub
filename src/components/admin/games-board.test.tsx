// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { writeFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { cleanup, render, screen, within } from "@testing-library/react";
import { createFormatter, createTranslator } from "next-intl";
import en from "@/messages/en.json";
import { GamesBoard, type BoardGame } from "./games-board";

vi.mock("next-intl/server", () => ({
  getTranslations: async (namespace: string) =>
    createTranslator({
      locale: "en",
      messages: en,
      namespace: namespace as never,
    }),
  getFormatter: async () =>
    createFormatter({ locale: "en", timeZone: "Asia/Riyadh" }),
}));
afterEach(cleanup);

const game = (
  id: string,
  status: BoardGame["status"],
  extra: Partial<BoardGame> = {},
): BoardGame => ({
  id,
  status,
  scheduledAt: "2026-10-23T16:00:00.000Z",
  venue: "Main court",
  divisionName: "Division B",
  homeName: "Riyadh Royals",
  awayName: "Yanbu Kings",
  homeScore: null,
  awayScore: null,
  outcome: null,
  ...extra,
});
const games = [
  game("s1", "submitted", {
    homeScore: 61,
    awayScore: 55,
    sentAt: "2026-10-23T17:45:00.000Z",
  }),
  game("l1", "in_progress", {
    homeName: "Taif Titans",
    awayName: "Hail Hawks",
  }),
  game("u1", "scheduled", { scheduledAt: "2026-10-30T16:00:00.000Z" }),
  game("a1", "approved", { homeScore: 48, awayScore: 52 }),
  game("a2", "approved", { homeScore: 20, awayScore: 0, outcome: "forfeit" }),
];
const scores = new Map([
  [
    "l1",
    {
      homeScore: 36,
      awayScore: 31,
      status: { key: "basketball.quarterRunning", values: { period: 3 } },
    },
  ],
]);

describe("games board", () => {
  it("puts results to approve first, with counts to jump to each group", async () => {
    render(
      await GamesBoard({ slug: "sindikato", games, scores, approvedLimit: 20 }),
    );
    const jump = screen.getByRole("navigation", { name: en.Review.jump });
    expect(
      within(jump).getByRole("link", { name: /Waiting for you\s*1/ }),
    ).toHaveAttribute("href", "#submitted");
    const waiting = screen.getByRole("region", {
      name: en.Review.group.submitted,
    });
    expect(
      within(waiting).getByRole("link", { name: /Review and approve/ }),
    ).toHaveAttribute("href", "/admin/sindikato/games/s1");
    expect(within(waiting).getByText("61")).toBeInTheDocument();
  });
  it("shows the live score, period, and a TV link for games being played", async () => {
    render(
      await GamesBoard({ slug: "sindikato", games, scores, approvedLimit: 20 }),
    );
    const live = screen.getByRole("region", {
      name: en.Review.group.in_progress,
    });
    expect(within(live).getByText("36")).toBeInTheDocument();
    expect(within(live).getByText("Q3 · Clock running")).toBeInTheDocument();
    expect(
      within(live).getByRole("link", { name: /TV screen/ }),
    ).toHaveAttribute("href", "/tv/l1");
  });
  it("marks forfeits among approved results and says when all is done", async () => {
    render(
      await GamesBoard({
        slug: "sindikato",
        games: games.filter((item) => item.status !== "submitted"),
        scores,
        approvedLimit: 20,
      }),
    );
    expect(screen.getByText(en.Review.allCaughtUp)).toBeInTheDocument();
    const approved = screen.getByRole("region", {
      name: en.Review.group.approved,
    });
    expect(within(approved).getByText("Forfeit")).toBeInTheDocument();
  });
  it("writes a static preview for visual checks when asked", async () => {
    if (!process.env.GAMES_PREVIEW) return;
    writeFileSync(
      process.env.GAMES_PREVIEW,
      renderToStaticMarkup(
        await GamesBoard({
          slug: "sindikato",
          games,
          scores,
          approvedLimit: 20,
        }),
      ),
    );
  });
});
