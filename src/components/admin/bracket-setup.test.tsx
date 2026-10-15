// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import en from "@/messages/en.json";
import { createBracket } from "@/app/(admin)/admin/[league]/brackets/actions";
import { BracketSetup } from "./bracket-setup";
const mocks = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mocks.refresh }),
}));
vi.mock("@/app/(admin)/admin/[league]/brackets/actions", () => ({
  createBracket: vi.fn().mockResolvedValue({ success: true }),
}));
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
const teams = [1, 2, 3, 4].map((n) => ({ id: `team${n}`, name: `Team ${n}` }));
const show = (pendingGames = 0) =>
  render(
    <NextIntlClientProvider locale="en" messages={en}>
      <BracketSetup
        slug="cup"
        divisionId="division"
        teams={teams}
        pendingGames={pendingGames}
        tiedSeeds={false}
      />
    </NextIntlClientProvider>,
  );
describe("bracket setup", () => {
  it("previews seeds, swaps duplicates, and requires confirmation before creating", async () => {
    show();
    const submit = screen.getByRole("button", {
      name: en.Competition.createBracket,
    });
    expect(submit).toBeDisabled();
    expect(screen.getByText("Team 1 vs Team 4")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Seed 1"), {
      target: { value: "team2" },
    });
    expect(screen.getByLabelText("Seed 2")).toHaveValue("team1");
    expect(screen.getByText("Team 2 vs Team 4")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(submit);
    await waitFor(() =>
      expect(createBracket).toHaveBeenCalledWith("cup", {
        divisionId: "division",
        preset: "single",
        teamIds: ["team2", "team1", "team3", "team4"],
        confirmed: true,
      }),
    );
    expect(mocks.refresh).toHaveBeenCalledOnce();
  });
  it("blocks creation while elimination games remain unapproved", () => {
    show(2);
    expect(
      screen.queryByRole("button", { name: en.Competition.createBracket }),
    ).toBeNull();
    expect(
      screen.getByText(/2 remaining elimination games/),
    ).toBeInTheDocument();
  });
});
