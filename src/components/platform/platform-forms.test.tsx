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
  addLeagueMember,
  removeLeagueMember,
  replaceCommissioner,
  setLeaguePaused,
} from "@/app/(admin)/admin/actions";
import {
  MemberEmailForm,
  PauseLeagueForm,
  RemoveAccessButton,
} from "./platform-forms";

const { refresh } = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("@/app/(admin)/admin/actions", () => ({
  addLeagueMember: vi.fn(),
  removeLeagueMember: vi.fn(),
  replaceCommissioner: vi.fn(),
  setLeaguePaused: vi.fn(),
}));
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});
const leagueId = "00000000-0000-4000-8000-000000000001";
const wrap = (ui: React.ReactNode) =>
  render(
    <NextIntlClientProvider locale="en" messages={en} timeZone="Asia/Riyadh">
      {ui}
    </NextIntlClientProvider>,
  );

describe("platform admin forms", () => {
  it("adds staff by email and clears the field", async () => {
    vi.mocked(addLeagueMember).mockResolvedValue({ success: true });
    wrap(
      <MemberEmailForm
        leagueId={leagueId}
        leagueName="Sindikato"
        mode="staff"
      />,
    );
    const input = screen.getByLabelText(en.Platform.staffEmail);
    fireEvent.change(input, { target: { value: "mia@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: en.Platform.addStaff }));
    await waitFor(() =>
      expect(addLeagueMember).toHaveBeenCalledWith({
        leagueId,
        email: "mia@example.com",
        role: "league_staff",
      }),
    );
    await waitFor(() => expect(input).toHaveValue(""));
    expect(refresh).toHaveBeenCalled();
  });
  it("asks before handing the league to a new commissioner", async () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    wrap(
      <MemberEmailForm
        leagueId={leagueId}
        leagueName="Sindikato"
        mode="replace"
      />,
    );
    fireEvent.change(screen.getByLabelText(en.Platform.newCommissionerEmail), {
      target: { value: "new@example.com" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: en.Platform.changeCommissioner }),
    );
    expect(confirm).toHaveBeenCalled();
    expect(replaceCommissioner).not.toHaveBeenCalled();
  });
  it("shows why an email could not be added", async () => {
    vi.mocked(addLeagueMember).mockResolvedValue({ error: "userNotFound" });
    wrap(
      <MemberEmailForm
        leagueId={leagueId}
        leagueName="Sindikato"
        mode="staff"
      />,
    );
    fireEvent.change(screen.getByLabelText(en.Platform.staffEmail), {
      target: { value: "nobody@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: en.Platform.addStaff }));
    expect(
      await screen.findByText(en.Platform.error.userNotFound),
    ).toBeInTheDocument();
  });
  it("removes one role after confirming", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    vi.mocked(removeLeagueMember).mockResolvedValue({ success: true });
    wrap(
      <RemoveAccessButton
        leagueId={leagueId}
        leagueName="Sindikato"
        userId="u1"
        name="Mia"
        role="league_staff"
        roleLabel="League staff"
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Remove access: Mia/ }));
    await waitFor(() =>
      expect(removeLeagueMember).toHaveBeenCalledWith({
        leagueId,
        userId: "u1",
        role: "league_staff",
      }),
    );
  });
  it("needs a reason before pausing", () => {
    wrap(
      <PauseLeagueForm
        leagueId={leagueId}
        leagueName="Sindikato"
        paused={false}
      />,
    );
    fireEvent.click(
      screen.getByRole("button", { name: en.Platform.pauseButton }),
    );
    expect(
      screen.getByText(en.Platform.error.reasonRequired),
    ).toBeInTheDocument();
    expect(setLeaguePaused).not.toHaveBeenCalled();
  });
  it("resumes a paused league", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    vi.mocked(setLeaguePaused).mockResolvedValue({ success: true });
    wrap(<PauseLeagueForm leagueId={leagueId} leagueName="Sindikato" paused />);
    fireEvent.click(
      screen.getByRole("button", { name: en.Platform.resumeButton }),
    );
    await waitFor(() =>
      expect(setLeaguePaused).toHaveBeenCalledWith({ leagueId, paused: false }),
    );
  });
});
