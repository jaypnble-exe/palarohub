"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { sendMagicLink } from "@/app/auth/actions";
import { emailSchema } from "@/lib/validation/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function LoginForm({ next }: { next: string }) {
  const t = useTranslations("Login");
  const [status, setStatus] = useState<string>();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<{ email: string }>({ resolver: zodResolver(emailSchema) });
  return (
    <form
      onSubmit={handleSubmit(async (values) => {
        setStatus(undefined);
        try {
          const result = await sendMagicLink(values, next);
          setStatus("error" in result ? result.error : "linkSent");
        } catch {
          setStatus("sendFailed");
        }
      })}
      className="space-y-4"
      noValidate
    >
      <div className="space-y-2">
        <label htmlFor="email" className="text-sm font-medium">
          {t("email")}
        </label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          {...register("email")}
          aria-invalid={Boolean(errors.email)}
          aria-describedby={errors.email ? "email-error" : undefined}
        />
        {errors.email && (
          <p id="email-error" className="text-sm text-destructive">
            {t("invalidEmail")}
          </p>
        )}
      </div>
      <Button type="submit" disabled={isSubmitting} className="w-full">
        {t(isSubmitting ? "sending" : "sendLink")}
      </Button>
      {status && (
        <p role="status" className="text-sm leading-relaxed">
          {t(status)}
        </p>
      )}
    </form>
  );
}
