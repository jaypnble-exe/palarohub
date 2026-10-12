import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { DashboardIcon } from "./dashboard-icon";
import { SeasonList } from "./season-list";

interface DashboardProps {
  league: { name: string; slug: string; sport: string };
  displayName: string;
  role: string;
  platformAdmin: boolean;
  members: { id: string; name: string; roles: string[] }[];
  isDemo: boolean;
  canManage: boolean;
  tasks: {
    registrations: number;
    changes: number;
    unrated: number;
    unscheduled: number;
    toApprove: number;
  };
  seasons: {
    id: string;
    name: string;
    status: string;
    start_date: string;
    end_date: string;
    divisions: { name: string; max_rating: string }[];
  }[];
}

export async function Dashboard({
  league,
  displayName,
  role,
  platformAdmin,
  members,
  isDemo,
  canManage,
  tasks,
  seasons,
}: DashboardProps) {
  const t = await getTranslations("AdminHome");
  const sports = await getTranslations("Sports");
  const seasonText = await getTranslations("Seasons");
  const registrationText = await getTranslations("Registration");
  const scheduleText = await getTranslations("Schedule");
  const reviewText = await getTranslations("Review");
  const publicPath = `/${league.slug}`;
  const links = [
    {
      href: `/admin/${league.slug}`,
      label: t("home"),
      icon: "home" as const,
      current: true,
    },
    {
      href: `/admin/${league.slug}/seasons`,
      label: seasonText("title"),
      icon: "seasons" as const,
      current: false,
    },
    {
      href: `/admin/${league.slug}/schedule`,
      label: scheduleText("title"),
      icon: "schedule" as const,
      current: false,
    },
    {
      href: "/leagues",
      label: t("myLeagues"),
      icon: "leagues" as const,
      current: false,
    },
    {
      href: publicPath,
      label: t("publicNav"),
      icon: "public" as const,
      current: false,
    },
    ...(platformAdmin
      ? [
          {
            href: "/admin",
            label: t("createLeague"),
            icon: "add" as const,
            current: false,
          },
        ]
      : []),
  ];

  return (
    <div className="pb-28 sm:pb-10">
      <main className="space-y-7 py-6 sm:space-y-9 sm:py-9">
        {isDemo && (
          <div className="rounded-xl border border-primary/30 bg-orange-soft px-4 py-3 text-sm text-orange-dark">
            <strong>{t("demoTitle")}</strong>
            <p className="mt-1">{t("demoDescription")}</p>
          </div>
        )}
        <section
          className="overflow-hidden rounded-2xl bg-navy text-on-dark"
          aria-labelledby="league-heading"
        >
          <div className="h-1.5 bg-primary" />
          <div className="space-y-4 p-5 sm:p-7">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm font-semibold text-on-dark-muted">
                {t("dashboard")}
              </p>
              <span className="rounded-full bg-navy-secondary px-3 py-1.5 text-sm font-semibold text-on-dark-muted">
                {sports(league.sport)}
              </span>
            </div>
            <h1
              id="league-heading"
              className="break-words font-display text-4xl font-semibold tracking-wide sm:text-5xl"
            >
              {league.name}
            </h1>
            <p className="text-sm text-on-dark-muted">{role}</p>
          </div>
        </section>

        <section aria-labelledby="tasks-heading" className="space-y-4">
          <p className="font-semibold">
            {displayName
              ? t("welcomeName", { name: displayName })
              : t("welcomeRole", { role })}
          </p>
          <h2
            id="tasks-heading"
            className="font-display text-2xl font-semibold"
          >
            {t("todo")}
          </h2>
          <p>
            {registrationText("reviewCount", { count: tasks.registrations })}
          </p>
          <p>{registrationText("changeCount", { count: tasks.changes })}</p>
          <p>{registrationText("ratingCount", { count: tasks.unrated })}</p>
          <p>
            {scheduleText("unscheduledCount", { count: tasks.unscheduled })}
          </p>
          <p>{reviewText("approvalCount", { count: tasks.toApprove })}</p>
          <div className="flex flex-wrap gap-3">
            <Button asChild>
              <Link href={`/admin/${league.slug}/registrations`}>
                {registrationText("reviewInbox")}
              </Link>
            </Button>
            <Button asChild variant={tasks.toApprove ? "default" : "outline"}>
              <Link href={`/admin/${league.slug}/games`}>
                {reviewText("gamesTitle")}
              </Link>
            </Button>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button asChild variant="outline">
              <Link href={`/admin/${league.slug}/teams`}>
                {registrationText("teams")}
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href={`/admin/${league.slug}/players`}>
                {registrationText("players")}
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href={`/admin/${league.slug}/schedule`}>
                {scheduleText("title")}
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href={`/admin/${league.slug}/announcements`}>
                {scheduleText("announcements")}
              </Link>
            </Button>
            {canManage && (
              <Button asChild variant="outline">
                <Link href={`/team/${league.slug}`}>
                  {registrationText("teamWorkspace")}
                </Link>
              </Button>
            )}
          </div>
        </section>

        <section aria-labelledby="seasons-heading" className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2
              id="seasons-heading"
              className="font-display text-2xl font-semibold tracking-wide"
            >
              {seasonText("title")}
            </h2>
            <Button asChild variant="outline">
              <Link href={`/admin/${league.slug}/seasons`}>
                {seasonText("manage")}
              </Link>
            </Button>
          </div>
          <SeasonList slug={league.slug} seasons={seasons} canManage={false} />
        </section>

        <section aria-labelledby="members-heading" className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h2
              id="members-heading"
              className="font-display text-2xl font-semibold tracking-wide"
            >
              {t("members")}
            </h2>
            <span className="rounded-full bg-accent px-3 py-1 text-sm font-semibold">
              {t("memberCount", { count: members.length })}
            </span>
          </div>
          <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
            {members.map((member) => (
              <li key={member.id} className="flex items-center gap-4 px-5 py-4">
                <span
                  aria-hidden="true"
                  className="grid size-11 shrink-0 place-items-center rounded-xl bg-accent font-display text-xl font-semibold"
                >
                  {member.name ? (
                    member.name
                      .split(/\s+/)
                      .map((part) => part[0])
                      .slice(0, 2)
                      .join("")
                  ) : (
                    <DashboardIcon name="leagues" />
                  )}
                </span>
                <div className="min-w-0 space-y-1">
                  <p className="break-words font-semibold">
                    {member.name || t("unnamedMember")}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {member.roles.join(", ")}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section
          className="space-y-5 rounded-2xl border border-border bg-card p-5 sm:p-6"
          aria-labelledby="public-heading"
        >
          <div className="flex items-start gap-4">
            <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-accent">
              <DashboardIcon name="public" />
            </span>
            <div className="space-y-2">
              <h2
                id="public-heading"
                className="font-display text-xl font-semibold"
              >
                {t("publicTitle")}
              </h2>
              <p className="leading-relaxed text-muted-foreground">
                {t("publicDescription")}
              </p>
            </div>
          </div>
          <Button asChild variant="outline" className="w-full sm:w-fit">
            <Link href={publicPath}>
              {t("publicPage")}
              <DashboardIcon name="arrow" className="size-5" />
            </Link>
          </Button>
        </section>
      </main>

      <nav
        aria-label={t("navigation")}
        className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-card pb-[env(safe-area-inset-bottom)] sm:static sm:rounded-2xl sm:border sm:pb-0"
      >
        <div className="mx-auto flex max-w-4xl justify-around">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              aria-current={link.current ? "page" : undefined}
              className="flex min-h-[72px] flex-1 flex-col items-center justify-center gap-1 px-1 py-3 text-center text-xs font-semibold text-muted-foreground transition-colors hover:bg-accent aria-[current=page]:text-orange-dark sm:flex-row sm:gap-3 sm:px-4 sm:text-sm"
            >
              <DashboardIcon name={link.icon} />
              <span>{link.label}</span>
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}
