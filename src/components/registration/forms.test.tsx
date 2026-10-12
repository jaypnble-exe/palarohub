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
import { RegistrationWizard } from "./wizard";
import { PlayerChecksForm } from "./player-forms";
import { ReviewForm } from "./review-form";
import {
  saveRegistration,
  updatePlayerChecks,
  reviewRegistration,
} from "@/app/(team)/team/[league]/actions";
const { push, refresh } = vi.hoisted(() => ({
  push: vi.fn(),
  refresh: vi.fn(),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh }) }));
vi.mock("@/app/(team)/team/[league]/actions", () => ({
  saveRegistration: vi.fn(),
  updatePlayerChecks: vi.fn(),
  reviewRegistration: vi.fn(),
  createTeam: vi.fn(),
  createPlayer: vi.fn(),
  addPlayerRating: vi.fn(),
}));
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});
const teamId = "81000000-0000-4000-8000-000000000001",
  seasonId = "82000000-0000-4000-8000-000000000001",
  divisionId = "83000000-0000-4000-8000-000000000001",
  playerId = "84000000-0000-4000-8000-000000000001",
  registrationId = "85000000-0000-4000-8000-000000000001";
function wrap(ui: React.ReactNode) {
  render(
    <NextIntlClientProvider locale="en" messages={en} timeZone="Asia/Riyadh">
      {ui}
    </NextIntlClientProvider>,
  );
}
function wizard(rating: string | null = null, existing = false) {
  wrap(
    <RegistrationWizard
      slug="sindikato"
      registrationId={existing ? registrationId : null}
      initial={{
        teamId,
        seasonId,
        divisionId,
        roster: [{ playerId, jerseyNumber: 1 }],
      }}
      teams={[{ id: teamId, name: "Royals" }]}
      divisions={[
        {
          id: divisionId,
          name: "Open",
          max_rating: "A",
          roster_min: 1,
          roster_max: 15,
        },
      ]}
      catalog={[
        {
          id: playerId,
          name: "Juan",
          rating,
          suspended: false,
          documentsPresent: false,
          onAnotherTeam: false,
        },
      ]}
      ratingScale={["A", "B", "C", "D"]}
      deadline="2027-01-01T00:00:00Z"
      feeHalalas={180000}
      requireDocuments={false}
    />,
  );
}
describe("registration forms", () => {
  it("saves an unrated draft but blocks final submission", async () => {
    wizard();
    vi.mocked(saveRegistration).mockResolvedValue({
      success: true,
      id: registrationId,
    });
    fireEvent.click(
      screen.getByRole("button", { name: en.Registration.saveDraft }),
    );
    await waitFor(() =>
      expect(saveRegistration).toHaveBeenCalledWith(
        "sindikato",
        null,
        expect.objectContaining({ roster: [{ playerId, jerseyNumber: 1 }] }),
        false,
      ),
    );
    fireEvent.click(
      await screen.findByRole("button", { name: en.Registration.next }),
    );
    await screen.findByRole("heading", { name: en.Registration.yourRoster });
    fireEvent.click(screen.getByRole("button", { name: en.Registration.next }));
    await screen.findByRole("heading", {
      name: en.Registration.reviewRegistration,
    });
    expect(
      screen.getByRole("button", { name: en.Registration.submit }),
    ).toBeDisabled();
  });
  it("resubmits a returned registration with its locked team ID intact", async () => {
    wizard("C", true);
    vi.mocked(saveRegistration).mockResolvedValue({
      success: true,
      id: registrationId,
    });
    expect(screen.getByLabelText(en.Registration.yourTeam)).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: en.Registration.next }));
    await screen.findByRole("heading", { name: en.Registration.yourRoster });
    fireEvent.click(screen.getByRole("button", { name: en.Registration.next }));
    await screen.findByRole("heading", {
      name: en.Registration.reviewRegistration,
    });
    fireEvent.click(
      screen.getByRole("button", { name: en.Registration.submit }),
    );
    await waitFor(() =>
      expect(saveRegistration).toHaveBeenCalledWith(
        "sindikato",
        registrationId,
        expect.objectContaining({ teamId }),
        true,
      ),
    );
  });
  it("lets staff verify documents without clearing an existing suspension", async () => {
    vi.mocked(updatePlayerChecks).mockResolvedValue({ success: true });
    wrap(
      <PlayerChecksForm
        slug="sindikato"
        initial={{ playerId, documentsPresent: false, suspended: true }}
        canSuspend={false}
      />,
    );
    fireEvent.click(screen.getByLabelText(en.Registration.documentsVerified));
    fireEvent.click(screen.getByLabelText(en.Registration.suspended));
    fireEvent.click(
      screen.getByRole("button", { name: en.Registration.saveChecks }),
    );
    await waitFor(() =>
      expect(updatePlayerChecks).toHaveBeenCalledWith("sindikato", {
        playerId,
        documentsPresent: true,
        suspended: true,
      }),
    );
  });
  it("requires an explanation before returning a team", async () => {
    wrap(<ReviewForm slug="sindikato" registrationId={registrationId} />);
    fireEvent.change(screen.getByLabelText(en.Registration.decision), {
      target: { value: "returned" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: en.Registration.saveDecision }),
    );
    await screen.findByText(en.Registration.commentRequired);
    expect(reviewRegistration).not.toHaveBeenCalled();
  });
});
