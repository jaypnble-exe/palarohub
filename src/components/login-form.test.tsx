// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { writeFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import en from "@/messages/en.json";
import {
  requestPasswordReset,
  sendMagicLink,
  signInWithPassword,
  signUpWithPassword,
} from "@/app/auth/actions";
import { LoginForm } from "./login-form";

vi.mock("@/app/auth/actions", () => ({
  sendMagicLink: vi.fn(),
  signInWithPassword: vi.fn(),
  signUpWithPassword: vi.fn(),
  requestPasswordReset: vi.fn(),
}));
const assign = vi.fn();
beforeEach(() => {
  vi.stubGlobal("location", { ...window.location, assign });
});
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
  vi.unstubAllGlobals();
});

function renderLogin() {
  render(
    <NextIntlClientProvider locale="en" messages={en} timeZone="Asia/Riyadh">
      <LoginForm next="/admin/sindikato" />
    </NextIntlClientProvider>,
  );
}
const type = (label: string, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });

describe("password sign-in", () => {
  it("signs in with email and password and goes to the page asked for", async () => {
    vi.mocked(signInWithPassword).mockResolvedValue({
      success: true,
      redirectTo: "/admin/sindikato",
    });
    renderLogin();
    type(en.Login.email, "member@example.test");
    type(en.Login.password, "secret-pass");
    fireEvent.click(
      screen.getByRole("button", { name: en.Login.signInButton }),
    );
    await waitFor(() =>
      expect(assign).toHaveBeenCalledWith("/admin/sindikato"),
    );
    expect(signInWithPassword).toHaveBeenCalledWith(
      { email: "member@example.test", password: "secret-pass" },
      "/admin/sindikato",
    );
  });

  it("explains a wrong password in plain words", async () => {
    vi.mocked(signInWithPassword).mockResolvedValue({ error: "wrongPassword" });
    renderLogin();
    type(en.Login.email, "member@example.test");
    type(en.Login.password, "nope");
    fireEvent.click(
      screen.getByRole("button", { name: en.Login.signInButton }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Email or password is not right",
    );
    expect(assign).not.toHaveBeenCalled();
  });

  it("checks the email before asking the server", async () => {
    renderLogin();
    type(en.Login.email, "invalid");
    fireEvent.click(
      screen.getByRole("button", { name: en.Login.signInButton }),
    );
    expect(await screen.findByText(en.Login.invalidEmail)).toBeInTheDocument();
    expect(signInWithPassword).not.toHaveBeenCalled();
  });

  it("can show the password while typing", () => {
    renderLogin();
    const field = screen.getByLabelText(en.Login.password);
    expect(field).toHaveAttribute("type", "password");
    fireEvent.click(
      screen.getByRole("button", { name: en.Login.showPassword }),
    );
    expect(field).toHaveAttribute("type", "text");
  });
});

describe("creating an account", () => {
  it("needs a name and an 8-character password", async () => {
    renderLogin();
    fireEvent.click(screen.getByRole("button", { name: en.Login.signUpTab }));
    type(en.Login.name, "Juan Dela Cruz");
    type(en.Login.email, "juan@example.test");
    type(en.Login.password, "short");
    fireEvent.click(
      screen.getByRole("button", { name: en.Login.signUpButton }),
    );
    expect(
      await screen.findByText(en.Login.passwordTooShort),
    ).toBeInTheDocument();
    expect(signUpWithPassword).not.toHaveBeenCalled();
  });

  it("signs straight in when no confirmation is needed", async () => {
    vi.mocked(signUpWithPassword).mockResolvedValue({
      success: true,
      redirectTo: "/admin/sindikato",
    });
    renderLogin();
    fireEvent.click(screen.getByRole("button", { name: en.Login.signUpTab }));
    type(en.Login.name, "Juan Dela Cruz");
    type(en.Login.email, "juan@example.test");
    type(en.Login.password, "long-enough");
    fireEvent.click(
      screen.getByRole("button", { name: en.Login.signUpButton }),
    );
    await waitFor(() =>
      expect(assign).toHaveBeenCalledWith("/admin/sindikato"),
    );
    expect(signUpWithPassword).toHaveBeenCalledWith(
      {
        name: "Juan Dela Cruz",
        email: "juan@example.test",
        password: "long-enough",
      },
      "/admin/sindikato",
    );
  });

  it("says to confirm the email when Supabase still requires it", async () => {
    vi.mocked(signUpWithPassword).mockResolvedValue({
      success: true,
      message: "confirmEmail",
    });
    renderLogin();
    fireEvent.click(screen.getByRole("button", { name: en.Login.signUpTab }));
    type(en.Login.name, "Juan");
    type(en.Login.email, "juan@example.test");
    type(en.Login.password, "long-enough");
    fireEvent.click(
      screen.getByRole("button", { name: en.Login.signUpButton }),
    );
    expect(await screen.findByRole("status")).toHaveTextContent(
      en.Login.confirmEmail,
    );
  });
});

describe("backups", () => {
  it("emails a password reset link", async () => {
    vi.mocked(requestPasswordReset).mockResolvedValue({
      success: true,
      message: "resetSent",
    });
    renderLogin();
    fireEvent.click(
      screen.getByRole("button", { name: en.Login.forgotPassword }),
    );
    expect(screen.queryByLabelText(en.Login.password)).not.toBeInTheDocument();
    type(en.Login.email, "member@example.test");
    fireEvent.click(screen.getByRole("button", { name: en.Login.resetButton }));
    expect(await screen.findByRole("status")).toHaveTextContent(
      en.Login.resetSent,
    );
    expect(requestPasswordReset).toHaveBeenCalledWith({
      email: "member@example.test",
    });
  });

  it("still offers a sign-in link", async () => {
    vi.mocked(sendMagicLink).mockResolvedValue({
      success: true,
      message: "linkSent",
    });
    renderLogin();
    fireEvent.click(screen.getByRole("button", { name: en.Login.useLink }));
    type(en.Login.email, "member@example.test");
    fireEvent.click(screen.getByRole("button", { name: en.Login.sendLink }));
    expect(await screen.findByRole("status")).toHaveTextContent(
      en.Login.linkSent,
    );
    expect(sendMagicLink).toHaveBeenCalledWith(
      { email: "member@example.test" },
      "/admin/sindikato",
    );
  });

  it("shows plain feedback if the request fails", async () => {
    vi.mocked(sendMagicLink).mockRejectedValue(new Error("network"));
    renderLogin();
    fireEvent.click(screen.getByRole("button", { name: en.Login.useLink }));
    type(en.Login.email, "member@example.test");
    fireEvent.click(screen.getByRole("button", { name: en.Login.sendLink }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      en.Login.signInFailed,
    );
  });
});

it("writes a static preview for visual checks when asked", () => {
  if (!process.env.LOGIN_PREVIEW) return;
  writeFileSync(
    process.env.LOGIN_PREVIEW,
    renderToStaticMarkup(
      <NextIntlClientProvider locale="en" messages={en} timeZone="Asia/Riyadh">
        <main className="mx-auto w-full max-w-md space-y-7 py-10">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold">{en.Login.title}</h1>
            <p className="text-muted-foreground">{en.Login.intro}</p>
          </div>
          <LoginForm next="/leagues" />
        </main>
      </NextIntlClientProvider>,
    ),
  );
});
