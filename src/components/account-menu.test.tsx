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
import { forgetAccount, switchAccount } from "@/app/auth/accounts";
import { AccountMenu } from "./account-menu";

const { refresh } = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("@/app/auth/actions", () => ({ signOut: vi.fn() }));
vi.mock("@/app/auth/accounts", () => ({
  addAccount: vi.fn(),
  switchAccount: vi.fn(),
  forgetAccount: vi.fn(),
}));
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});
const saved = [
  {
    id: "30000000-0000-4000-8000-000000000004",
    email: "paolo@example.com",
    name: "Paolo Cruz",
  },
];

function renderMenu(accounts: typeof saved = []) {
  render(
    <NextIntlClientProvider locale="en" messages={en} timeZone="Asia/Riyadh">
      <header className="bg-navy text-on-dark">
        <div className="mx-auto flex min-h-16 max-w-4xl items-center justify-end px-5 py-2">
          <AccountMenu
            name="Pejay Paronable"
            email="pjparonable@gmail.com"
            accounts={accounts}
          />
        </div>
      </header>
    </NextIntlClientProvider>,
  );
}
const toggle = () =>
  screen.getByRole("button", { name: "Account menu for Pejay Paronable" });

describe("account menu", () => {
  it("shows initials and opens the account options", () => {
    renderMenu();
    expect(toggle()).toHaveAttribute("aria-expanded", "false");
    expect(toggle()).toHaveTextContent("PP");
    fireEvent.click(toggle());
    expect(toggle()).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("pjparonable@gmail.com")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: en.Header.switchLeague }),
    ).toHaveAttribute("href", "/leagues");
    expect(
      screen.getByRole("link", { name: en.Header.changePassword }),
    ).toHaveAttribute("href", "/leagues/password");
    expect(
      screen.getByRole("button", { name: en.Header.signOut }),
    ).toBeInTheDocument();
    if (process.env.HEADER_PREVIEW)
      writeFileSync(process.env.HEADER_PREVIEW, document.body.innerHTML);
  });
  it("no longer shows a My leagues link in the header", () => {
    renderMenu();
    expect(screen.queryByText("My leagues")).not.toBeInTheDocument();
  });
  it("closes with Escape, a tap outside, or after choosing a link", () => {
    renderMenu();
    fireEvent.click(toggle());
    fireEvent.keyDown(document, { key: "Escape" });
    expect(toggle()).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(toggle());
    fireEvent.pointerDown(document.body);
    expect(toggle()).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(toggle());
    fireEvent.click(screen.getByRole("link", { name: en.Header.switchLeague }));
    expect(toggle()).toHaveAttribute("aria-expanded", "false");
  });
  it("switches to another saved account in one tap", async () => {
    vi.mocked(switchAccount).mockResolvedValue({ error: "expired" });
    renderMenu(saved);
    fireEvent.click(toggle());
    expect(
      screen.getByRole("button", { name: en.Accounts.add }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Paolo Cruz/ }));
    await waitFor(() =>
      expect(switchAccount).toHaveBeenCalledWith(saved[0].id),
    );
    // A session that ended asks for the password again.
    expect(
      await screen.findByText(/paolo@example.com was signed out/),
    ).toBeInTheDocument();
  });
  it("removes a saved account from this device", async () => {
    renderMenu(saved);
    fireEvent.click(toggle());
    fireEvent.click(
      screen.getByRole("button", {
        name: "Remove paolo@example.com from this device",
      }),
    );
    await waitFor(() =>
      expect(forgetAccount).toHaveBeenCalledWith(saved[0].id),
    );
  });
});
