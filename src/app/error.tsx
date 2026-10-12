"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

export default function ErrorPage({ reset }: { reset: () => void }) {
  const t = useTranslations("Error");
  return (
    <main className="space-y-4 py-10">
      <h1 className="text-2xl font-bold">{t("title")}</h1>
      <p>{t("description")}</p>
      <Button onClick={reset}>{t("retry")}</Button>
    </main>
  );
}
