import Link from "next/link";
import { notFound } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";
import { isPlatformAdmin, requireUser } from "@/lib/auth";
import { platformLeague } from "@/lib/platform-data";
import { AccessDenied } from "@/components/access-denied";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { PageHeader } from "@/components/ui/page-header";
import { Section } from "@/components/ui/section";
import {
  MemberEmailForm,
  PauseLeagueForm,
  RemoveAccessButton,
} from "@/components/platform/platform-forms";

type Role = "commissioner" | "league_staff" | "team_manager";
const roleNames = ["commissioner", "league_staff", "team_manager"] as const;
const logActions = [
  "member_added",
  "member_removed",
  "commissioner_replaced",
  "league_paused",
  "league_resumed",
] as const;

/** One league as the platform admin sees it: its people, pause, and changes. */
export default async function PlatformLeaguePage({
  params,
}: {
  params: Promise<{ league: string }>;
}) {
  const { league: slug } = await params;
  const { supabase, user } = await requireUser(`/admin/leagues/${slug}`);
  if (!(await isPlatformAdmin())) return <AccessDenied />;
  const data = await platformLeague(supabase, slug);
  if (!data) notFound();
  const { league, members, log } = data;
  const [t, roles, sports, format] = await Promise.all([
    getTranslations("Platform"),
    getTranslations("Roles"),
    getTranslations("Sports"),
    getFormatter(),
  ]);
  const date = (value: string) =>
    format.dateTime(new Date(value), { dateStyle: "medium" });
  const dateTime = (value: string) =>
    format.dateTime(new Date(value), {
      dateStyle: "medium",
      timeStyle: "short",
    });
  const people = (role: Role) => members.filter((m) => m.role === role);
  const commissioners = people("commissioner");

  const list = (role: Role, empty: string) => {
    const rows = people(role);
    if (!rows.length)
      return <p className="text-sm text-muted-foreground">{empty}</p>;
    return (
      <ul className="divide-y rounded-2xl border bg-card">
        {rows.map((member) => {
          const name = member.display_name || member.email;
          return (
            <li
              key={`${member.user_id}-${role}`}
              className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
            >
              <span className="min-w-0 space-y-1">
                <span className="block font-semibold break-words">
                  {name}
                  {member.user_id === user.id && (
                    <Badge className="ml-2">{t("you")}</Badge>
                  )}
                </span>
                {member.display_name && (
                  <span className="block text-sm break-all text-muted-foreground">
                    {member.email}
                  </span>
                )}
                <span className="block text-sm text-muted-foreground">
                  {member.last_sign_in_at
                    ? t("lastSignIn", { date: date(member.last_sign_in_at) })
                    : t("neverSignedIn")}
                </span>
              </span>
              {/* A league always keeps a commissioner: change it instead. */}
              {!(role === "commissioner" && rows.length === 1) && (
                <RemoveAccessButton
                  leagueId={league.id}
                  leagueName={league.name}
                  userId={member.user_id}
                  name={name}
                  role={role}
                  roleLabel={roles(role)}
                />
              )}
            </li>
          );
        })}
      </ul>
    );
  };

  return (
    <main className="mx-auto max-w-2xl space-y-8 py-8">
      <PageHeader
        back={{ href: "/admin", label: t("back") }}
        eyebrow={`${sports(league.sport)} · ${t("leagueCreated", { date: date(league.created_at) })}`}
        title={league.name}
        actions={
          <>
            <Button asChild variant="dark">
              <Link href={`/admin/${league.slug}`}>
                <Icon name="workspace" className="size-5" />
                {t("openDashboard")}
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href={`/${league.slug}`}>
                <Icon name="public" className="size-5" />
                {t("openPublic")}
              </Link>
            </Button>
          </>
        }
      />
      {league.paused_at && (
        <Alert tone="danger">
          <strong>{t("pausedSince", { date: date(league.paused_at) })}</strong>
          <br />
          {t("pausedReason", { reason: league.paused_reason })}
        </Alert>
      )}
      <ul className="flex flex-wrap gap-2">
        <li>
          <Badge>{league.current_season ?? t("noSeason")}</Badge>
        </li>
        <li>
          <Badge>{t("teamsCount", { count: league.teams })}</Badge>
        </li>
        <li>
          <Badge>{t("gamesCount", { count: league.games_played })}</Badge>
        </li>
        {league.games_live > 0 && (
          <li>
            <Badge tone="primary">
              {t("liveCount", { count: league.games_live })}
            </Badge>
          </li>
        )}
      </ul>

      <Section
        id="commissioner"
        title={t("commissionerTitle")}
        description={t("commissionerHelp")}
      >
        {list("commissioner", t("noCommissioner"))}
        <Card className="space-y-4">
          <MemberEmailForm
            leagueId={league.id}
            leagueName={league.name}
            mode={commissioners.length ? "replace" : "commissioner"}
          />
          {commissioners.length > 0 && (
            <details>
              <summary className="min-h-11 cursor-pointer py-2 font-semibold">
                {t("addCommissioner")}
              </summary>
              <div className="pt-3">
                <MemberEmailForm
                  leagueId={league.id}
                  leagueName={league.name}
                  mode="commissioner"
                />
              </div>
            </details>
          )}
        </Card>
      </Section>

      <Section id="staff" title={t("staffTitle")} description={t("staffHelp")}>
        {list("league_staff", t("staffEmpty"))}
        <Card>
          <MemberEmailForm
            leagueId={league.id}
            leagueName={league.name}
            mode="staff"
          />
        </Card>
      </Section>

      <Section
        id="managers"
        title={t("managersTitle")}
        description={t("managersHelp")}
      >
        {list("team_manager", t("managersEmpty"))}
      </Section>

      <Section
        id="pause"
        title={league.paused_at ? t("paused") : t("pauseTitle")}
        description={t("pauseHelp")}
      >
        <Card>
          <PauseLeagueForm
            leagueId={league.id}
            leagueName={league.name}
            paused={Boolean(league.paused_at)}
          />
        </Card>
      </Section>

      <Section id="log" title={t("logTitle")}>
        {log.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("logEmpty")}</p>
        ) : (
          <ul className="divide-y rounded-2xl border bg-card">
            {log.map((entry) => {
              const action = logActions.find((a) => a === entry.action);
              if (!action) return null;
              const detail =
                entry.detail && typeof entry.detail === "object"
                  ? (entry.detail as Record<string, unknown>)
                  : {};
              const role = roleNames.find((r) => r === detail.role);
              return (
                <li key={entry.id} className="space-y-1 px-4 py-3">
                  <span className="block font-semibold break-words">
                    {t(`log.${action}`, {
                      target: entry.target_email ?? t("someone"),
                      role: role ? roles(role) : "",
                      reason:
                        typeof detail.reason === "string" ? detail.reason : "",
                    })}
                  </span>
                  <span className="block text-sm text-muted-foreground">
                    {t("logBy", {
                      date: dateTime(entry.created_at),
                      actor: entry.actor_email ?? t("someone"),
                    })}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </Section>
    </main>
  );
}
