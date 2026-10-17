import { getTranslations } from "next-intl/server";
import { getLeagueAccess } from "@/lib/league-access";
import { createClient } from "@/lib/supabase/server";
import { AdminNav } from "@/components/admin/admin-nav";
import { Alert } from "@/components/ui/alert";

/** Every commissioner page shares the same navigation. */
export default async function LeagueAdminLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ league: string }>;
}) {
  const { league: slug } = await params;
  const { canView } = await getLeagueAccess(slug);
  if (!canView) return children;
  const supabase = await createClient();
  const { data: league } = await supabase
    .from("leagues")
    .select("paused_at,paused_reason")
    .eq("slug", slug)
    .maybeSingle();
  const t = await getTranslations("AdminHome");
  return (
    <div className="pb-24 sm:pb-10">
      <AdminNav slug={slug} />
      {league?.paused_at && (
        <Alert tone="danger" className="mt-4">
          <strong>{t("pausedTitle")}</strong>{" "}
          {t("pausedBody", { reason: league.paused_reason })}
        </Alert>
      )}
      {children}
    </div>
  );
}
