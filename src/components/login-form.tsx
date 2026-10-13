"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  requestPasswordReset,
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
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Icon } from "@/components/ui/icon";

type Mode = "signIn" | "signUp" | "reset";

/**
 * Email and password. "Forgot password?" emails a link to choose a new one.
 * People arriving from a registration link start on "I'm new".
 */
export function LoginForm({
  next,
  startNew = false,
}: {
  next: string;
  startNew?: boolean;
}) {
  const t = useTranslations("Login");
  const [mode, setMode] = useState<Mode>(startNew ? "signUp" : "signIn");
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
            : await requestPasswordReset({ email });
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
  const heading = {
    signIn: ["welcomeBack", "welcomeBackHelp"],
    signUp: ["createAccount", "createAccountHelp"],
    reset: ["resetTitle", "resetHelp"],
  } as const;
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="font-display text-3xl font-semibold tracking-wide uppercase">
          {t(heading[mode][0])}
        </h1>
        <p className="text-muted-foreground">{t(heading[mode][1])}</p>
      </div>
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
            {mode === "signIn" && (
              <div className="flex justify-end">
                <button
                  type="button"
                  className="min-h-11 text-sm font-semibold text-orange-dark hover:underline"
                  onClick={() => switchTo("reset")}
                >
                  {t("forgotPassword")}
                </button>
              </div>
            )}
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
                  : "resetButton",
          )}
        </Button>
      </form>
      {result && (
        <Alert tone={"error" in result ? "danger" : "success"}>
          {t("error" in result ? result.error : (result.message ?? "done"))}
        </Alert>
      )}
      {passwordMode && (
        <p className="flex flex-wrap items-center justify-center gap-x-2 border-t border-border pt-5 text-sm text-muted-foreground">
          {t(mode === "signIn" ? "newHere" : "haveAccount")}
          <button
            type="button"
            className="min-h-11 font-bold text-orange-dark hover:underline"
            onClick={() => switchTo(mode === "signIn" ? "signUp" : "signIn")}
          >
            {t(mode === "signIn" ? "signUpTab" : "signInTab")}
          </button>
        </p>
      )}
      {mode === "reset" && (
        <button
          type="button"
          className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-orange-dark hover:underline"
          onClick={() => switchTo("signIn")}
        >
          <Icon name="back" className="size-4" />
          {t("backToSignIn")}
        </button>
      )}
    </div>
  );
}
