import { getTranslations } from "next-intl/server";
import { LanguageSwitcher } from "@/components/language-switcher";

export default async function Home() {
  const t = await getTranslations("Home");
  return (
    <div className="mx-auto flex min-h-screen w-full max-w-3xl flex-col px-5">
      <header className="flex items-center justify-between gap-4 py-5">
        <span className="font-semibold">{t("name")}</span>
        <LanguageSwitcher />
      </header>
      <main className="flex flex-1 flex-col justify-center gap-5 py-16">
        <h1 className="text-5xl font-bold tracking-tight sm:text-6xl">
          {t("name")}
        </h1>
        <p className="max-w-lg text-xl leading-relaxed text-slate-600">
          {t("tagline")}
        </p>
      </main>
    </div>
  );
}
