import { getTranslations } from "next-intl/server";
import { isPlatformAdmin } from "@/lib/auth";
import { AccessDenied } from "@/components/access-denied";
import { CreateLeagueForm } from "@/components/admin/create-league-form";
import { PageHeader } from "@/components/ui/page-header";

export default async function NewLeaguePage() {
  if (!(await isPlatformAdmin())) return <AccessDenied />;
  const t = await getTranslations("CreateLeague");
  const platform = await getTranslations("Platform");
  return (
    <main className="mx-auto max-w-lg space-y-6 py-8">
      <PageHeader
        back={{ href: "/admin", label: platform("back") }}
        title={t("title")}
        description={t("intro")}
      />
      <CreateLeagueForm />
    </main>
  );
}
