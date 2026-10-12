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
import { generateSchedule } from "@/app/(admin)/admin/[league]/schedule/actions";
import { ScheduleWizard } from "./schedule-wizard";

const { push, refresh } = vi.hoisted(() => ({
  push: vi.fn(),
  refresh: vi.fn(),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh }) }));
vi.mock("@/app/(admin)/admin/[league]/schedule/actions", () => ({
  generateSchedule: vi.fn(),
}));
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

const divisionId = "84000000-0000-4000-8000-000000000001";
const teams = ["Royals", "Titans", "Kings", "Hawks"].map((name, index) => ({
  id: `86000000-0000-4000-8000-00000000000${index + 1}`,
  name,
}));
function renderWizard(
  props: Partial<Parameters<typeof ScheduleWizard>[0]> = {},
) {
  render(
    <NextIntlClientProvider locale="en" messages={en} timeZone="Asia/Riyadh">
      <ScheduleWizard
        slug="sindikato"
        divisionId={divisionId}
        teams={teams}
        seasonStart="2026-10-21"
        seasonEnd="2026-12-18"
        hasSchedule={false}
        today="2026-10-12"
        {...props}
      />
    </NextIntlClientProvider>,
  );
}
async function next(heading: string) {
  fireEvent.click(screen.getByRole("button", { name: en.Schedule.next }));
  await screen.findByRole("heading", { name: heading });
}

describe("schedule wizard", () => {
  it("previews a Friday round robin and saves the same setup", async () => {
    vi.mocked(generateSchedule).mockResolvedValue({ success: true, count: 6 });
    renderWizard();
    expect(screen.getByText("4 approved teams")).toBeInTheDocument();
    await next(en.Schedule.whenAndWhere);
    expect(screen.getByLabelText(en.Schedule.firstGameDate)).toHaveValue(
      "2026-10-21",
    );
    expect(screen.getByRole("button", { name: "Fri" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await next(en.Schedule.checkAndSave);
    expect(screen.getByText("6 games on 3 game days")).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(6);
    expect(screen.getAllByText(/Friday, October 23/)).toHaveLength(2);
    fireEvent.click(
      screen.getByRole("button", { name: en.Schedule.saveSchedule }),
    );
    await waitFor(() =>
      expect(push).toHaveBeenCalledWith(
        `/admin/sindikato/schedule/${divisionId}`,
      ),
    );
    expect(generateSchedule).toHaveBeenCalledWith("sindikato", {
      divisionId,
      twice: false,
      startDate: "2026-10-21",
      gameDays: [5],
      times: ["19:00", "20:30"],
      venues: ["Main court"],
      replace: false,
    });
  });

  it("stops on step two when no game day is picked", async () => {
    renderWizard();
    await next(en.Schedule.whenAndWhere);
    fireEvent.click(screen.getByRole("button", { name: "Fri" }));
    fireEvent.click(screen.getByRole("button", { name: en.Schedule.next }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      en.Schedule.pickGameDay,
    );
    expect(
      screen.getByRole("heading", { name: en.Schedule.whenAndWhere }),
    ).toBeInTheDocument();
  });

  it("warns when games run past the season end", async () => {
    renderWizard({ seasonEnd: "2026-10-31" });
    fireEvent.click(
      screen.getByRole("radio", {
        name: new RegExp(en.Schedule.playTwice.slice(0, 20)),
      }),
    );
    await next(en.Schedule.whenAndWhere);
    await next(en.Schedule.checkAndSave);
    expect(screen.getByText("12 games on 6 game days")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "after the season ends",
    );
  });

  it("asks for confirmation before replacing an existing schedule", async () => {
    vi.mocked(generateSchedule).mockResolvedValue({ success: true, count: 6 });
    renderWizard({ hasSchedule: true });
    await next(en.Schedule.whenAndWhere);
    await next(en.Schedule.checkAndSave);
    fireEvent.click(
      screen.getByRole("button", { name: en.Schedule.saveSchedule }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      en.Schedule.confirmReplace,
    );
    expect(generateSchedule).not.toHaveBeenCalled();
    fireEvent.click(screen.getByLabelText(en.Schedule.replaceConfirm));
    fireEvent.click(
      screen.getByRole("button", { name: en.Schedule.saveSchedule }),
    );
    await waitFor(() =>
      expect(generateSchedule).toHaveBeenCalledWith(
        "sindikato",
        expect.objectContaining({ replace: true }),
      ),
    );
  });

  it("shows server errors in plain words", async () => {
    vi.mocked(generateSchedule).mockResolvedValue({
      error: "scheduleHasResults",
    });
    renderWizard();
    await next(en.Schedule.whenAndWhere);
    await next(en.Schedule.checkAndSave);
    fireEvent.click(
      screen.getByRole("button", { name: en.Schedule.saveSchedule }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      en.Schedule.scheduleHasResults,
    );
    expect(push).not.toHaveBeenCalled();
  });

  it("explains that two approved teams are needed", () => {
    renderWizard({ teams: teams.slice(0, 1) });
    expect(screen.getByText(en.Schedule.needTwoTeams)).toBeInTheDocument();
  });
});
