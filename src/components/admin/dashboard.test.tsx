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
  seasonName: "Sindikato Cup 2026",
  liveGames: [
    {
      id: "g1",
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
    const todo = screen.getByRole("heading", {
      name: en.AdminHome.todo,
    }).parentElement!;
    const items = within(todo).getAllByRole("listitem");
    expect(items.map((item) => item.textContent)).toEqual([
      "1game waiting for your approvalReview",
      "3teams waiting for approvalReview",
      "2teams behind on paymentsView",
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
    const home = renderToStaticMarkup(await Dashboard(props));
    writeFileSync(process.env.DASHBOARD_PREVIEW, `${nav}\n${home}`);
  });
});
