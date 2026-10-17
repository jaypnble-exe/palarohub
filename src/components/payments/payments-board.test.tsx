// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { writeFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { cleanup, render, screen, within } from "@testing-library/react";
import {
  NextIntlClientProvider,
  createFormatter,
  createTranslator,
} from "next-intl";
import en from "@/messages/en.json";
import { paymentStatus } from "@/lib/domain/payments";
import type { TeamPayments } from "@/lib/payments-data";
import { PaymentsBoard, type PaymentFilter } from "./payments-board";
import { PaymentSummary } from "./payment-summary";
import { LedgerForm } from "./ledger-form";
import { LedgerList } from "./ledger-list";

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
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/app/(admin)/admin/[league]/payments/actions", () => ({
  recordLedgerEntry: vi.fn(),
  reverseLedgerEntry: vi.fn(),
}));
afterEach(cleanup);

const team = (
  id: string,
  teamName: string,
  divisionName: string,
  paid: number,
  played: number,
  fines = 0,
): TeamPayments => ({
  seasonTeamId: id,
  teamName,
  divisionName,
  quotaHalalas: 180000,
  paidHalalas: paid,
  finesHalalas: fines,
  gamesPlayed: played,
  gamesTotal: 12,
  entries: [],
  status: paymentStatus({
    quotaHalalas: 180000,
    paidHalalas: paid,
    finesHalalas: fines,
    gamesTotal: 12,
    gamesCounted: played + 1,
  }),
});
const teams = [
  team("t1", "Riyadh Royals", "Division B", 180000, 3),
  team("t2", "Hail Hawks", "Division B", 30000, 4, 5000),
  team("t3", "Taif Titans", "Division B", 75000, 4),
  team("t4", "Jubail Stingers", "Division C", 0, 2),
];
const board = (filter: PaymentFilter = "all", division: string | null = null) =>
  PaymentsBoard({
    slug: "sindikato",
    teams,
    filter,
    division,
    link: ({ filter: f, division: d }) =>
      `/admin/sindikato/payments?show=${f ?? filter}&division=${d === undefined ? division : d}`,
  });

describe("payments board", () => {
  it("leads with totals and the teams that owe before their next game", async () => {
    render(await board());
    expect(screen.getByText(en.Payments.statCollected)).toBeInTheDocument();
    const behind = screen.getByRole("region", {
      name: en.Payments.behindListTitle,
    });
    const cards = within(behind).getAllByRole("listitem");
    // The team that owes most (fine included) comes first.
    expect(cards[0]).toHaveTextContent("Hail Hawks");
    expect(
      within(cards[0]).getByRole("link", { name: /Record payment/ }),
    ).toHaveAttribute("href", "/admin/sindikato/payments/t2");
    expect(within(behind).queryByText("Riyadh Royals")).toBeNull();
  });
  it("filters teams and counts each filter", async () => {
    render(await board("paid"));
    const filters = screen.getByRole("navigation", {
      name: en.Payments.filterLabel,
    });
    expect(
      within(filters).getByRole("link", { name: /Paid in full\s*1/ }),
    ).toHaveAttribute("aria-current", "page");
    const table = screen.getAllByRole("list", {
      name: en.Payments.teamsTitle,
    })[0];
    expect(within(table).getByText("Riyadh Royals")).toBeInTheDocument();
    expect(within(table).queryByText("Hail Hawks")).toBeNull();
  });
  it("narrows everything to one division", async () => {
    render(await board("all", "Division C"));
    expect(screen.getByRole("link", { name: "Division C" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.queryByText("Riyadh Royals")).toBeNull();
  });
  it("writes a static preview for visual checks when asked", async () => {
    if (!process.env.PAYMENTS_PREVIEW) return;
    writeFileSync(
      process.env.PAYMENTS_PREVIEW,
      renderToStaticMarkup(await board()),
    );
  });
  it("writes a static preview of one team's page when asked", async () => {
    if (!process.env.PAYMENT_TEAM_PREVIEW) return;
    const hawks = {
      ...teams[1],
      entries: [
        {
          id: "e3",
          kind: "fine",
          amountHalalas: 5000,
          method: null,
          fineReason: "technical",
          reversesId: null,
          note: "Coach technical in round 3",
          paidOn: "2026-10-30",
          createdAt: "",
          reversed: false,
        },
        {
          id: "e2",
          kind: "payment",
          amountHalalas: 15000,
          method: "stc_pay",
          fineReason: null,
          reversesId: null,
          note: "",
          paidOn: "2026-10-23",
          createdAt: "",
          reversed: true,
        },
        {
          id: "e1",
          kind: "payment",
          amountHalalas: 30000,
          method: "cash",
          fineReason: null,
          reversesId: null,
          note: "First two games",
          paidOn: "2026-10-16",
          createdAt: "",
          reversed: false,
        },
      ],
    } as TeamPayments;
    const summary = renderToStaticMarkup(await PaymentSummary({ team: hawks }));
    const client = renderToStaticMarkup(
      <NextIntlClientProvider locale="en" messages={en} timeZone="Asia/Riyadh">
        <div className="grid items-start gap-6 lg:grid-cols-[1fr_1.1fr]">
          <div className="space-y-6">
            <div dangerouslySetInnerHTML={{ __html: summary }} />
            <LedgerForm
              slug="sindikato"
              seasonTeamId="t2"
              today="2026-10-31"
              suggestedHalalas={hawks.status.behindByHalalas}
              perGameHalalas={hawks.status.perGameHalalas}
              balanceHalalas={hawks.status.balanceHalalas}
            />
          </div>
          <LedgerList slug="sindikato" entries={hawks.entries} canEdit />
        </div>
      </NextIntlClientProvider>,
    );
    writeFileSync(process.env.PAYMENT_TEAM_PREVIEW, client);
  });
});
