import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { getFormatter, getTranslations } from "next-intl/server";
import { getLeagueAccess } from "@/lib/league-access";
import { getSiteUrl } from "@/lib/auth";
import {
  daysLeft,
  registrationState,
  type RegistrationState,
} from "@/lib/domain/registration-window";
import { filterCounts, type RegistrationStatus } from "@/lib/teams-table";
import { AccessDenied } from "@/components/access-denied";
import { RegistrationSettingsForm } from "@/components/registration/settings-form";
import { ShareButtons } from "@/components/share-buttons";
import { Alert } from "@/components/ui/alert";
import { cardVariants } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { cn } from "@/lib/utils";

const stateStyle: Record<RegistrationState, string> = {
  open: "bg-success-soft text-success",
  closed: "bg-accent text-foreground",
  ended: "bg-orange-soft text-orange-dark",
  notSetUp: "bg-accent text-foreground",
};

/** Open registration for a season and share the link with team managers. */
export default async function SeasonRegistrationSettings({
  params,
}: {
  params: Promise<{ league: string; seasonId: string }>;
}) {
  const { league: slug, seasonId } = await params;
  if (!z.uuid().safeParse(seasonId).success) notFound();
  const { supabase, league, canView, canManage } = await getLeagueAccess(slug);
  if (!canView) return <AccessDenied />;
  const [season, settings, registrations] = await Promise.all([
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
    supabase
      .from("season_teams")
      .select("status")
      .eq("league_id", league.id)
      .eq("season_id", seasonId),
  ]);
  if (season.error || settings.error || registrations.error)
    throw new Error("Unable to load registration settings.");
  if (!season.data) notFound();
  const t = await getTranslations("Registration");
  const format = await getFormatter();
  const now = new Date();
  const state = registrationState(
    settings.data
      ? { isOpen: settings.data.is_open, deadline: settings.data.deadline }
      : null,
    now,
  );
  const counts = filterCounts(
    (registrations.data ?? []).map((row) => ({
      status: row.status as RegistrationStatus,
    })),
  );
  const deadline = settings.data
    ? format.dateTime(new Date(settings.data.deadline), {
        weekday: "short",
        day: "numeric",
        month: "short",
        hour: "numeric",
        minute: "2-digit",
      })
    : "";
  const url = `${getSiteUrl()}/${slug}/register/${seasonId}`;
  const teams = `/admin/${slug}/teams?season=${seasonId}`;
  const tiles = [
    { key: "all", href: teams, label: t("countRegistered") },
    {
      key: "waiting",
      href: `${teams}&status=waiting`,
      label: t("countWaiting"),
    },
    {
      key: "approved",
      href: `${teams}&status=approved`,
      label: t("countApproved"),
    },
  ] as const;
  return (
    <main className="mx-auto max-w-2xl space-y-6 py-6">
      <PageHeader
        back={{
          href: `/admin/${slug}/seasons/${seasonId}`,
          label: t("seasonSetup"),
        }}
        eyebrow={season.data.name}
        title={t("registrationSettings")}
        description={t("registrationPageIntro")}
      />
      {season.data.status !== "published" ? (
        <EmptyState icon="seasons" title={t("publishFirst")} />
      ) : (
        <>
          <section
            aria-labelledby="registration-state"
            className={cn("space-y-4 rounded-2xl p-5", stateStyle[state])}
          >
            <div className="flex items-start gap-3">
              <Icon
                name={
                  state === "open"
                    ? "check"
                    : state === "ended"
                      ? "alert"
                      : "info"
                }
                className="mt-0.5 size-6 shrink-0"
              />
              <div className="space-y-1">
                <h2 id="registration-state" className="text-lg font-bold">
                  {t(`state.${state}.title`)}
                </h2>
                <p className="text-sm font-semibold opacity-90">
                  {t(`state.${state}.body`, {
                    deadline,
                    days: settings.data
                      ? daysLeft(settings.data.deadline, now)
                      : 0,
                  })}
                </p>
              </div>
            </div>
            <ul className="grid grid-cols-3 gap-2">
              {tiles.map((tile) => (
                <li key={tile.key}>
                  <Link
                    href={tile.href}
                    className="block rounded-xl bg-card/80 p-3 text-foreground transition-colors hover:bg-card"
                  >
                    <span className="block text-xs font-semibold text-muted-foreground">
                      {tile.label}
                    </span>
                    <span className="block font-display text-3xl font-semibold">
                      {counts[tile.key]}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>

          <section className={cn(cardVariants(), "space-y-4")}>
            <div className="space-y-1">
              <h2 className="text-lg font-semibold">
                {t("shareRegistration")}
              </h2>
              <p className="text-sm text-muted-foreground">
                {t("shareRegistrationHelp")}
              </p>
            </div>
            <label htmlFor="registration-link" className="sr-only">
              {t("registrationLink")}
            </label>
            <Input
              id="registration-link"
              value={url}
              readOnly
              className="bg-accent/40 text-sm"
            />
            {state !== "open" && (
              <Alert tone="warning">{t("linkNotOpen")}</Alert>
            )}
            <ShareButtons
              url={url}
              text={t("shareText", { season: season.data.name })}
            />
          </section>

          <section className="space-y-3" aria-labelledby="settings-title">
            <h2
              id="settings-title"
              className="font-display text-2xl font-semibold"
            >
              {t("settingsTitle")}
            </h2>
            <RegistrationSettingsForm
              slug={slug}
              canManage={canManage}
              initial={{
                seasonId,
                isOpen: settings.data?.is_open ?? false,
                deadline:
                  settings.data?.deadline ??
                  new Date(now.getTime() + 7 * 86400000).toISOString(),
                feeHalalas: settings.data?.fee_halalas ?? 0,
                requireDocuments: settings.data?.require_documents ?? false,
              }}
            />
          </section>
        </>
      )}
    </main>
  );
}
