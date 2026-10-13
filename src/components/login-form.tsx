"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  requestPasswordReset,
  sendMagicLink,
  signInWithPassword,
  signUpWithPassword,
  type AuthResult,
} from "@/app/auth/actions";
import {
  emailSchema,
  passwordSchema,
  signUpSchema,
} from "@/lib/validation/auth";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ChipGroup } from "@/components/ui/chip";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

type Mode = "signIn" | "signUp" | "reset" | "link";

/**
 * Email and password first. "Forgot password?" and "Email me a sign-in link"
 * are backups for people who cannot or would rather not use a password.
 */
export function LoginForm({ next }: { next: string }) {
  const t = useTranslations("Login");
  const [mode, setMode] = useState<Mode>("signIn");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<AuthResult>();
  const [invalid, setInvalid] = useState<"email" | "password" | "name">();

  function switchTo(value: Mode) {
    setMode(value);
    setResult(undefined);
    setInvalid(undefined);
  }

  async function submit() {
    setResult(undefined);
    setInvalid(undefined);
    if (!emailSchema.safeParse({ email }).success) return setInvalid("email");
    if (mode === "signUp") {
      if (!signUpSchema.shape.name.safeParse(name).success)
        return setInvalid("name");
      if (!passwordSchema.safeParse(password).success)
        return setInvalid("password");
    }
    if (mode === "signIn" && !password) return setInvalid("password");
    setBusy(true);
    try {
      const outcome =
        mode === "signIn"
          ? await signInWithPassword({ email, password }, next)
          : mode === "signUp"
            ? await signUpWithPassword({ name, email, password }, next)
            : mode === "reset"
              ? await requestPasswordReset({ email })
              : await sendMagicLink({ email }, next);
      if ("success" in outcome && outcome.redirectTo) {
        // A full load so every page sees the new session.
        window.location.assign(outcome.redirectTo);
        return;
      }
      setResult(outcome);
    } catch {
      setResult({ error: "signInFailed" });
    }
    setBusy(false);
  }

  const passwordMode = mode === "signIn" || mode === "signUp";
  return (
    <div className="space-y-5">
      {passwordMode && (
        <ChipGroup
          label={t("mode")}
          stretch
          value={mode}
          onChange={switchTo}
          options={[
            { value: "signIn", label: t("signInTab") },
            { value: "signUp", label: t("signUpTab") },
          ]}
        />
      )}
      {!passwordMode && (
        <div className="space-y-1">
          <h2 className="text-xl font-semibold">
            {t(mode === "reset" ? "resetTitle" : "linkTitle")}
          </h2>
          <p className="text-sm text-muted-foreground">
            {t(mode === "reset" ? "resetHelp" : "linkHelp")}
          </p>
        </div>
      )}
      <form
        className="space-y-4"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        {mode === "signUp" && (
          <Field
            id="name"
            label={t("name")}
            error={invalid === "name" ? t("nameRequired") : undefined}
          >
            <Input
              id="name"
              autoComplete="name"
              value={name}
              maxLength={100}
              onChange={(event) => setName(event.target.value)}
              aria-invalid={invalid === "name"}
            />
          </Field>
        )}
        <Field
          id="email"
          label={t("email")}
          error={invalid === "email" ? t("invalidEmail") : undefined}
        >
          <Input
            id="email"
            type="email"
            autoComplete="email"
            inputMode="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            aria-invalid={invalid === "email"}
          />
        </Field>
        {passwordMode && (
          <Field
            id="password"
            label={t("password")}
            help={mode === "signUp" ? t("passwordHelp") : undefined}
            error={
              invalid === "password"
                ? t(mode === "signUp" ? "passwordTooShort" : "passwordRequired")
                : undefined
            }
          >
            <div className="flex gap-2">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete={
                  mode === "signUp" ? "new-password" : "current-password"
                }
                value={password}
                maxLength={72}
                onChange={(event) => setPassword(event.target.value)}
                aria-invalid={invalid === "password"}
              />
              <Button
                type="button"
                variant="outline"
                aria-pressed={showPassword}
                onClick={() => setShowPassword(!showPassword)}
              >
                {t(showPassword ? "hidePassword" : "showPassword")}
              </Button>
            </div>
          </Field>
        )}
        <Button type="submit" disabled={busy} className="w-full">
          {t(
            busy
              ? "working"
              : mode === "signIn"
                ? "signInButton"
                : mode === "signUp"
                  ? "signUpButton"
                  : mode === "reset"
                    ? "resetButton"
                    : "sendLink",
          )}
        </Button>
      </form>
      {result && (
        <Alert tone={"error" in result ? "danger" : "success"}>
          {t("error" in result ? result.error : (result.message ?? "done"))}
        </Alert>
      )}
      <div className="flex flex-col items-start gap-1 text-sm">
        {mode !== "signIn" && (
          <button
            type="button"
            className="min-h-11 font-semibold text-orange-dark hover:underline"
            onClick={() => switchTo("signIn")}
          >
            {t("backToSignIn")}
          </button>
        )}
        {mode !== "reset" && (
          <button
            type="button"
            className="min-h-11 font-semibold text-orange-dark hover:underline"
            onClick={() => switchTo("reset")}
          >
            {t("forgotPassword")}
          </button>
        )}
        {mode !== "link" && (
          <button
            type="button"
            className="min-h-11 font-semibold text-orange-dark hover:underline"
            onClick={() => switchTo("link")}
          >
            {t("useLink")}
          </button>
        )}
      </div>
    </div>
  );
}
