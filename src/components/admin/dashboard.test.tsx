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
import { Dashboard } from "./dashboard";
import { AdminNav, activeTab } from "./admin-nav";
import { buildTodos } from "./todos";

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
vi.mock("next/navigation", () => ({ usePathname: () => "/admin/sindikato" }));
afterEach(cleanup);

const none = {
  gamesToApprove: 0,
  registrations: 0,
  changes: 0,
  teamsBehind: 0,
  unscheduled: 0,
  unrated: 0,
};
const props = {
  league: { name: "Sindikato", slug: "sindikato", sport: "basketball" },
  displayName: "Rey Santos",
  role: "Commissioner",
  members: [
    { id: "1", name: "Rey Santos", roles: ["Commissioner"] },
    { id: "2", name: "Mia Dela Cruz", roles: ["League staff"] },
  ],
  isDemo: false,
  season: {
    name: "Sindikato Cup 2026",
    teams: 4,
    gamesPlayed: 2,
    gamesTotal: 6,
    collectedHalalas: 360000,
    expectedHalalas: 720000,
  },
  setup: {
    seasonId: "s1",
    hasSeason: true,
    registrationReady: true,
    teamsApproved: true,
    scheduled: true,
  },
  liveGames: [
    {
      id: "g1",
      divisionId: "d1",
      home: "Riyadh Royals",
      away: "Hail Hawks",
      venue: "Main court",
      division: "Division B",
      scheduledAt: "2026-10-23T16:00:00.000Z",
    },
  ],
  upcomingGames: [
    {
      id: "g2",
      divisionId: "d1",
      home: "Taif Titans",
      away: "Yanbu Kings",
      venue: "Main court",
      division: "Division B",
      scheduledAt: "2026-10-23T17:30:00.000Z",
    },
  ],
  tasks: { ...none, gamesToApprove: 1, registrations: 3, teamsBehind: 2 },
};

describe("commissioner to-do list", () => {
  it("lists only what needs doing, most urgent first", () => {
    const todos = buildTodos("sindikato", {
      ...none,
      unrated: 4,
      gamesToApprove: 1,
      teamsBehind: 2,
    });
    expect(todos.map((todo) => [todo.key, todo.count, todo.href])).toEqual([
      ["gamesToApprove", 1, "/admin/sindikato/games"],
      ["teamsBehind", 2, "/admin/sindikato/payments"],
      ["unrated", 4, "/admin/sindikato/players"],
    ]);
    expect(buildTodos("sindikato", none)).toEqual([]);
  });
});

describe("league navigation", () => {
  it("lights the tab a page belongs to", () => {
    expect(activeTab("/admin/sindikato", "sindikato")).toBe("home");
    expect(activeTab("/admin/sindikato/registrations/x", "sindikato")).toBe(
      "teams",
    );
    expect(activeTab("/admin/sindikato/schedule/abc/new", "sindikato")).toBe(
      "games",
    );
    expect(activeTab("/admin/sindikato/payments/abc", "sindikato")).toBe(
      "payments",
    );
    expect(activeTab("/admin/sindikato/seasons", "sindikato")).toBe("more");
  });

  it("shows five labelled places", () => {
    render(
      <NextIntlClientProvider locale="en" messages={en}>
        <AdminNav slug="sindikato" />
      </NextIntlClientProvider>,
    );
    const nav = screen.getByRole("navigation", { name: en.AdminNav.label });
    expect(
      within(nav)
        .getAllByRole("link")
        .map((link) => link.textContent),
    ).toEqual(["Home", "Teams", "Games", "Payments", "More"]);
    expect(within(nav).getByRole("link", { name: "Home" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });
});

describe("commissioner home", () => {
  it("opens on the to-do list with one action per item", async () => {
    render(await Dashboard(props));
    const todo = screen.getByRole("region", { name: en.AdminHome.todo });
    const items = within(todo).getAllByRole("listitem");
    expect(items.map((item) => item.textContent)).toEqual([
      "11 game waiting for your approvalReview",
      "33 teams waiting for approvalReview",
      "22 teams behind on paymentsView",
    ]);
    expect(
      within(items[2]).getByRole("link", { name: "View" }),
    ).toHaveAttribute("href", "/admin/sindikato/payments");
    expect(screen.getByText("Riyadh Royals vs Hail Hawks")).toBeInTheDocument();
    expect(screen.getByText("Taif Titans vs Yanbu Kings")).toBeInTheDocument();
    expect(screen.getByText("Sindikato Cup 2026")).toBeInTheDocument();
  });

  it("says all caught up when nothing is waiting", async () => {
    render(
      await Dashboard({
        ...props,
        tasks: none,
        liveGames: [],
        upcomingGames: [],
      }),
    );
    expect(screen.getByText(en.AdminHome.allCaughtUp)).toBeInTheDocument();
    expect(screen.queryByText(en.AdminHome.liveNow)).not.toBeInTheDocument();
    expect(screen.getByText(en.AdminHome.noUpcoming)).toBeInTheDocument();
  });

  it("writes a static preview for visual checks when asked", async () => {
    if (!process.env.DASHBOARD_PREVIEW) return;
    const nav = renderToStaticMarkup(
      <NextIntlClientProvider locale="en" messages={en}>
        <AdminNav slug="sindikato" />
      </NextIntlClientProvider>,
    );
    const home = renderToStaticMarkup(
      <NextIntlClientProvider locale="en" messages={en}>
        {await Dashboard({
          ...props,
          registration: {
            url: "https://palarohub.com/sindikato/register/50000000-0000-4000-8000-000000000001",
            settingsHref: "#",
            deadline: "2026-11-11T18:00:00.000Z",
            seasonName: "Sindikato Cup 2026",
            registered: 3,
          },
        })}
      </NextIntlClientProvider>,
    );
    writeFileSync(process.env.DASHBOARD_PREVIEW, `${nav}\n${home}`);
  });

  it("guides a new league through setup, highlighting the next step", async () => {
    render(
      await Dashboard({
        ...props,
        season: null,
        setup: {
          seasonId: null,
          hasSeason: false,
          registrationReady: false,
          teamsApproved: false,
          scheduled: false,
        },
      }),
    );
    const steps = within(
      screen.getByRole("region", { name: en.AdminHome.setupTitle }),
    ).getAllByRole("link");
    expect(steps).toHaveLength(4);
    expect(steps[0]).toHaveAttribute("aria-current", "step");
    expect(steps[0]).toHaveAttribute("href", "/admin/sindikato/seasons");
    expect(
      screen.queryByRole("region", { name: en.AdminHome.thisSeason }),
    ).toBeNull();
  });

  it("hides setup once the schedule exists and shows season progress", async () => {
    render(await Dashboard(props));
    expect(
      screen.queryByRole("region", { name: en.AdminHome.setupTitle }),
    ).toBeNull();
    const season = screen.getByRole("region", {
      name: en.AdminHome.thisSeason,
    });
    expect(within(season).getByText("2 of 6")).toBeInTheDocument();
    expect(within(season).getByText(/SAR\s?3,600\.00/)).toBeInTheDocument();
    expect(
      within(season)
        .getAllByRole("progressbar")
        .map((bar) => bar.getAttribute("aria-valuenow")),
    ).toEqual(["33", "50"]);
  });

  it("offers the scorer PIN for games later today", async () => {
    const soon = new Date(new Date().getTime() + 30 * 60_000);
    // Keep the game on today's Riyadh date even late in the evening.
    const riyadhHour = (soon.getUTCHours() + 3) % 24;
    const scheduledAt =
      riyadhHour < 23 ? soon.toISOString() : new Date().toISOString();
    render(
      await Dashboard({
        ...props,
        upcomingGames: [{ ...props.upcomingGames[0], scheduledAt }],
      }),
    );
    const next = screen.getByRole("region", { name: en.AdminHome.comingUp });
    expect(within(next).getByText(/^Today, /)).toBeInTheDocument();
    expect(
      within(next).getByRole("link", { name: en.AdminHome.scorerPin }),
    ).toHaveAttribute("href", "/admin/sindikato/schedule/d1");
  });

  it("puts the registration link on the home screen while teams can register", async () => {
    const url = "https://palarohub.com/sindikato/register/s1";
    render(
      <NextIntlClientProvider locale="en" messages={en}>
        {await Dashboard({
          ...props,
          registration: {
            url,
            settingsHref: "/admin/sindikato/seasons/s1/registration",
            deadline: "2026-11-11T18:00:00.000Z",
            seasonName: "Sindikato Cup 2026",
            registered: 3,
          },
        })}
      </NextIntlClientProvider>,
    );
    const card = screen.getByRole("region", {
      name: en.AdminHome.registrationOpenTitle,
    });
    expect(within(card).getByText(url)).toBeInTheDocument();
    expect(
      within(card).getByText("3 teams have registered so far."),
    ).toBeInTheDocument();
    const whatsapp = within(card).getByRole("link", {
      name: en.Share.whatsapp,
    });
    expect(decodeURIComponent(whatsapp.getAttribute("href") ?? "")).toContain(
      url,
    );
    expect(
      within(card).getByRole("button", { name: en.Share.copyLink }),
    ).toBeInTheDocument();
    expect(
      within(card).getByRole("link", {
        name: en.AdminHome.registrationSettings,
      }),
    ).toHaveAttribute("href", "/admin/sindikato/seasons/s1/registration");
  });

  it("hides the registration card once registration is closed", async () => {
    render(await Dashboard({ ...props, registration: null }));
    expect(
      screen.queryByRole("region", {
        name: en.AdminHome.registrationOpenTitle,
      }),
    ).toBeNull();
  });
});
