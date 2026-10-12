import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { getTranslations } from "next-intl/server";
import { getLeagueAccess } from "@/lib/league-access";
import { getSiteUrl } from "@/lib/auth";
import { AccessDenied } from "@/components/access-denied";
import { Button } from "@/components/ui/button";
import { RegistrationSettingsForm } from "@/components/registration/settings-form";
import { RegistrationShareLink } from "@/components/registration/share-link";
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
    <main className="mx-auto max-w-2xl space-y-6 py-8">
      <Button asChild variant="ghost">
        <Link href={`/admin/${slug}/seasons/${seasonId}`}>
          {t("seasonSetup")}
        </Link>
      </Button>
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">{season.data.name}</p>
        <h1 className="font-display text-3xl font-semibold">
          {t("registrationSettings")}
        </h1>
      </div>
      {season.data.status !== "published" ? (
        <p className="rounded-2xl border bg-card p-5">{t("publishFirst")}</p>
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
