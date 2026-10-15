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
import { ReviewActions } from "./review-actions";
import { approveGame } from "@/app/(admin)/admin/[league]/games/actions";
import type { PlayerPerformance } from "@/lib/domain/career-stats";
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/app/(admin)/admin/[league]/games/actions", () => ({
  approveGame: vi.fn(),
  reopenGame: vi.fn(),
}));
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
const candidates: (PlayerPerformance & { efficiency: number })[] = [
  {
    playerId: "10000000-0000-4000-8000-000000000001",
    name: "Player One",
    efficiency: 24,
    metrics: { points: 20, rebounds: 4 },
  },
  {
    playerId: "10000000-0000-4000-8000-000000000002",
    name: "Player Two",
    efficiency: 18,
    metrics: { points: 12, assists: 6 },
  },
];
function show(canSelectPlayer = true, tied = false) {
  render(
    <NextIntlClientProvider locale="en" messages={en} timeZone="Asia/Riyadh">
      <ReviewActions
        slug="sindikato"
        gameId="90000000-0000-4000-8000-000000000001"
        ejected={[]}
        canApprove
        canSelectPlayer={canSelectPlayer}
        candidates={
          tied
            ? candidates.map((player) => ({ ...player, efficiency: 24 }))
            : candidates
        }
      />
    </NextIntlClientProvider>,
  );
}
describe("Player of the Game confirmation", () => {
  it("suggests the leader and submits the commissioner's replacement with approval", async () => {
    vi.mocked(approveGame).mockResolvedValue({ success: true });
    vi.spyOn(window, "confirm").mockReturnValue(true);
    show();
    expect(screen.getByLabelText(en.PlayerOfGame.choose)).toHaveValue(
      candidates[0].playerId,
    );
    fireEvent.change(screen.getByLabelText(en.PlayerOfGame.choose), {
      target: { value: candidates[1].playerId },
    });
    expect(screen.getByText("18", { selector: "dd" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: en.Review.approve }));
    await waitFor(() =>
      expect(approveGame).toHaveBeenCalledWith(
        "sindikato",
        expect.objectContaining({ playerOfGame: candidates[1].playerId }),
      ),
    );
  });
  it("flags tied leaders", () => {
    show(true, true);
    expect(screen.getByText(en.PlayerOfGame.tie)).toBeInTheDocument();
  });
  it("requires commissioner confirmation while staff may return the game for correction", () => {
    show(false);
    expect(
      screen.getByRole("button", { name: en.Review.approve }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: en.Review.reopen }),
    ).toBeEnabled();
    expect(
      screen.queryByLabelText(en.PlayerOfGame.choose),
    ).not.toBeInTheDocument();
  });
});
