// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { createFormatter, createTranslator } from "next-intl";
import { writeFileSync } from "node:fs";
import en from "@/messages/en.json";
import { SeasonCard, type AdminSeason } from "./season-card";

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

const base: AdminSeason = {
  id: "s1",
  name: "Sindikato Cup 2026",
  start_date: "2026-10-01",
  end_date: "2026-12-24",
  divisions: [
    { name: "Division C", max_rating: "C" },
    { name: "Open", max_rating: "A" },
  ],
  phase: "inProgress",
  registration: "open",
  deadline: "2026-11-01T18:00:00Z",
  teams: 8,
  waiting: 2,
  games: 28,
  gamesPlayed: 6,
};
const seasons: AdminSeason[] = [
  base,
  {
    ...base,
    id: "s2",
    name: "Sindikato Cup 2027",
    start_date: "2027-01-15",
    end_date: "2027-04-16",
    phase: "draft",
    registration: "notSetUp",
    deadline: undefined,
    teams: 0,
    waiting: 0,
    games: 0,
    gamesPlayed: 0,
  },
];

async function renderCards() {
  const cards = await Promise.all(
    seasons.map((season) =>
      SeasonCard({ slug: "sindikato", season, today: "2026-10-13" }),
    ),
  );
  render(
    <main className="mx-auto max-w-2xl space-y-6 py-6">
      <ul className="space-y-4">{cards}</ul>
    </main>,
  );
}

describe("season card", () => {
  it("shows a running season's week, counts and registration", async () => {
    await renderCards();
    const card = screen.getByRole("link", { name: /Sindikato Cup 2026/ });
    expect(card).toHaveAttribute("href", "/admin/sindikato/seasons/s1");
    expect(within(card).getByText("In progress")).toBeInTheDocument();
    expect(within(card).getByText("Week 2 of 12")).toBeInTheDocument();
    expect(within(card).getByText("6/28")).toBeInTheDocument();
    expect(
      within(card).getByText("Registration open until Nov 1"),
    ).toBeInTheDocument();
    if (process.env.SEASONS_PREVIEW)
      writeFileSync(process.env.SEASONS_PREVIEW, document.body.innerHTML);
  });
  it("tells the commissioner what is left for a draft", async () => {
    await renderCards();
    const card = screen.getByRole("link", { name: /Sindikato Cup 2027/ });
    expect(within(card).getByText("Draft")).toBeInTheDocument();
    expect(
      within(card).getByText(en.Seasons.nextFinishSetup),
    ).toBeInTheDocument();
    expect(within(card).queryByText(en.Seasons.statTeams)).toBeNull();
  });
});
