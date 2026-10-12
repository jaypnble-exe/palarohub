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
import { sendMagicLink } from "@/app/auth/actions";
import { LoginForm } from "./login-form";

vi.mock("@/app/auth/actions", () => ({ sendMagicLink: vi.fn() }));
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

function renderLogin() {
  render(
    <NextIntlClientProvider locale="en" messages={en} timeZone="Asia/Riyadh">
      <LoginForm next="/admin/sindikato" />
    </NextIntlClientProvider>,
  );
}

describe("email sign-in", () => {
  it("rejects invalid email without requesting a link", async () => {
    renderLogin();
    fireEvent.change(screen.getByLabelText(en.Login.email), {
      target: { value: "invalid" },
    });
    fireEvent.click(screen.getByRole("button", { name: en.Login.sendLink }));
    expect(await screen.findByText(en.Login.invalidEmail)).toBeInTheDocument();
    expect(sendMagicLink).not.toHaveBeenCalled();
  });
  it("sends a link and explains how to use it", async () => {
    vi.mocked(sendMagicLink).mockResolvedValue({ success: true });
    renderLogin();
    fireEvent.change(screen.getByLabelText(en.Login.email), {
      target: { value: "member@example.test" },
    });
    fireEvent.click(screen.getByRole("button", { name: en.Login.sendLink }));
    expect(await screen.findByText(en.Login.linkSent)).toBeInTheDocument();
    expect(sendMagicLink).toHaveBeenCalledWith(
      { email: "member@example.test" },
      "/admin/sindikato",
    );
  });
  it("shows plain feedback if the request fails", async () => {
    vi.mocked(sendMagicLink).mockRejectedValue(new Error("network"));
    renderLogin();
    fireEvent.change(screen.getByLabelText(en.Login.email), {
      target: { value: "member@example.test" },
    });
    fireEvent.click(screen.getByRole("button", { name: en.Login.sendLink }));
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent(en.Login.sendFailed),
    );
  });
});
