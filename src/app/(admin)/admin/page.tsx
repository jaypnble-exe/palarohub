import { getTranslations } from "next-intl/server";
import { isPlatformAdmin } from "@/lib/auth";
import { AccessDenied } from "@/components/access-denied";
import { CreateLeagueForm } from "@/components/admin/create-league-form";

export default async function PlatformAdminPage() {
  if (!(await isPlatformAdmin())) return <AccessDenied />;
  const t = await getTranslations("CreateLeague");
  return (
    <main className="mx-auto max-w-lg space-y-6 py-10">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">{t("title")}</h1>
        <p className="text-muted-foreground">{t("intro")}</p>
      </div>
      <CreateLeagueForm />
    </main>
  );
}
