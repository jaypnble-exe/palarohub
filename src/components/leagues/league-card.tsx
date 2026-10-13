import Link from "next/link";
import { useTranslations } from "next-intl";
import { workspacesFor, type MyLeague } from "@/lib/league-list";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cardVariants } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";

/** One league: who you are there, and a button for each area you can open. */
export function LeagueCard({ league }: { league: MyLeague }) {
  const t = useTranslations("MyLeagues");
  const roles = useTranslations("Roles");
  const sports = useTranslations("Sports");
  const workspaces = workspacesFor(league);
  return (
    <li className={cn(cardVariants(), "space-y-4")}>
      <div className="flex items-start gap-3">
        <Avatar
          name={league.name}
          className="size-12 bg-navy text-xl text-on-dark"
        />
        <div className="min-w-0 flex-1 space-y-2">
          <div>
            <h2 className="break-words font-display text-2xl leading-tight font-semibold">
              {league.name}
            </h2>
            <p className="text-sm text-muted-foreground">
              {sports.has(league.sport) ? sports(league.sport) : league.sport}
            </p>
          </div>
          <ul className="flex flex-wrap gap-2" aria-label={t("yourRoles")}>
            {league.roles.map((role) => (
              <li key={role}>
                <Badge tone={role === "team_manager" ? "warning" : "dark"}>
                  {roles(role)}
                </Badge>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="grid gap-2">
        {workspaces.map((workspace, index) => (
          <Button
            key={workspace.kind}
            asChild
            variant={index === 0 ? "default" : "outline"}
            className="justify-between"
          >
            <Link href={workspace.href}>
              <span className="flex items-center gap-2">
                <Icon
                  name={workspace.kind === "admin" ? "workspace" : "teams"}
                  className="size-5"
                />
                {t(workspace.kind === "admin" ? "openDashboard" : "openTeam")}
              </span>
              <Icon name="arrow" className="size-5" />
            </Link>
          </Button>
        ))}
      </div>
      <Link
        href={`/${league.slug}`}
        className="inline-flex min-h-11 items-center gap-2 rounded-xl text-sm font-semibold text-muted-foreground hover:text-foreground hover:underline"
      >
        <Icon name="public" className="size-5" />
        {t("publicPage")}
      </Link>
    </li>
  );
}
