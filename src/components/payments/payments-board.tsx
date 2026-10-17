import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";
import { formatSar } from "@/lib/format";
import type { TeamPayments } from "@/lib/payments-data";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { cardVariants } from "@/components/ui/card";
import { ChipLinks } from "@/components/ui/chip";
import { DataTable } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { Icon } from "@/components/ui/icon";
import { Section } from "@/components/ui/section";
import { Progress, StatTile } from "@/components/ui/stat";
import { paymentBadge } from "@/components/payments/payment-summary";
import { cn } from "@/lib/utils";

export const paymentFilters = ["all", "behind", "paying", "paid"] as const;
export type PaymentFilter = (typeof paymentFilters)[number];

/** Total owed for the season: the fee plus any fines. */
const owedOf = (team: TeamPayments) => team.quotaHalalas + team.finesHalalas;
const matches = (team: TeamPayments, filter: PaymentFilter) =>
  filter === "all" ||
  (filter === "behind" && team.status.behind) ||
  (filter === "paid" && team.status.paidInFull) ||
  (filter === "paying" && !team.status.behind && !team.status.paidInFull);

/**
 * The commissioner's payment desk: totals first, teams that owe before their
 * next game next, then every team with how much is paid and left.
 */
export async function PaymentsBoard({
  slug,
  teams,
  filter,
  division,
  link,
}: {
  slug: string;
  /** Every approved team in the season. */
  teams: readonly TeamPayments[];
  filter: PaymentFilter;
  /** The division picked, or null for all. */
  division: string | null;
  /** The page address for a filter and division. */
  link: (changes: {
    filter?: PaymentFilter;
    division?: string | null;
  }) => string;
}) {
  const [t, format] = await Promise.all([
    getTranslations("Payments"),
    getFormatter(),
  ]);
  const sar = (halalas: number) => formatSar(format, halalas);
  const badge = (team: TeamPayments) => {
    const { tone, text } = paymentBadge(
      team.status,
      (key, values) => t(key, values),
      format,
    );
    return <Badge tone={tone}>{text}</Badge>;
  };
  const href = (team: TeamPayments) =>
    `/admin/${slug}/payments/${team.seasonTeamId}`;

  const divisions = [...new Set(teams.map((team) => team.divisionName))].sort(
    (a, b) => a.localeCompare(b),
  );
  const inDivision = teams.filter(
    (team) => !division || team.divisionName === division,
  );
  const shown = inDivision.filter((team) => matches(team, filter));
  const collected = inDivision.reduce((sum, team) => sum + team.paidHalalas, 0);
  const expected = inDivision.reduce((sum, team) => sum + owedOf(team), 0);
  const outstanding = inDivision.filter(
    (team) => team.status.balanceHalalas > 0,
  );
  const behind = inDivision.filter((team) => team.status.behind);
  const behindTotal = behind.reduce(
    (sum, team) => sum + team.status.behindByHalalas,
    0,
  );
  const paidFull = inDivision.filter((team) => team.status.paidInFull);
  const count = (item: PaymentFilter) =>
    inDivision.filter((team) => matches(team, item)).length;

  if (!teams.length)
    return (
      <EmptyState
        icon="payments"
        title={t("noTeams")}
        description={t("noTeamsHelp")}
      />
    );

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatTile
          label={t("statCollected")}
          value={sar(collected)}
          detail={t("collectedOf", { total: sar(expected) })}
          progress={{ value: collected, max: expected }}
          className="col-span-2"
        />
        <StatTile
          label={t("statOutstanding")}
          value={sar(Math.max(0, expected - collected))}
          detail={t("statOutstandingDetail", { count: outstanding.length })}
        />
        <StatTile
          label={t("statPaidFull")}
          value={paidFull.length}
          detail={t("statPaidFullDetail", { count: inDivision.length })}
        />
      </div>

      <Section
        id="behind"
        title={t("behindListTitle")}
        description={behind.length ? t("behindHelp") : undefined}
      >
        {behind.length ? (
          <>
            <p className="text-sm font-semibold text-destructive">
              {t("statBehindDetail", { amount: sar(behindTotal) })}
            </p>
            <ul className="grid gap-3 md:grid-cols-2">
              {[...behind]
                .sort(
                  (a, b) => b.status.behindByHalalas - a.status.behindByHalalas,
                )
                .map((team) => (
                  <li
                    key={team.seasonTeamId}
                    className={cn(
                      cardVariants({ tone: "danger" }),
                      "flex flex-col gap-3",
                    )}
                  >
                    <span className="flex items-start gap-3">
                      <Avatar name={team.teamName} />
                      <span className="min-w-0 flex-1">
                        <span className="block font-semibold break-words">
                          {team.teamName}
                        </span>
                        <span className="block text-sm text-muted-foreground">
                          {team.divisionName}
                        </span>
                      </span>
                      <span className="text-right">
                        <span className="block font-display text-2xl leading-none font-semibold text-destructive tabular-nums">
                          {sar(team.status.behindByHalalas)}
                        </span>
                        <span className="text-xs font-semibold text-muted-foreground">
                          {t("dueNowLabel")}
                        </span>
                      </span>
                    </span>
                    <Link
                      href={href(team)}
                      className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-navy px-4 text-sm font-bold text-on-dark hover:bg-navy-secondary"
                    >
                      <Icon name="payments" className="size-5" />
                      {t("recordPaymentButton")}
                    </Link>
                  </li>
                ))}
            </ul>
          </>
        ) : (
          <p
            className={cn(
              cardVariants({ tone: "muted" }),
              "flex items-center gap-3 font-semibold",
            )}
          >
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-success text-white">
              <Icon name="check" className="size-5" />
            </span>
            {t("statBehindNone")}
          </p>
        )}
      </Section>

      <Section id="teams" title={t("teamsTitle")}>
        <div className="space-y-3">
          {divisions.length > 1 && (
            <ChipLinks
              label={t("chooseDivision")}
              links={[
                {
                  href: link({ division: null }),
                  label: t("allDivisions"),
                  current: !division,
                },
                ...divisions.map((name) => ({
                  href: link({ division: name }),
                  label: name,
                  current: name === division,
                })),
              ]}
            />
          )}
          <nav
            aria-label={t("filterLabel")}
            className="inline-flex max-w-full flex-wrap rounded-2xl bg-accent p-1"
          >
            {paymentFilters.map((item) => (
              <Link
                key={item}
                href={link({ filter: item })}
                aria-current={item === filter ? "page" : undefined}
                className={cn(
                  "inline-flex min-h-11 items-center gap-1.5 rounded-xl px-3 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground sm:px-4",
                  item === filter && "bg-card text-foreground shadow-sm",
                )}
              >
                {t(`filter.${item}`)}
                <span className="text-xs tabular-nums opacity-70">
                  {count(item)}
                </span>
              </Link>
            ))}
          </nav>
        </div>
        {shown.length ? (
          <DataTable
            label={t("teamsTitle")}
            rows={shown}
            rowKey={(team) => team.seasonTeamId}
            rowHref={href}
            rowLabel={(team) => `${t("open")}: ${team.teamName}`}
            openLabel={t("open")}
            columns={[
              {
                key: "team",
                header: t("colTeam"),
                cell: (team) => (
                  <span className="flex items-center gap-3">
                    <Avatar name={team.teamName} className="size-9 text-base" />
                    <span className="min-w-0">
                      <span className="block font-semibold">
                        {team.teamName}
                      </span>
                      <span className="block text-muted-foreground">
                        {team.divisionName}
                      </span>
                    </span>
                  </span>
                ),
              },
              {
                key: "paid",
                header: t("colPaid"),
                className: "w-56",
                cell: (team) => (
                  <span className="block space-y-1.5">
                    <span className="block tabular-nums">
                      {t("paidOf", {
                        paid: sar(team.paidHalalas),
                        total: sar(owedOf(team)),
                      })}
                    </span>
                    <Progress
                      value={team.paidHalalas}
                      max={owedOf(team)}
                      label={t("colPaid")}
                    />
                    {team.finesHalalas > 0 && (
                      <span className="block text-xs text-muted-foreground">
                        {t("finesValue", { amount: sar(team.finesHalalas) })}
                      </span>
                    )}
                  </span>
                ),
              },
              {
                key: "left",
                header: t("colLeft"),
                align: "right",
                cell: (team) => (
                  <span className="font-semibold">
                    {sar(Math.max(0, team.status.balanceHalalas))}
                  </span>
                ),
              },
              { key: "status", header: t("colStatus"), cell: badge },
            ]}
            phone={(team) => ({
              title: team.teamName,
              subtitle: (
                <>
                  {team.divisionName}
                  <span className="mt-2 block space-y-1.5">
                    <span className="block text-foreground tabular-nums">
                      {t("paidOf", {
                        paid: sar(team.paidHalalas),
                        total: sar(owedOf(team)),
                      })}
                    </span>
                    <Progress
                      value={team.paidHalalas}
                      max={owedOf(team)}
                      label={t("colPaid")}
                    />
                    <span className="block pt-0.5">{badge(team)}</span>
                  </span>
                </>
              ),
            })}
          />
        ) : (
          <EmptyState icon="payments" title={t(`filterEmpty.${filter}`)} />
        )}
      </Section>
    </div>
  );
}
