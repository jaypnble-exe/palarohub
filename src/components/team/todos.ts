import type { IconName } from "@/components/ui/icon";
import type { ManagerRegistration, OpenSeason } from "@/lib/team-data";

export interface ManagerTodo {
  key: string;
  icon: IconName;
  /** Message key and values for the sentence. */
  text: string;
  values: Record<string, string>;
  /** The league's own words, e.g. why a registration was sent back. */
  quote?: string;
  action: string;
  href: string;
}

/**
 * What a team manager should do next, most urgent first: fix what the league
 * sent back, finish drafts, pay what is due, then register for open seasons.
 */
export function managerTodos(
  slug: string,
  registrations: readonly ManagerRegistration[],
  behind: readonly { teamName: string; amount: string }[],
  openSeasons: readonly OpenSeason[],
  formatDeadline: (iso: string) => string,
): ManagerTodo[] {
  const base = `/team/${slug}`;
  return [
    ...registrations
      .filter((registration) => registration.status === "returned")
      .map((registration) => ({
        key: `fix-${registration.id}`,
        icon: "alert" as const,
        text: "todoFix",
        values: { team: registration.teamName },
        quote: registration.reviewComment || undefined,
        action: "actionFix",
        href: `${base}/registrations/${registration.id}`,
      })),
    ...registrations
      .filter((registration) => registration.status === "draft")
      .map((registration) => ({
        key: `draft-${registration.id}`,
        icon: "review" as const,
        text: "todoDraft",
        values: { team: registration.teamName },
        action: "actionContinue",
        href: `${base}/registrations/${registration.id}`,
      })),
    ...behind.map((team) => ({
      key: `pay-${team.teamName}`,
      icon: "payments" as const,
      text: "todoPay",
      values: { team: team.teamName, amount: team.amount },
      action: "actionView",
      href: `${base}/payments`,
    })),
    ...openSeasons
      .filter((season) => !season.registered)
      .map((season) => ({
        key: `register-${season.seasonId}`,
        icon: "add" as const,
        text: "todoRegister",
        values: {
          season: season.seasonName,
          deadline: formatDeadline(season.deadline),
        },
        action: "actionRegister",
        href: `${base}/register/${season.seasonId}`,
      })),
  ];
}
