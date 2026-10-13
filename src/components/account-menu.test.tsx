// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { writeFileSync } from "node:fs";
import en from "@/messages/en.json";
import { AccountMenu } from "./account-menu";

vi.mock("@/app/auth/actions", () => ({ signOut: vi.fn() }));
afterEach(cleanup);

function renderMenu() {
  render(
    <NextIntlClientProvider locale="en" messages={en} timeZone="Asia/Riyadh">
      <header className="bg-navy text-on-dark">
        <div className="mx-auto flex min-h-16 max-w-4xl items-center justify-end px-5 py-2">
          <AccountMenu name="Pejay Paronable" email="pjparonable@gmail.com" />
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
});
