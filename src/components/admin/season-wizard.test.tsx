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
import { saveSeason } from "@/app/(admin)/admin/[league]/seasons/actions";
import { defaultBasketballRules } from "@/lib/sports/basketball";
import { SeasonWizard } from "./season-wizard";
import type { SeasonFormInput } from "@/lib/validation/seasons";

const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("@/app/(admin)/admin/[league]/seasons/actions", () => ({
  saveSeason: vi.fn(),
}));
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});
const initial: SeasonFormInput = {
  name: "New cup",
  startDate: "2027-01-01",
  endDate: "2027-03-31",
  sport: "basketball",
  rules: defaultBasketballRules,
  ratingScale: ["A", "B", "C", "D"],
  status: "draft",
  divisions: [
    {
      name: "Division C",
      sport: "basketball",
      maxRating: "C",
      rosterMin: 8,
      rosterMax: 15,
      rules: null,
    },
  ],
};
function renderWizard(values = initial, copyTemplate?: SeasonFormInput) {
  render(
    <NextIntlClientProvider locale="en" messages={en} timeZone="Asia/Riyadh">
      <SeasonWizard
        slug="sindikato"
        initial={values}
        copyTemplate={copyTemplate}
      />
    </NextIntlClientProvider>,
  );
}
async function next(heading: string) {
  fireEvent.click(screen.getByRole("button", { name: en.Seasons.next }));
  await screen.findByRole("heading", { name: heading });
}
describe("season setup wizard", () => {
  it("rejects reversed dates before moving to divisions", async () => {
    renderWizard({
      ...initial,
      endDate: "2026-01-01",
      divisions: [{ ...initial.divisions[0], name: "" }],
    });
    fireEvent.click(screen.getByRole("button", { name: en.Seasons.next }));
    expect(await screen.findByRole("status")).toHaveTextContent(
      en.Seasons.invalidDetails,
    );
    expect(
      screen.getByRole("heading", { name: en.Seasons.details }),
    ).toBeInTheDocument();
    expect(saveSeason).not.toHaveBeenCalled();
  });
  it("copies division and rule settings without carrying old IDs or dates", async () => {
    renderWizard(initial, {
      ...initial,
      name: "Old cup",
      startDate: "2026-01-01",
      endDate: "2026-03-31",
      divisions: [
        {
          ...initial.divisions[0],
          id: "43000000-0000-4000-8000-000000000001",
          name: "Open",
          maxRating: "A",
        },
      ],
      rules: { ...defaultBasketballRules, quarterMinutes: 12 },
    });
    fireEvent.click(screen.getByRole("button", { name: en.Seasons.copyLast }));
    expect(screen.getByLabelText(en.Seasons.name)).toHaveValue("New cup");
    expect(screen.getByLabelText(en.Seasons.startDate)).toHaveValue(
      "2027-01-01",
    );
    await next(en.Seasons.divisions);
    expect(screen.getByLabelText(en.Seasons.divisionName)).toHaveValue("Open");
    await next(en.Seasons.rules);
    expect(
      screen.getByLabelText(en.BasketballRules.quarterMinutes),
    ).toHaveValue(12);
    await next(en.Seasons.review);
    vi.mocked(saveSeason).mockResolvedValue({ seasonId: "new-id" });
    fireEvent.click(screen.getByRole("button", { name: en.Seasons.saveDraft }));
    await waitFor(() => expect(saveSeason).toHaveBeenCalled());
    expect(vi.mocked(saveSeason).mock.calls[0][2]).toMatchObject({
      startDate: "2027-01-01",
      divisions: [{ name: "Open", maxRating: "A" }],
    });
    expect(
      (vi.mocked(saveSeason).mock.calls[0][2] as SeasonFormInput).divisions[0],
    ).not.toHaveProperty("id");
  });
  it("keeps invalid roster bounds out of the rules step", async () => {
    renderWizard();
    await next(en.Seasons.divisions);
    fireEvent.change(screen.getByLabelText(en.Seasons.rosterMin), {
      target: { value: "20" },
    });
    fireEvent.click(screen.getByRole("button", { name: en.Seasons.next }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      en.Seasons.invalidSetup,
    );
    expect(
      screen.getByRole("heading", { name: en.Seasons.divisions }),
    ).toBeInTheDocument();
  });
  it("submits the reviewed season with explicit publication consent", async () => {
    vi.mocked(saveSeason).mockResolvedValue({ seasonId: "created-id" });
    renderWizard();
    await next(en.Seasons.divisions);
    await next(en.Seasons.rules);
    await next(en.Seasons.review);
    fireEvent.click(
      screen.getByRole("checkbox", { name: new RegExp(en.Seasons.publishNow) }),
    );
    fireEvent.click(screen.getByRole("button", { name: en.Seasons.publish }));
    await waitFor(() =>
      expect(push).toHaveBeenCalledWith("/admin/sindikato/seasons/created-id"),
    );
    expect(saveSeason).toHaveBeenCalledWith(
      "sindikato",
      null,
      expect.objectContaining({ status: "published" }),
    );
  });
});
