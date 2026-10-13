// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { writeFileSync } from "node:fs";
import {
  filterCounts,
  parseStatusFilter,
  sortTeamRows,
  statusGroup,
  type RegistrationStatus,
} from "@/lib/teams-table";
import { Badge } from "./badge";
import { DataTable } from "./data-table";

afterEach(cleanup);
type Row = {
  id: string;
  teamName: string;
  divisionName: string;
  status: RegistrationStatus;
  players: number;
};
const rows: Row[] = [
  {
    id: "1",
    teamName: "Riyadh Royals",
    divisionName: "Open",
    status: "approved",
    players: 12,
  },
  {
    id: "2",
    teamName: "Jeddah Kings",
    divisionName: "Open",
    status: "submitted",
    players: 10,
  },
  {
    id: "3",
    teamName: "Dammam Hawks",
    divisionName: "Masters",
    status: "draft",
    players: 6,
  },
  {
    id: "4",
    teamName: "Al Khobar Five",
    divisionName: "Masters",
    status: "submitted",
    players: 9,
  },
  {
    id: "5",
    teamName: "Tabuk Titans",
    divisionName: "Open",
    status: "returned",
    players: 8,
  },
];

describe("teams table helpers", () => {
  it("puts teams waiting for review first, then by division and name", () =>
    expect(sortTeamRows(rows).map((row) => row.teamName)).toEqual([
      "Al Khobar Five",
      "Jeddah Kings",
      "Dammam Hawks",
      "Tabuk Titans",
      "Riyadh Royals",
    ]));
  it("counts each filter and treats drafts and returned rosters as not sent", () => {
    expect(statusGroup("returned")).toBe("notSent");
    expect(filterCounts(rows)).toEqual({
      all: 5,
      waiting: 2,
      approved: 1,
      notSent: 2,
      rejected: 0,
    });
  });
  it("ignores an unknown filter in the address", () => {
    expect(parseStatusFilter("waiting")).toBe("waiting");
    expect(parseStatusFilter("drop table")).toBe("all");
    expect(parseStatusFilter(undefined)).toBe("all");
  });
});

describe("data table", () => {
  function renderTable() {
    render(
      <main className="space-y-6 py-6">
        <DataTable
          label="Teams in Sindikato Cup 2026"
          rows={sortTeamRows(rows)}
          rowKey={(row) => row.id}
          rowHref={(row) => `/admin/sindikato/registrations/${row.id}`}
          rowLabel={(row) => `Open ${row.teamName}`}
          openLabel="Open"
          columns={[
            { key: "team", header: "Team", cell: (row) => row.teamName },
            {
              key: "division",
              header: "Division",
              cell: (row) => row.divisionName,
            },
            {
              key: "players",
              header: "Players",
              align: "right",
              cell: (row) => row.players,
            },
            {
              key: "status",
              header: "Status",
              cell: (row) => <Badge>{row.status}</Badge>,
            },
          ]}
          phone={(row) => ({
            title: row.teamName,
            subtitle: `${row.divisionName} · ${row.players} players`,
            trailing: <Badge>{row.status}</Badge>,
          })}
        />
      </main>,
    );
  }
  it("is a table with headers and a link per row on wider screens", () => {
    renderTable();
    const table = screen.getByRole("table", {
      name: "Teams in Sindikato Cup 2026",
    });
    expect(
      within(table)
        .getAllByRole("columnheader")
        .map((cell) => cell.textContent),
    ).toEqual(["Team", "Division", "Players", "Status", "Open"]);
    expect(within(table).getAllByRole("row")).toHaveLength(6);
    expect(
      within(table).getByRole("link", { name: "Open Jeddah Kings" }),
    ).toHaveAttribute("href", "/admin/sindikato/registrations/2");
    if (process.env.TEAMS_PREVIEW)
      writeFileSync(process.env.TEAMS_PREVIEW, document.body.innerHTML);
  });
  it("is a list of tappable two-line rows on phones", () => {
    renderTable();
    const list = screen.getByRole("list", {
      name: "Teams in Sindikato Cup 2026",
    });
    const first = within(list).getAllByRole("link")[0];
    expect(first).toHaveAccessibleName("Open Al Khobar Five");
    expect(first).toHaveTextContent("Masters · 9 players");
  });
});
