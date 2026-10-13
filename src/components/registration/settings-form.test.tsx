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
import { writeFileSync } from "node:fs";
import en from "@/messages/en.json";
import { configureRegistration } from "@/app/(team)/team/[league]/actions";
import { toRiyadhDateTimeInput } from "@/lib/domain/riyadh-time";
import { deadlineInDays } from "@/lib/domain/registration-window";
import { RegistrationSettingsForm } from "./settings-form";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));
vi.mock("@/app/(team)/team/[league]/actions", () => ({
  configureRegistration: vi.fn(),
}));
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});
const seasonId = "50000000-0000-4000-8000-000000000001";

function renderForm(canManage = true) {
  render(
    <NextIntlClientProvider locale="en" messages={en} timeZone="Asia/Riyadh">
      <RegistrationSettingsForm
        slug="sindikato"
        canManage={canManage}
        initial={{
          seasonId,
          isOpen: false,
          deadline: "2026-11-01T18:00:00.000Z",
          feeHalalas: 180000,
          requireDocuments: false,
        }}
      />
    </NextIntlClientProvider>,
  );
}
const save = () =>
  screen.getByRole("button", { name: en.Registration.saveSettings });

describe("registration settings", () => {
  it("only offers Save once something changed", () => {
    renderForm();
    expect(save()).toBeDisabled();
    expect(screen.getByText(en.Registration.allSaved)).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("switch", { name: en.Registration.openRegistration }),
    );
    expect(save()).toBeEnabled();
    expect(
      screen.getByText(en.Registration.unsavedChanges),
    ).toBeInTheDocument();
    if (process.env.SETTINGS_PREVIEW)
      writeFileSync(process.env.SETTINGS_PREVIEW, document.body.innerHTML);
  });
  it("opens registration with a quick deadline and saves it", async () => {
    vi.mocked(configureRegistration).mockResolvedValue({ success: true });
    renderForm();
    fireEvent.click(
      screen.getByRole("switch", { name: en.Registration.openRegistration }),
    );
    expect(
      screen.getByRole("switch", { name: en.Registration.openRegistration }),
    ).toHaveAttribute("aria-checked", "true");
    fireEvent.click(
      screen.getByRole("button", { name: en.Registration.inTwoWeeks }),
    );
    const expected = deadlineInDays(new Date(), 14);
    expect(screen.getByLabelText(en.Registration.deadline)).toHaveValue(
      toRiyadhDateTimeInput(expected),
    );
    fireEvent.change(screen.getByLabelText(en.Registration.fee), {
      target: { value: "1500" },
    });
    fireEvent.click(save());
    await waitFor(() =>
      expect(configureRegistration).toHaveBeenCalledWith("sindikato", {
        seasonId,
        isOpen: true,
        deadline: expected,
        feeHalalas: 150000,
        requireDocuments: false,
      }),
    );
  });
  it("explains a fee it cannot read", async () => {
    renderForm();
    fireEvent.change(screen.getByLabelText(en.Registration.fee), {
      target: { value: "abc" },
    });
    fireEvent.click(save());
    expect(
      await screen.findByText(en.Registration.feeInvalid),
    ).toBeInTheDocument();
    expect(configureRegistration).not.toHaveBeenCalled();
  });
  it("is read-only for staff", () => {
    renderForm(false);
    expect(
      screen.getByRole("switch", { name: en.Registration.openRegistration }),
    ).toBeDisabled();
    expect(
      screen.queryByRole("button", { name: en.Registration.saveSettings }),
    ).toBeNull();
  });
});
