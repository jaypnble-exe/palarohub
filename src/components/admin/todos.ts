import type { IconName } from "./dashboard-icon";

export interface DashboardTasks {
  gamesToApprove: number;
  registrations: number;
  changes: number;
  teamsBehind: number;
  unscheduled: number;
  unrated: number;
}

export interface Todo {
  key: keyof DashboardTasks;
  count: number;
  /** Message key for the plain-language sentence. */
  text: string;
  /** Message key for the single action button. */
  action: string;
  href: string;
  icon: IconName;
}

/**
 * The commissioner's to-do list: only what needs doing, most urgent first
 * (results to approve, then teams, money, schedules, ratings).
 */
export function buildTodos(slug: string, tasks: DashboardTasks): Todo[] {
  const base = `/admin/${slug}`;
  const items: Todo[] = [
    {
      key: "gamesToApprove",
      count: tasks.gamesToApprove,
      text: "todoGames",
      action: "actionReview",
      href: `${base}/games`,
      icon: "review",
    },
    {
      key: "registrations",
      count: tasks.registrations,
      text: "todoRegistrations",
      action: "actionReview",
      href: `${base}/registrations`,
      icon: "teams",
    },
    {
      key: "changes",
      count: tasks.changes,
      text: "todoChanges",
      action: "actionReview",
      href: `${base}/registrations`,
      icon: "teams",
    },
    {
      key: "teamsBehind",
      count: tasks.teamsBehind,
      text: "todoPayments",
      action: "actionView",
      href: `${base}/payments`,
      icon: "payments",
    },
    {
      key: "unscheduled",
      count: tasks.unscheduled,
      text: "todoSchedule",
      action: "actionSchedule",
      href: `${base}/schedule`,
      icon: "schedule",
    },
    {
      key: "unrated",
      count: tasks.unrated,
      text: "todoRatings",
      action: "actionRate",
      href: `${base}/players`,
      icon: "ratings",
    },
  ];
  return items.filter((item) => item.count > 0);
}
