"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { updatePassword, type AuthResult } from "@/app/auth/actions";
import { passwordSchema } from "@/lib/validation/auth";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

/** Choose a new password: after a reset link, or any time while signed in. */
export function PasswordForm() {
  const t = useTranslations("Login");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [invalid, setInvalid] = useState<"password" | "confirm">();
  const [result, setResult] = useState<AuthResult>();
  return (
    <form
      className="space-y-4"
      noValidate
      onSubmit={async (event) => {
        event.preventDefault();
        setResult(undefined);
        setInvalid(undefined);
        if (!passwordSchema.safeParse(password).success)
          return setInvalid("password");
        if (password !== confirm) return setInvalid("confirm");
        setBusy(true);
        try {
          setResult(await updatePassword({ password, confirm }));
        } catch {
          setResult({ error: "signInFailed" });
        }
        setBusy(false);
      }}
    >
      <Field
        id="new-password"
        label={t("newPassword")}
        help={t("passwordHelp")}
        error={invalid === "password" ? t("passwordTooShort") : undefined}
      >
        <div className="flex gap-2">
          <Input
            id="new-password"
            type={show ? "text" : "password"}
            autoComplete="new-password"
            value={password}
            maxLength={72}
            onChange={(event) => setPassword(event.target.value)}
            aria-invalid={invalid === "password"}
          />
          <Button
            type="button"
            variant="outline"
            aria-pressed={show}
            onClick={() => setShow(!show)}
          >
            {t(show ? "hidePassword" : "showPassword")}
          </Button>
        </div>
      </Field>
      <Field
        id="confirm-password"
        label={t("confirmPassword")}
        error={invalid === "confirm" ? t("passwordMismatch") : undefined}
      >
        <Input
          id="confirm-password"
          type={show ? "text" : "password"}
          autoComplete="new-password"
          value={confirm}
          maxLength={72}
          onChange={(event) => setConfirm(event.target.value)}
          aria-invalid={invalid === "confirm"}
        />
      </Field>
      <Button type="submit" disabled={busy} className="w-full">
        {t(busy ? "working" : "savePassword")}
      </Button>
      {result && (
        <Alert tone={"error" in result ? "danger" : "success"}>
          {t("error" in result ? result.error : "passwordSaved")}
        </Alert>
      )}
    </form>
  );
}
