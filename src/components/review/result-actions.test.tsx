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
import {
  correctResult,
  recordForfeit,
} from "@/app/(admin)/admin/[league]/games/actions";
import { closeSeason } from "@/app/(admin)/admin/[league]/seasons/actions";
import { CorrectResultForm, ForfeitForm } from "./result-actions";
import { CloseSeason } from "@/components/admin/close-season";

const { refresh } = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("@/app/(admin)/admin/[league]/games/actions", () => ({
  recordForfeit: vi.fn(),
  correctResult: vi.fn(),
}));
vi.mock("@/app/(admin)/admin/[league]/seasons/actions", () => ({
  closeSeason: vi.fn(),
}));
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});
const gameId = "90000000-0000-4000-8000-000000000001";
const wrap = (ui: React.ReactNode) =>
  render(
    <NextIntlClientProvider locale="en" messages={en} timeZone="Asia/Riyadh">
      {ui}
    </NextIntlClientProvider>,
  );

describe("forfeit form", () => {
  it("records a no-show for the chosen team with the reason", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    vi.mocked(recordForfeit).mockResolvedValue({ success: true });
    wrap(
      <ForfeitForm
        slug="sindikato"
        gameId={gameId}
        teamNames={{ home: "Riyadh Royals", away: "Yanbu Kings" }}
        started={false}
      />,
    );
    expect(screen.queryByText(en.Review.kindDefault)).toBeNull();
    fireEvent.click(
      screen.getByRole("radio", { name: /Riyadh Royals forfeited/ }),
    );
    fireEvent.change(screen.getByLabelText(en.Review.forfeitReason), {
      target: { value: "Did not show up" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: en.Review.recordForfeit }),
    );
    await waitFor(() =>
      expect(recordForfeit).toHaveBeenCalledWith("sindikato", {
        gameId,
        kind: "forfeit",
        side: "home",
        reason: "Did not show up",
      }),
    );
  });
  it("offers a default only once the game was being played", () => {
    wrap(
      <ForfeitForm
        slug="sindikato"
        gameId={gameId}
        teamNames={{ home: "Riyadh Royals", away: "Yanbu Kings" }}
        started
      />,
    );
    fireEvent.click(screen.getByRole("radio", { name: /ran out of players/ }));
    expect(
      screen.queryByRole("radio", { name: /Neither team came/ }),
    ).toBeNull();
  });
  it("asks what happened before saving", () => {
    wrap(
      <ForfeitForm
        slug="sindikato"
        gameId={gameId}
        teamNames={{ home: "Riyadh Royals", away: "Yanbu Kings" }}
        started={false}
      />,
    );
    fireEvent.click(
      screen.getByRole("button", { name: en.Review.recordForfeit }),
    );
    expect(screen.getByText(en.Review.reasonRequired)).toBeInTheDocument();
    expect(recordForfeit).not.toHaveBeenCalled();
  });
});

describe("correcting a result", () => {
  it("reopens it with the reason after confirming", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    vi.mocked(correctResult).mockResolvedValue({ success: true });
    wrap(
      <CorrectResultForm slug="sindikato" gameId={gameId} forfeit={false} />,
    );
    fireEvent.change(screen.getByLabelText(en.Review.correctReason), {
      target: { value: "Points went to the wrong player" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: en.Review.reopenResult }),
    );
    await waitFor(() =>
      expect(correctResult).toHaveBeenCalledWith("sindikato", {
        gameId,
        reason: "Points went to the wrong player",
      }),
    );
  });
});

describe("closing a season", () => {
  it("lists what is left instead of a button while games need results", () => {
    wrap(
      <CloseSeason
        slug="sindikato"
        seasonId="s1"
        seasonName="Sindikato Cup 2026"
        openGames={3}
      />,
    );
    expect(screen.getByText(/3 games still need a result/)).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: en.Seasons.closeButton }),
    ).toBeNull();
  });
  it("closes a finished season after confirming", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    vi.mocked(closeSeason).mockResolvedValue({ success: true });
    wrap(
      <CloseSeason
        slug="sindikato"
        seasonId="s1"
        seasonName="Sindikato Cup 2026"
        openGames={0}
      />,
    );
    fireEvent.click(
      screen.getByRole("button", { name: en.Seasons.closeButton }),
    );
    await waitFor(() =>
      expect(closeSeason).toHaveBeenCalledWith("sindikato", "s1"),
    );
    await waitFor(() => expect(refresh).toHaveBeenCalled());
  });
});
