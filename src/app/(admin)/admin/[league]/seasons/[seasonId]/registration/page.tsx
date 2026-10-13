import { notFound } from "next/navigation";
import { z } from "zod";
import { getTranslations } from "next-intl/server";
import { getLeagueAccess } from "@/lib/league-access";
import { getSiteUrl } from "@/lib/auth";
import { AccessDenied } from "@/components/access-denied";
import { RegistrationSettingsForm } from "@/components/registration/settings-form";
import { RegistrationShareLink } from "@/components/registration/share-link";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
export default async function SeasonRegistrationSettings({
  params,
}: {
  params: Promise<{ league: string; seasonId: string }>;
}) {
  const { league: slug, seasonId } = await params;
  if (!z.uuid().safeParse(seasonId).success) notFound();
  const { supabase, league, canView, canManage } = await getLeagueAccess(slug);
  if (!canView) return <AccessDenied />;
  const [season, settings] = await Promise.all([
    supabase
      .from("seasons")
      .select("name,status")
      .eq("league_id", league.id)
      .eq("id", seasonId)
      .maybeSingle(),
    supabase
      .from("registration_settings")
      .select("*")
      .eq("league_id", league.id)
      .eq("season_id", seasonId)
      .maybeSingle(),
  ]);
  if (season.error || settings.error)
    throw new Error("Unable to load registration settings.");
  if (!season.data) notFound();
  const t = await getTranslations("Registration");
  return (
    <main className="mx-auto max-w-2xl space-y-6 py-6">
      <PageHeader
        back={{
          href: `/admin/${slug}/seasons/${seasonId}`,
          label: t("seasonSetup"),
        }}
        eyebrow={season.data.name}
        title={t("registrationSettings")}
      />
      {season.data.status !== "published" ? (
        <EmptyState title={t("publishFirst")} />
      ) : (
        <>
          <RegistrationSettingsForm
            slug={slug}
            canManage={canManage}
            initial={{
              seasonId,
              isOpen: settings.data?.is_open ?? false,
              deadline:
                settings.data?.deadline ??
                new Date(new Date().getTime() + 7 * 86400000).toISOString(),
              feeHalalas: settings.data?.fee_halalas ?? 0,
              requireDocuments: settings.data?.require_documents ?? false,
            }}
          />
          <RegistrationShareLink
            url={`${getSiteUrl()}/${slug}/register/${seasonId}`}
          />
        </>
      )}
    </main>
  );
}
