// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { writeFileSync } from "node:fs";
import en from "@/messages/en.json";
import { LiveGameCard } from "./live-game-card";

afterEach(cleanup);
const game = {
  homeName: "Riyadh Royals",
  awayName: "Yanbu Kings",
  divisionName: "Division B",
  round: 4,
  venue: "Main court",
};
function renderCard(score?: Parameters<typeof LiveGameCard>[0]["score"]) {
  render(
    <NextIntlClientProvider locale="en" messages={en} timeZone="Asia/Riyadh">
      <main className="mx-auto max-w-2xl space-y-8 py-6">
        <ul className="space-y-3">
          <LiveGameCard
            href="/admin/sindikato/games/c7"
            game={game}
            score={score}
          />
        </ul>
      </main>
    </NextIntlClientProvider>,
  );
}

describe("live game card", () => {
  it("shows the score so far and where the game stands", () => {
    renderCard({
      homeScore: 36,
      awayScore: 31,
      status: {
        key: "basketball.quarter",
        values: { period: 3, clock: "4:12" },
      },
    });
    const card = screen.getByRole("link");
    expect(card).toHaveAttribute("href", "/admin/sindikato/games/c7");
    expect(card).toHaveTextContent("Riyadh Royals36");
    expect(card).toHaveTextContent("Yanbu Kings31");
    expect(card).toHaveTextContent("Q3 · 4:12 · Clock stopped");
    expect(card).toHaveTextContent("Division B · Round 4");
    if (process.env.LIVE_PREVIEW)
      writeFileSync(process.env.LIVE_PREVIEW, document.body.innerHTML);
  });
  it("still lists a started game before its score is known", () => {
    renderCard();
    expect(screen.getByRole("link")).toHaveTextContent(en.Schedule.liveNoScore);
  });
});
