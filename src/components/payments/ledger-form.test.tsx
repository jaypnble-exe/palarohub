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
import { recordLedgerEntry } from "@/app/(admin)/admin/[league]/payments/actions";
import { LedgerForm } from "./ledger-form";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));
vi.mock("@/app/(admin)/admin/[league]/payments/actions", () => ({
  recordLedgerEntry: vi.fn(),
}));
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});
const team = "b6000000-0000-4000-8000-000000000001";
function renderForm(suggested = 15000) {
  render(
    <NextIntlClientProvider locale="en" messages={en} timeZone="Asia/Riyadh">
      <LedgerForm
        slug="sindikato"
        seasonTeamId={team}
        today="2026-10-23"
        suggestedHalalas={suggested}
      />
    </NextIntlClientProvider>,
  );
}

describe("payment form", () => {
  it("records a payment in halalas with the chosen method", async () => {
    vi.mocked(recordLedgerEntry).mockResolvedValue({ success: true });
    renderForm();
    expect(screen.getByLabelText(en.Payments.amount)).toHaveValue("150.00");
    fireEvent.click(
      screen.getByRole("button", { name: en.Payments.methods.stc_pay }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: en.Payments.savePayment }),
    );
    await waitFor(() =>
      expect(recordLedgerEntry).toHaveBeenCalledWith("sindikato", {
        seasonTeamId: team,
        kind: "payment",
        amountHalalas: 15000,
        method: "stc_pay",
        fineReason: null,
        note: "",
        paidOn: "2026-10-23",
      }),
    );
  });

  it("records a fine with its reason", async () => {
    vi.mocked(recordLedgerEntry).mockResolvedValue({ success: true });
    renderForm(0);
    fireEvent.click(screen.getByRole("button", { name: en.Payments.addFine }));
    fireEvent.change(screen.getByLabelText(en.Payments.amount), {
      target: { value: "50" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: en.Payments.reasons.no_show }),
    );
    fireEvent.click(screen.getByRole("button", { name: en.Payments.saveFine }));
    await waitFor(() =>
      expect(recordLedgerEntry).toHaveBeenCalledWith(
        "sindikato",
        expect.objectContaining({
          kind: "fine",
          amountHalalas: 5000,
          method: null,
          fineReason: "no_show",
        }),
      ),
    );
  });

  it("refuses amounts that are not SAR", () => {
    renderForm(0);
    fireEvent.change(screen.getByLabelText(en.Payments.amount), {
      target: { value: "1,50.5.0" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: en.Payments.savePayment }),
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      en.Payments.invalidAmount,
    );
    expect(recordLedgerEntry).not.toHaveBeenCalled();
  });
  it("fills the usual amounts in one tap", () => {
    render(
      <NextIntlClientProvider locale="en" messages={en} timeZone="Asia/Riyadh">
        <LedgerForm
          slug="sindikato"
          seasonTeamId={team}
          today="2026-10-23"
          suggestedHalalas={45000}
          perGameHalalas={15000}
          balanceHalalas={180000}
        />
      </NextIntlClientProvider>,
    );
    const amount = screen.getByLabelText(en.Payments.amount);
    expect(amount).toHaveValue("450.00");
    fireEvent.click(screen.getByRole("button", { name: /One game/ }));
    expect(amount).toHaveValue("150.00");
    fireEvent.click(screen.getByRole("button", { name: /Everything left/ }));
    expect(amount).toHaveValue("1800.00");
    expect(
      screen.getByRole("button", { name: /Everything left/ }),
    ).toHaveAttribute("aria-pressed", "true");
  });
});
