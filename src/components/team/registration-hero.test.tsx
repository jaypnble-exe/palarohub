// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { writeFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { cleanup, render, screen } from "@testing-library/react";
import {
  NextIntlClientProvider,
  createFormatter,
  createTranslator,
} from "next-intl";
import en from "@/messages/en.json";
import { RegistrationHero } from "./registration-hero";
import { RegistrationStatus } from "./registration-status";
import { RegistrationDetails } from "@/components/registration/details";

vi.mock("next-intl/server", () => ({
  getTranslations: async (namespace: string) =>
    createTranslator({
      locale: "en",
      messages: en,
      namespace: namespace as never,
    }),
  getFormatter: async () =>
    createFormatter({ locale: "en", timeZone: "Asia/Riyadh" }),
}));
afterEach(cleanup);

const hero = (extra: Partial<Parameters<typeof RegistrationHero>[0]> = {}) =>
  RegistrationHero({
    slug: "sindikato",
    teamName: "Riyadh Royals",
    seasonName: "Sindikato Cup 2026",
    divisionName: "Division B",
    status: "submitted",
    players: 9,
    rosterMin: 8,
    rosterMax: 15,
    maxRating: "B",
    feeHalalas: 180000,
    deadline: "2026-11-11T14:47:00.000Z",
    registrationOpen: true,
    ...extra,
  });

describe("registration banner", () => {
  it("shows the team, status and the numbers a manager checks first", async () => {
    render(await hero());
    expect(
      screen.getByRole("heading", { level: 1, name: "Riyadh Royals" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(en.Registration.status.submitted),
    ).toBeInTheDocument();
    expect(screen.getByText("8–15 allowed")).toBeInTheDocument();
    expect(screen.getByText(/SAR\s?1,800\.00/)).toBeInTheDocument();
    expect(screen.getByText(en.TeamHome.factDeadline)).toBeInTheDocument();
  });
  it("shows what is left to pay once approved, instead of the deadline", async () => {
    render(
      await hero({
        status: "approved",
        payment: {
          leftHalalas: 150000,
          label: "Behind by SAR 150.00",
          behind: true,
        },
      }),
    );
    expect(screen.getByText(en.TeamHome.factLeftToPay)).toBeInTheDocument();
    expect(screen.getByText("Behind by SAR 150.00")).toBeInTheDocument();
    expect(screen.queryByText(en.TeamHome.factDeadline)).toBeNull();
  });
  it("writes a static preview for visual checks when asked", async () => {
    if (!process.env.REGISTRATION_PREVIEW) return;
    const players = [
      "Juan",
      "Miguel",
      "Marco",
      "Luis",
      "Anton",
      "Jose",
      "Gabriel",
      "Rafael",
      "Carlo",
    ];
    const data = {
      registration: {
        status: "submitted",
        fee_halalas: 180000,
        review_comment: "",
      },
      season: { name: "Sindikato Cup 2026" },
      division: { name: "Division B", roster_min: 8, roster_max: 15 },
      media: {},
      catalog: [],
      entries: players.map((name, index) => ({
        id: `e${index}`,
        player_id: `p${index}`,
        player_name: `${name} Dela Cruz`,
        jersey_number: [23, 7, 11, 3, 14, 5, 8, 10, 24][index],
        rating_snapshot: index === 8 ? null : index < 2 ? "B" : "C",
        active: true,
        accepted_at: null,
      })),
      reviews: [
        {
          action: "submitted",
          created_at: "2026-10-12T09:00:00Z",
          comment: "",
          profiles: { display_name: "Paolo Cruz" },
        },
        {
          action: "returned",
          created_at: "2026-10-11T09:00:00Z",
          comment: "Please confirm the jersey numbers.",
          profiles: { display_name: "Rey Santos" },
        },
      ],
    };
    const html = [
      renderToStaticMarkup(await hero()),
      renderToStaticMarkup(
        await RegistrationStatus({
          status: "submitted",
          seasonName: "Sindikato Cup 2026",
          comment: "",
        }),
      ),
      renderToStaticMarkup(
        <NextIntlClientProvider
          locale="en"
          messages={en}
          timeZone="Asia/Riyadh"
        >
          {await RegistrationDetails({
            data: data as never,
            showStatus: false,
            showSummary: false,
          })}
        </NextIntlClientProvider>,
      ),
    ];
    writeFileSync(
      process.env.REGISTRATION_PREVIEW,
      `<div class="mx-auto max-w-2xl space-y-6 py-6">${html.join("")}</div>`,
    );
  });
});
