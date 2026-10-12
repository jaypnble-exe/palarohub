import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default async function Home() {
  const t = await getTranslations("Home");
  return (
    <div className="mx-auto flex min-h-[75vh] w-full max-w-3xl flex-col">
      <main className="flex flex-1 flex-col justify-center gap-5 py-16">
        <h1 className="text-5xl font-bold tracking-tight sm:text-6xl">
          {t("name")}
        </h1>
        <p className="max-w-lg text-xl leading-relaxed text-slate-600">
          {t("tagline")}
        </p>
        <Button asChild className="mt-4 w-full sm:w-fit">
          <Link href="/login">{t("signIn")}</Link>
        </Button>
      </main>
    </div>
  );
}
