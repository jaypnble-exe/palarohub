// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { writeFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { cleanup, render, screen, within } from "@testing-library/react";
import {
  NextIntlClientProvider,
  createFormatter,
  createTranslator,
} from "next-intl";
import en from "@/messages/en.json";
import { paymentStatus } from "@/lib/domain/payments";
import type { ManagerOverview, ManagerRegistration } from "@/lib/team-data";
import { activeNavTab } from "@/components/ui/app-nav";
import { RegistrationStatus } from "./registration-status";
import { TeamHome } from "./team-home";
import { TeamNav } from "./team-nav";
import { managerTodos } from "./todos";

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
vi.mock("next/navigation", () => ({ usePathname: () => "/team/sindikato" }));
afterEach(cleanup);

const registration = (
  id: string,
  teamName: string,
  status: ManagerRegistration["status"],
  extra: Partial<ManagerRegistration> = {},
): ManagerRegistration => ({
  id,
  teamName,
  status,
  reviewComment: "",
  seasonId: "s1",
  seasonName: "Sindikato Cup 2026",
  divisionName: "Division B",
  changePending: false,
  ...extra,
});
const overview: ManagerOverview = {
  registrations: [
    registration("r1", "Riyadh Royals", "approved"),
    registration("r2", "Royals B", "returned", {
      reviewComment: "Please fix jersey number 7.",
    }),
  ],
  openSeasons: [
    {
      seasonId: "s2",
      seasonName: "Sindikato Cup 2027",
      deadline: "2027-01-10T18:00:00.000Z",
      feeHalalas: 180000,
      registered: false,
    },
  ],
  games: [
    {
      id: "g0",
      registrationId: "r1",
      round: 1,
      scheduledAt: "2026-10-23T16:00:00.000Z",
      venue: "Main court",
      status: "approved",
      homeName: "Riyadh Royals",
      awayName: "Hail Hawks",
      homeScore: 61,
      awayScore: 55,
    },
    {
      id: "g1",
      registrationId: "r1",
      round: 2,
      scheduledAt: "2026-10-30T16:00:00.000Z",
      venue: "Main court",
      status: "scheduled",
      homeName: "Yanbu Kings",
      awayName: "Riyadh Royals",
    },
  ],
  payments: [
    {
      seasonTeamId: "r1",
      teamName: "Riyadh Royals",
      divisionName: "Division B",
      quotaHalalas: 180000,
      paidHalalas: 0,
      finesHalalas: 0,
      gamesPlayed: 1,
      gamesTotal: 12,
      entries: [],
      status: paymentStatus({
        quotaHalalas: 180000,
        paidHalalas: 0,
        finesHalalas: 0,
        gamesTotal: 12,
        gamesCounted: 1,
      }),
    },
  ],
};
const homeProps = {
  slug: "sindikato",
  leagueName: "Sindikato",
  overview,
  canView: false,
};

describe("team manager to-do list", () => {
  it("puts league requests first, then drafts, money, and open seasons", () => {
    const todos = managerTodos(
      "sindikato",
      [
        registration("d1", "Draft Team", "draft"),
        registration("r2", "Royals B", "returned", { reviewComment: "Fix #7" }),
        registration("a1", "Royals", "submitted"),
      ],
      [{ teamName: "Royals", amount: "SAR 150.00" }],
      [
        {
          seasonId: "s1",
          seasonName: "Cup",
          deadline: "x",
          feeHalalas: 0,
          registered: true,
        },
        {
          seasonId: "s2",
          seasonName: "Next cup",
          deadline: "x",
          feeHalalas: 0,
          registered: false,
        },
      ],
      () => "Jan 10",
    );
    expect(todos.map((todo) => [todo.text, todo.href])).toEqual([
      ["todoFix", "/team/sindikato/registrations/r2"],
      ["todoDraft", "/team/sindikato/registrations/d1"],
      ["todoPay", "/team/sindikato/payments"],
      ["todoRegister", "/team/sindikato/register/s2"],
    ]);
    expect(todos[0].quote).toBe("Fix #7");
  });
});

describe("team manager home", () => {
  it("shows what to do next, each team's standing, and the next game", async () => {
    render(await TeamHome(homeProps));
    const todo = screen.getByRole("region", { name: en.TeamHome.todo });
    const items = within(todo).getAllByRole("listitem");
    expect(items[0]).toHaveTextContent(
      "The league asked for changes to Royals B",
    );
    expect(items[0]).toHaveTextContent("“Please fix jersey number 7.”");
    expect(within(items[0]).getByRole("link", { name: "Fix" })).toHaveAttribute(
      "href",
      "/team/sindikato/registrations/r2",
    );
    expect(items[1]).toHaveTextContent(
      /Riyadh Royals owes SAR\s?150\.00 before the next game/,
    );
    expect(items[2]).toHaveTextContent(
      "Register a team for Sindikato Cup 2027",
    );

    const teams = screen.getByRole("region", { name: en.TeamHome.yourTeams });
    expect(
      within(teams).getByText(en.TeamHome.statusHelp.approved),
    ).toBeInTheDocument();
    expect(within(teams).getByText(/Next: vs Yanbu Kings/)).toBeInTheDocument();
    expect(
      within(teams).getByText(/Behind by SAR\s?150\.00/),
    ).toBeInTheDocument();

    const next = screen.getByRole("region", { name: en.TeamHome.nextGames });
    expect(
      within(next).getByText("Yanbu Kings vs Riyadh Royals"),
    ).toBeInTheDocument();
    expect(
      within(next).getByText("Riyadh Royals 61 – 55 Hail Hawks"),
    ).toBeInTheDocument();
  });

  it("invites a new manager to register when a season is open", async () => {
    render(
      await TeamHome({
        ...homeProps,
        overview: { ...overview, registrations: [], games: [], payments: [] },
      }),
    );
    expect(screen.getByText(en.TeamHome.noTeams)).toBeInTheDocument();
    expect(
      within(
        screen.getByRole("region", { name: en.TeamHome.yourTeams }),
      ).getByRole("link", { name: en.TeamHome.actionRegister }),
    ).toHaveAttribute("href", "/team/sindikato/register/s2");
  });

  it("writes a static preview for visual checks when asked", async () => {
    if (!process.env.TEAM_PREVIEW) return;
    const nav = renderToStaticMarkup(
      <NextIntlClientProvider locale="en" messages={en}>
        <TeamNav slug="sindikato" />
      </NextIntlClientProvider>,
    );
    const status = renderToStaticMarkup(
      await RegistrationStatus({
        status: "returned",
        seasonName: "Sindikato Cup 2026",
        comment: "Please fix jersey number 7.",
      }),
    );
    const home = renderToStaticMarkup(await TeamHome(homeProps));
    writeFileSync(
      process.env.TEAM_PREVIEW,
      `${nav}\n${home}\n<div class="py-6">${status}</div>`,
    );
  });
});

describe("registration status", () => {
  it("shows the league's reason when changes are requested", async () => {
    render(
      await RegistrationStatus({
        status: "returned",
        seasonName: "Cup",
        comment: "Fix #7",
      }),
    );
    expect(screen.getByRole("alert")).toHaveTextContent("Changes requested");
    expect(screen.getByRole("alert")).toHaveTextContent("“Fix #7”");
    const steps = screen.getByRole("list", { name: en.TeamHome.progressLabel });
    expect(within(steps).getAllByRole("listitem")[0]).toHaveAttribute(
      "aria-current",
      "step",
    );
  });

  it("marks every step done once approved", async () => {
    render(
      await RegistrationStatus({
        status: "approved",
        seasonName: "Cup",
        comment: "",
      }),
    );
    expect(screen.getByRole("status")).toHaveTextContent(
      "Your team is in Cup.",
    );
    expect(document.querySelector('[aria-current="step"]')).toBeNull();
  });

  it("drops the progress steps for a rejected registration", async () => {
    render(
      await RegistrationStatus({
        status: "rejected",
        seasonName: "Cup",
        comment: "Too late",
      }),
    );
    expect(screen.queryByRole("list")).toBeNull();
    expect(screen.getByRole("alert")).toHaveTextContent("“Too late”");
  });
});

describe("team manager navigation", () => {
  it("keeps registration pages under Home and lights the right tab", () => {
    const tabs = [
      { key: "home", sections: ["registrations", "register"] },
      { key: "games", sections: ["games"] },
      { key: "payments", sections: ["payments"] },
    ];
    const at = (path: string) =>
      activeNavTab(path, "/team/sindikato", tabs, "home");
    expect(at("/team/sindikato")).toBe("home");
    expect(at("/team/sindikato/registrations/r1")).toBe("home");
    expect(at("/team/sindikato/games")).toBe("games");
    expect(at("/team/sindikato/payments")).toBe("payments");
  });

  it("shows four labelled places", () => {
    render(
      <NextIntlClientProvider locale="en" messages={en}>
        <TeamNav slug="sindikato" />
      </NextIntlClientProvider>,
    );
    const nav = screen.getByRole("navigation", { name: en.TeamNav.label });
    expect(
      within(nav)
        .getAllByRole("link")
        .map((link) => link.textContent),
    ).toEqual(["Home", "Games", "Payments", "League"]);
  });
});
