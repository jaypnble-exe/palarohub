import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Button } from "./ui/button";

export async function AccessDenied() {
  const t = await getTranslations("Access");
  return (
    <main className="space-y-4 py-10">
      <h1 className="text-2xl font-bold">{t("title")}</h1>
      <p className="text-muted-foreground">{t("description")}</p>
      <Button asChild>
        <Link href="/leagues">{t("back")}</Link>
      </Button>
    </main>
  );
}
