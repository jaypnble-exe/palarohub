// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { useState } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { writeFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { Alert } from "./alert";
import { Avatar } from "./avatar";
import { Badge } from "./badge";
import { Button } from "./button";
import { Card } from "./card";
import { ChipGroup, ChipLinks, ChoiceCard } from "./chip";
import { EmptyState } from "./empty-state";
import { Field, Select, Textarea } from "./field";
import { Input } from "./input";
import { LinkCard } from "./link-card";
import { PageHeader } from "./page-header";
import { Section } from "./section";
import { CountBadge, Progress, StatTile } from "./stat";
import { TileGrid } from "./tile-grid";

afterEach(cleanup);

function Days() {
  const [days, setDays] = useState<number[]>([5]);
  return (
    <ChipGroup
      label="Game days"
      value={days}
      onChange={(day) =>
        setDays(
          days.includes(day) ? days.filter((d) => d !== day) : [...days, day],
        )
      }
      options={[
        { value: 4, label: "Thu" },
        { value: 5, label: "Fri" },
      ]}
    />
  );
}

describe("shared UI components", () => {
  it("chips toggle and report their state", () => {
    render(<Days />);
    const group = screen.getByRole("group", { name: "Game days" });
    expect(group).toBeInTheDocument();
    const thu = screen.getByRole("button", { name: "Thu" });
    expect(thu).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(thu);
    expect(thu).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Fri" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("filter links mark the current page", () => {
    render(
      <ChipLinks
        label="Season"
        links={[
          { href: "/a", label: "2026", current: true },
          { href: "/b", label: "2025", current: false },
        ]}
      />,
    );
    expect(screen.getByRole("link", { name: "2026" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: "2025" })).not.toHaveAttribute(
      "aria-current",
    );
  });

  it("alerts announce problems urgently and good news politely", () => {
    render(
      <>
        <Alert tone="danger">Could not save.</Alert>
        <Alert tone="success">Saved.</Alert>
      </>,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("Could not save.");
    expect(screen.getByRole("status")).toHaveTextContent("Saved.");
  });

  it("fields link the label to the control and show errors over help", () => {
    render(
      <Field id="fee" label="Fee" help="In SAR" error="Enter an amount">
        <Input id="fee" />
      </Field>,
    );
    expect(screen.getByLabelText("Fee")).toBeInTheDocument();
    expect(screen.getByText("Enter an amount")).toBeInTheDocument();
    expect(screen.queryByText("In SAR")).not.toBeInTheDocument();
  });

  it("progress stays between 0 and 100 percent", () => {
    render(
      <>
        <Progress label="Paid" value={150} max={100} />
        <Progress label="Played" value={1} max={0} />
      </>,
    );
    expect(screen.getByRole("progressbar", { name: "Paid" })).toHaveAttribute(
      "aria-valuenow",
      "100",
    );
    expect(screen.getByRole("progressbar", { name: "Played" })).toHaveAttribute(
      "aria-valuenow",
      "0",
    );
  });

  it("avatars show up to two initials and count badges cap at 99+", () => {
    render(
      <>
        <Avatar name="juan dela cruz" />
        <CountBadge count={140} />
      </>,
    );
    expect(screen.getByText("JD")).toBeInTheDocument();
    expect(screen.getByText("99+")).toBeInTheDocument();
  });

  it("page headers offer a way back", () => {
    render(
      <PageHeader
        title="Payments"
        back={{ href: "/admin/x", label: "Home" }}
      />,
    );
    expect(
      screen.getByRole("heading", { level: 1, name: "Payments" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Home" })).toHaveAttribute(
      "href",
      "/admin/x",
    );
  });

  it("writes a visual gallery when asked", () => {
    if (!process.env.UI_PREVIEW) return;
    const gallery = (
      <main className="space-y-6 py-6">
        <PageHeader
          back={{ href: "#", label: "Back to payments" }}
          eyebrow="Sindikato Cup 2026"
          title="Riyadh Royals"
          description="Record payments and fines. Corrections never delete anything."
          actions={<Button>Save payment</Button>}
        />
        <div className="flex flex-wrap gap-2">
          <Badge>Up to date</Badge>
          <Badge tone="success">Paid in full</Badge>
          <Badge tone="warning">Postponed</Badge>
          <Badge tone="danger">Behind by SAR 150.00</Badge>
          <Badge tone="primary">Penalty</Badge>
        </div>
        <Alert tone="info">Opened from this device; actions sync later.</Alert>
        <Alert tone="success">Saved.</Alert>
        <Alert tone="warning" title="Royals is behind on payments">
          The league allows the game; tell the commissioner.
        </Alert>
        <Alert tone="danger">Could not save. Check your connection.</Alert>
        <Alert tone="critical">Another device is now scoring this game.</Alert>
        <div className="grid gap-3 sm:grid-cols-2">
          <StatTile
            label="Payments collected"
            value="SAR 3,600.00"
            detail="of SAR 7,200.00 expected"
            progress={{ value: 50, max: 100 }}
            href="#"
          />
          <StatTile
            label="Games played"
            value="2 of 6"
            progress={{ value: 2, max: 6 }}
          />
        </div>
        <Section
          id="demo"
          title="Teams"
          action={{ href: "#", label: "See all" }}
        >
          <LinkCard
            href="#"
            title="Riyadh Royals"
            subtitle="Division B · Paid SAR 900.00 of SAR 1,800.00"
            trailing={<Badge tone="danger">Behind by SAR 150.00</Badge>}
          />
          <LinkCard
            href="#"
            tone="navy"
            title="Royals vs Hawks"
            subtitle="Division B · Main court"
          />
          <EmptyState
            icon="schedule"
            title="No games scheduled yet."
            description="Games appear here once a division has a schedule."
            action={<Button variant="outline">Make schedule</Button>}
          />
        </Section>
        <Card className="space-y-4">
          <ChipGroup
            label="Paid by"
            value="cash"
            onChange={() => {}}
            options={[
              { value: "cash", label: "Cash" },
              { value: "bank", label: "Bank transfer" },
              { value: "stc", label: "STC Pay" },
            ]}
          />
          <Field
            id="g-amount"
            label="Amount (SAR)"
            help="For example 150 or 150.50"
          >
            <Input id="g-amount" defaultValue="150.00" />
          </Field>
          <Field id="g-team" label="Home team">
            <Select id="g-team">
              <option>Riyadh Royals</option>
            </Select>
          </Field>
          <Field id="g-note" label="Note" error="Write why the entry is wrong.">
            <Textarea id="g-note" rows={2} aria-invalid />
          </Field>
          <ChoiceCard
            name="g"
            checked
            onChange={() => {}}
            title="Warn the scorer"
            description="The game can start; the scorer sees how much the team owes."
          />
        </Card>
        <TileGrid
          tiles={[
            { href: "#a", icon: "seasons", label: "Seasons" },
            { href: "#b", icon: "schedule", label: "Schedule" },
            { href: "#c", icon: "standings", label: "Standings" },
          ]}
        />
        <div className="flex items-center gap-3">
          <Avatar name="Rey Santos" />
          <CountBadge count={3} />
        </div>
      </main>
    );
    writeFileSync(process.env.UI_PREVIEW, renderToStaticMarkup(gallery));
  });
});
