// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { writeFileSync } from "node:fs";
import en from "@/messages/en.json";
import { groupMemberships, workspacesFor } from "@/lib/league-list";
import { displayNameOf } from "@/lib/user-name";
import { LeagueCard } from "./league-card";

afterEach(cleanup);
const sindikato = {
  id: "l1",
  name: "Sindikato",
  slug: "sindikato",
  sport: "basketball",
};
const riyadh = {
  id: "l2",
  name: "Riyadh Pinoy League",
  slug: "rpl",
  sport: "basketball",
};

describe("grouping memberships", () => {
  it("gives one league per entry with every role, sorted by name", () => {
    expect(
      groupMemberships([
        { role: "team_manager", leagues: sindikato },
        { role: "commissioner", leagues: sindikato },
        { role: "team_manager", leagues: riyadh },
        { role: "commissioner", leagues: null },
      ]),
    ).toEqual([
      { ...riyadh, roles: ["team_manager"] },
      { ...sindikato, roles: ["commissioner", "team_manager"] },
    ]);
  });
  it("opens the dashboard and the team area for someone with both roles", () => {
    expect(
      workspacesFor({
        slug: "sindikato",
        roles: ["commissioner", "team_manager"],
      }),
    ).toEqual([
      { kind: "admin", href: "/admin/sindikato" },
      { kind: "team", href: "/team/sindikato" },
    ]);
    expect(workspacesFor({ slug: "rpl", roles: ["team_manager"] })).toEqual([
      { kind: "team", href: "/team/rpl" },
    ]);
  });
});

describe("display names", () => {
  it("prefers the sign-up name and falls back to the email", () => {
    expect(
      displayNameOf({
        email: "pj@example.test",
        user_metadata: { full_name: " Pejay Paronable " },
      }),
    ).toBe("Pejay Paronable");
    expect(displayNameOf({ email: "pj@example.test", user_metadata: {} })).toBe(
      "pj",
    );
  });
});

describe("league card", () => {
  function renderCards() {
    render(
      <NextIntlClientProvider locale="en" messages={en} timeZone="Asia/Riyadh">
        <main className="mx-auto max-w-2xl space-y-6 py-8">
          <ul className="space-y-4">
            {groupMemberships([
              { role: "commissioner", leagues: sindikato },
              { role: "team_manager", leagues: sindikato },
              { role: "team_manager", leagues: riyadh },
            ]).map((league) => (
              <LeagueCard key={league.id} league={league} />
            ))}
          </ul>
        </main>
      </NextIntlClientProvider>,
    );
  }
  it("shows the sport, the roles and a button for each area", () => {
    renderCards();
    const card = screen
      .getByRole("heading", { name: "Sindikato" })
      .closest("li") as HTMLElement;
    expect(within(card).getByText("Basketball")).toBeInTheDocument();
    expect(within(card).getByText("Commissioner")).toBeInTheDocument();
    expect(
      within(card).getByRole("link", { name: en.MyLeagues.openDashboard }),
    ).toHaveAttribute("href", "/admin/sindikato");
    expect(
      within(card).getByRole("link", { name: en.MyLeagues.openTeam }),
    ).toHaveAttribute("href", "/team/sindikato");
    expect(
      within(card).getByRole("link", { name: en.MyLeagues.publicPage }),
    ).toHaveAttribute("href", "/sindikato");
    if (process.env.LEAGUES_PREVIEW)
      writeFileSync(process.env.LEAGUES_PREVIEW, document.body.innerHTML);
  });
  it("gives a team manager only their team area", () => {
    renderCards();
    const card = screen
      .getByRole("heading", { name: "Riyadh Pinoy League" })
      .closest("li") as HTMLElement;
    expect(
      within(card).queryByRole("link", { name: en.MyLeagues.openDashboard }),
    ).toBeNull();
    expect(
      within(card).getByRole("link", { name: en.MyLeagues.openTeam }),
    ).toHaveAttribute("href", "/team/rpl");
  });
});
