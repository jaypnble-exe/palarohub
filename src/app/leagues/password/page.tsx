import { getTranslations } from "next-intl/server";
import { requireUser } from "@/lib/auth";
import { PageHeader } from "@/components/ui/page-header";
import { PasswordForm } from "@/components/password-form";

/** Where password reset links land, and where signed-in people change it. */
export default async function PasswordPage() {
  await requireUser("/leagues/password");
  const t = await getTranslations("Login");
  return (
    <main className="mx-auto w-full max-w-md space-y-6 py-8">
      <PageHeader
        back={{ href: "/leagues", label: t("backToLeagues") }}
        title={t("passwordTitle")}
        description={t("passwordIntro")}
      />
      <PasswordForm />
    </main>
  );
}
