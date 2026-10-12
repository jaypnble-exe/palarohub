"use client";

import { useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { setLocale } from "@/i18n/actions";
import { locales } from "@/i18n/locales";

export function LanguageSwitcher() {
  const locale = useLocale();
  const t = useTranslations("Language");
  const [pending, startTransition] = useTransition();
  return (
    <div
      role="group"
      aria-label={t("label")}
      className="flex gap-1 rounded-full bg-navy-secondary p-1"
    >
      {locales.map((option) => (
        <button
          key={option}
          type="button"
          aria-pressed={locale === option}
          disabled={pending}
          onClick={() => startTransition(() => setLocale(option))}
          className="min-h-11 min-w-11 rounded-full px-3 text-sm font-bold text-on-dark-muted transition-colors hover:bg-white/10 aria-pressed:bg-background aria-pressed:text-foreground disabled:opacity-60"
        >
          {t(option)}
        </button>
      ))}
    </div>
  );
}
