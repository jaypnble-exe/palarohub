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
    <div role="group" aria-label={t("label")} className="flex gap-1">
      {locales.map((option) => (
        <button
          key={option}
          type="button"
          aria-pressed={locale === option}
          disabled={pending}
          onClick={() => startTransition(() => setLocale(option))}
          className="min-h-11 min-w-11 rounded-lg px-3 text-sm font-semibold hover:bg-slate-200 aria-pressed:bg-slate-900 aria-pressed:text-white disabled:opacity-60"
        >
          {t(option)}
        </button>
      ))}
    </div>
  );
}
