export type RegistrationStatus =
  "draft" | "submitted" | "returned" | "approved" | "rejected";
export type StatusFilter =
  "all" | "waiting" | "approved" | "notSent" | "rejected";
export const statusFilters: readonly StatusFilter[] = [
  "all",
  "waiting",
  "approved",
  "notSent",
  "rejected",
];

/** Which filter chip a registration belongs to. */
export function statusGroup(
  status: RegistrationStatus,
): Exclude<StatusFilter, "all"> {
  if (status === "submitted") return "waiting";
  if (status === "approved") return "approved";
  if (status === "rejected") return "rejected";
  return "notSent";
}

export function parseStatusFilter(value: string | undefined): StatusFilter {
  return statusFilters.find((filter) => filter === value) ?? "all";
}

/** The colour of a status badge: what needs action stands out. */
export const statusTone = {
  submitted: "primary",
  approved: "success",
  returned: "warning",
  draft: "neutral",
  rejected: "danger",
} as const satisfies Record<RegistrationStatus, string>;

const groupOrder: Exclude<StatusFilter, "all">[] = [
  "waiting",
  "notSent",
  "approved",
  "rejected",
];

/** Waiting for review first, then by division and team name. */
export function sortTeamRows<
  T extends {
    status: RegistrationStatus;
    divisionName: string;
    teamName: string;
  },
>(rows: readonly T[]): T[] {
  return [...rows].sort(
    (a, b) =>
      groupOrder.indexOf(statusGroup(a.status)) -
        groupOrder.indexOf(statusGroup(b.status)) ||
      a.divisionName.localeCompare(b.divisionName) ||
      a.teamName.localeCompare(b.teamName),
  );
}

/** How many registrations each filter chip would show. */
export function filterCounts(rows: readonly { status: RegistrationStatus }[]) {
  const counts: Record<StatusFilter, number> = {
    all: rows.length,
    waiting: 0,
    approved: 0,
    notSent: 0,
    rejected: 0,
  };
  for (const row of rows) counts[statusGroup(row.status)] += 1;
  return counts;
}
