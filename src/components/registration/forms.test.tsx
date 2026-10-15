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
import { TakeBackButton } from "./take-back-button";
import {
  saveRegistration,
  withdrawRegistration,
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
  withdrawRegistration: vi.fn(),
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
const logoPath = `87000000-0000-4000-8000-000000000001/${teamId}/logo/88000000-0000-4000-8000-000000000001.png`;
function wizard(
  rating: string | null = null,
  existing = false,
  withLogo = true,
) {
  wrap(
    <RegistrationWizard
      slug="sindikato"
      registrationId={existing ? registrationId : null}
      initial={{
        teamId,
        seasonId,
        divisionId,
        logoPath: withLogo ? logoPath : null,
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
        {
          id: "84000000-0000-4000-8000-000000000002",
          name: "Ana Reyes",
          rating: "B",
          suspended: false,
          documentsPresent: false,
          takenDivisionIds: [],
        },
        {
          id: "84000000-0000-4000-8000-000000000003",
          name: "Maria Santos",
          rating: "C",
          suspended: false,
          documentsPresent: false,
          takenDivisionIds: [secondDivisionId],
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
  it("shows divisions the team already entered as taken", () => {
    twoDivisionWizard();
    const open = screen.getByRole("radio", { name: /Open/ });
    expect(open).toBeDisabled();
    expect(open.closest("label")).toHaveTextContent(
      en.Registration.alreadyEntered,
    );
    expect(screen.getByRole("radio", { name: /Masters/ })).toBeChecked();
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
describe("building the roster", () => {
  async function openRoster(fixture = () => wizard("C")) {
    fixture();
    fireEvent.click(screen.getByRole("button", { name: en.Registration.next }));
    await screen.findByRole("heading", { name: en.Registration.yourRoster });
  }
  const search = (name: string) =>
    fireEvent.change(screen.getByLabelText(en.Registration.findOrAddPlayer), {
      target: { value: name },
    });
  const addNewButton = (name: string) =>
    screen.getByRole("button", {
      name: `Add \u201c${name}\u201d as a new player`,
    });

  it("adds an existing player with one tap and the next free jersey", async () => {
    await openRoster(twoDivisionWizard);
    fireEvent.click(screen.getByRole("button", { name: "Add Ana Reyes" }));
    expect(screen.getByLabelText("Jersey number for Ana Reyes")).toHaveValue(2);
    expect(screen.getByText("Ana Reyes added as #2.")).toBeInTheDocument();
  });
  it("does not offer a player who is on another team in this division", async () => {
    await openRoster(twoDivisionWizard);
    expect(
      screen.getByRole("button", { name: "Add Maria Santos" }),
    ).toBeDisabled();
  });
  it("counts players against the division size", async () => {
    await openRoster();
    expect(screen.getByText("1 player")).toBeInTheDocument();
    expect(screen.getByText(en.Registration.rosterReady)).toBeInTheDocument();
  });
  it("offers a typed name as a new player and lists it without saving", async () => {
    await openRoster();
    search("Pedro Penduko");
    fireEvent.click(addNewButton("Pedro Penduko"));
    expect(screen.getByText("Pedro Penduko")).toBeInTheDocument();
    expect(
      screen.getByText(en.Registration.newPlayerBadge),
    ).toBeInTheDocument();
    expect(saveRegistration).not.toHaveBeenCalled();
  });
  it("does not offer a new player with the name of an existing one", async () => {
    await openRoster();
    search(" juan ");
    expect(
      screen.queryByRole("button", { name: /as a new player/ }),
    ).toBeNull();
    expect(
      screen.getByText("Juan is already on your roster."),
    ).toBeInTheDocument();
  });
  it("removes with undo, and creates new players only with the saved roster", async () => {
    vi.mocked(saveRegistration).mockResolvedValue({
      success: true,
      id: registrationId,
    });
    await openRoster();
    search("Removed Player");
    fireEvent.click(addNewButton("Removed Player"));
    fireEvent.click(
      screen.getByRole("button", { name: "Remove Removed Player" }),
    );
    expect(screen.getByText("Removed Player removed.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: en.Registration.undo }));
    expect(
      screen.getByLabelText("Jersey number for Removed Player"),
    ).toHaveValue(2);
    fireEvent.click(
      screen.getByRole("button", { name: "Remove Removed Player" }),
    );
    search("Pedro Penduko");
    fireEvent.click(addNewButton("Pedro Penduko"));
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
describe("taking a registration back", () => {
  it("takes it back to edit and says what to do next", async () => {
    vi.mocked(withdrawRegistration).mockResolvedValue({
      success: true,
      id: registrationId,
    });
    wrap(<TakeBackButton slug="sindikato" registrationId={registrationId} />);
    fireEvent.click(
      screen.getByRole("button", { name: en.Registration.takeBack }),
    );
    expect(await screen.findByRole("status")).toHaveTextContent(
      en.Registration.takenBack,
    );
    expect(withdrawRegistration).toHaveBeenCalledWith(
      "sindikato",
      registrationId,
    );
    expect(refresh).toHaveBeenCalled();
  });
  it("explains when the commissioner already reviewed it", async () => {
    vi.mocked(withdrawRegistration).mockResolvedValue({
      error: "notWaitingForReview",
    });
    wrap(<TakeBackButton slug="sindikato" registrationId={registrationId} />);
    fireEvent.click(
      screen.getByRole("button", { name: en.Registration.takeBack }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "no longer waiting for review",
    );
  });
});
describe("registration forms", () => {
  it("requires a logo to send, while permitting an unfinished draft", async () => {
    wizard(null, false, false);
    vi.mocked(saveRegistration).mockResolvedValue({
      success: true,
      id: registrationId,
    });
    fireEvent.click(screen.getByRole("button", { name: en.Registration.next }));
    await screen.findByRole("heading", { name: en.Registration.yourRoster });
    fireEvent.click(screen.getByRole("button", { name: en.Registration.next }));
    await screen.findByRole("heading", {
      name: en.Registration.reviewRegistration,
    });
    fireEvent.click(
      screen.getByRole("button", { name: en.Registration.submit }),
    );
    expect(saveRegistration).not.toHaveBeenCalled();
    expect(
      screen.getAllByText(en.Registration.teamLogoRequired).length,
    ).toBeGreaterThan(0);
    fireEvent.click(
      screen.getByRole("button", { name: en.Registration.saveDraft }),
    );
    await waitFor(() =>
      expect(saveRegistration).toHaveBeenCalledWith(
        "sindikato",
        null,
        expect.objectContaining({ logoPath: null }),
        false,
      ),
    );
  });
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
    expect(screen.getByRole("radio", { name: /Royals/ })).toBeDisabled();
    expect(screen.getByRole("radio", { name: /Royals/ })).toBeChecked();
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
