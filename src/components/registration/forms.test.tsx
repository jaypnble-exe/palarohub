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
          takenDivisionIds: [],
        },
      ]}
      ratingScale={["A", "B", "C", "D"]}
      deadline="2027-01-01T00:00:00Z"
      feeHalalas={180000}
      requireDocuments={false}
    />,
  );
}
const secondDivisionId = "83000000-0000-4000-8000-000000000002";
function twoDivisionWizard() {
  wrap(
    <RegistrationWizard
      slug="sindikato"
      initial={{
        teamId,
        seasonId,
        divisionId: secondDivisionId,
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
        {
          id: secondDivisionId,
          name: "Masters",
          max_rating: "A",
          roster_min: 1,
          roster_max: 15,
        },
      ]}
      taken={[{ teamId, divisionId }]}
      catalog={[
        {
          id: playerId,
          name: "Juan",
          rating: "C",
          suspended: false,
          documentsPresent: false,
          takenDivisionIds: [divisionId],
        },
      ]}
      ratingScale={["A", "B", "C", "D"]}
      deadline="2027-01-01T00:00:00Z"
      feeHalalas={180000}
      requireDocuments={false}
    />,
  );
}
describe("registering in more than one division", () => {
  it("offers only the divisions the team has not entered yet", () => {
    twoDivisionWizard();
    const options = screen
      .getByLabelText(en.Registration.division)
      .querySelectorAll("option");
    expect([...options].map((option) => option.value)).toEqual([
      secondDivisionId,
    ]);
    expect(
      screen.getByText(/Already entered: Open/, { exact: false }),
    ).toBeInTheDocument();
  });
  it("lets a player already in another division join this one", async () => {
    twoDivisionWizard();
    fireEvent.click(screen.getByRole("button", { name: en.Registration.next }));
    await screen.findByRole("heading", { name: en.Registration.yourRoster });
    fireEvent.click(screen.getByRole("button", { name: en.Registration.next }));
    await screen.findByRole("heading", {
      name: en.Registration.reviewRegistration,
    });
    expect(
      screen.getByRole("button", { name: en.Registration.submit }),
    ).toBeEnabled();
  });
});
describe("adding a new player while building the roster", () => {
  async function openRoster() {
    wizard("C");
    fireEvent.click(screen.getByRole("button", { name: en.Registration.next }));
    await screen.findByRole("heading", { name: en.Registration.yourRoster });
  }
  function addNew(name: string) {
    fireEvent.change(screen.getByLabelText(en.Registration.choosePlayer), {
      target: { value: "new" },
    });
    fireEvent.change(screen.getByLabelText(en.Registration.newPlayerName), {
      target: { value: name },
    });
  }
  it("offers it inside the player list and lists it without saving", async () => {
    await openRoster();
    expect(
      screen.getByRole("option", { name: en.Registration.addNewPlayerOption }),
    ).toBeInTheDocument();
    addNew("Pedro Penduko");
    fireEvent.click(
      screen.getByRole("button", { name: en.Registration.addToRoster }),
    );
    expect(screen.getByText("Pedro Penduko")).toBeInTheDocument();
    expect(
      screen.getByText(en.Registration.newPlayerBadge),
    ).toBeInTheDocument();
    expect(saveRegistration).not.toHaveBeenCalled();
  });
  it("starts from the name typed in the search box", async () => {
    await openRoster();
    fireEvent.change(screen.getByLabelText(en.Registration.findPlayer), {
      target: { value: "Cardo" },
    });
    fireEvent.change(screen.getByLabelText(en.Registration.choosePlayer), {
      target: { value: "new" },
    });
    expect(screen.getByLabelText(en.Registration.newPlayerName)).toHaveValue(
      "Cardo",
    );
  });
  it("points to an existing player with the same name", async () => {
    await openRoster();
    addNew(" juan ");
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Juan is already in the list",
    );
    expect(
      screen.getByRole("button", { name: en.Registration.addToRoster }),
    ).toBeDisabled();
  });
  it("can be removed before saving, and is created only with the saved roster", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    vi.mocked(saveRegistration).mockResolvedValue({
      success: true,
      id: registrationId,
    });
    await openRoster();
    addNew("Removed Player");
    fireEvent.click(
      screen.getByRole("button", { name: en.Registration.addToRoster }),
    );
    const removeButtons = screen.getAllByRole("button", {
      name: en.Registration.remove,
    });
    fireEvent.click(removeButtons[removeButtons.length - 1]);
    expect(screen.queryByText("Removed Player")).not.toBeInTheDocument();
    addNew("Pedro Penduko");
    fireEvent.click(
      screen.getByRole("button", { name: en.Registration.addToRoster }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: en.Registration.saveDraft }),
    );
    await waitFor(() => expect(saveRegistration).toHaveBeenCalled());
    const input = vi.mocked(saveRegistration).mock.calls[0][2] as {
      roster: { playerId: string; jerseyNumber: number }[];
      newPlayers: { id: string; name: string }[];
    };
    expect(input.newPlayers).toEqual([
      { id: expect.any(String), name: "Pedro Penduko" },
    ]);
    expect(input.roster).toEqual([
      { playerId, jerseyNumber: 1 },
      { playerId: input.newPlayers[0].id, jerseyNumber: 2 },
    ]);
  });
});
describe("registration forms", () => {
  it("saves a draft and lets an unrated roster be submitted", async () => {
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
    ).toBeEnabled();
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
