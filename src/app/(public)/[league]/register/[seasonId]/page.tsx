import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { getTranslations, getFormatter } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { getAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { JoinRegistrationButton } from "@/components/registration/join-button";
import { cardVariants } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/ui/page-header";
import { formatSar } from "@/lib/format";
export default async function PublicRegistrationPage({
  params,
}: {
  params: Promise<{ league: string; seasonId: string }>;
}) {
  const { league: slug, seasonId } = await params;
  if (!z.uuid().safeParse(seasonId).success) notFound();
  const supabase = await createClient();
  const { data: league, error } = await supabase
    .from("leagues")
    .select("id,name")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw new Error("Unable to load league.");
  if (!league) notFound();
  const [season, settings, divisions] = await Promise.all([
    supabase
      .from("seasons")
      .select("name")
      .eq("league_id", league.id)
      .eq("id", seasonId)
      .eq("status", "published")
      .maybeSingle(),
    supabase
      .from("registration_settings")
      .select("is_open,deadline,fee_halalas,require_documents")
      .eq("league_id", league.id)
      .eq("season_id", seasonId)
      .maybeSingle(),
    supabase
      .from("divisions")
      .select("id,name,max_rating,roster_min,roster_max")
      .eq("league_id", league.id)
      .eq("season_id", seasonId)
      .order("name"),
  ]);
  if (season.error || settings.error || divisions.error)
    throw new Error("Unable to load public registration.");
  if (!season.data) notFound();
  const t = await getTranslations("Registration");
  const format = await getFormatter();
  const auth = await getAuth();
  const isOpen =
    settings.data?.is_open &&
    new Date(settings.data.deadline).getTime() > new Date().getTime();
  const path = `/${slug}/register/${seasonId}`;
  return (
    <main className="mx-auto max-w-2xl space-y-6 py-6">
      <PageHeader
        back={{ href: `/${slug}`, label: t("publicLeague") }}
        eyebrow={league.name}
        title={season.data.name}
        description={t("publicRegistrationIntro")}
      />
      {settings.data && (
        <div className={cn(cardVariants(), "space-y-3")}>
          <p>
            {t("deadlineValue", {
              date: format.dateTime(new Date(settings.data.deadline), {
                dateStyle: "medium",
                timeStyle: "short",
              }),
            })}
          </p>
          <p className="font-semibold">
            {t("feeValue", {
              amount: formatSar(format, settings.data.fee_halalas),
            })}
          </p>
          {settings.data.require_documents && (
            <p className="text-sm">{t("documentsRequired")}</p>
          )}
        </div>
      )}
      <ul className="space-y-3">
        {divisions.data?.map((division) => (
          <li key={division.id} className={cn(cardVariants(), "space-y-2")}>
            <h2 className="font-display text-2xl font-semibold">
              {division.name}
            </h2>
            <p>
              {t("divisionOption", {
                name: division.name,
                rating: division.max_rating,
              })}
            </p>
            <p className="text-sm text-muted-foreground">
              {t("rosterRange", {
                min: division.roster_min,
                max: division.roster_max,
              })}
            </p>
          </li>
        ))}
      </ul>
      {!isOpen ? (
        <p className="rounded-xl border bg-card p-4">
          {t("registrationClosed")}
        </p>
      ) : auth ? (
        <JoinRegistrationButton slug={slug} seasonId={seasonId} />
      ) : (
        <Button asChild className="w-full">
          <Link href={`/login?next=${encodeURIComponent(path)}`}>
            {t("signInRegister")}
          </Link>
        </Button>
      )}
    </main>
  );
}
