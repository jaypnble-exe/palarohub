import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";
import { formatSar } from "@/lib/format";
import type { ManagerRegistration } from "@/lib/team-data";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Icon } from "@/components/ui/icon";

const statusTone = {
  draft: "dark",
  submitted: "warning",
  returned: "warning",
  approved: "success",
  rejected: "danger",
} as const;

/**
 * The top of a team's registration: who, where, and the few numbers a
 * manager checks first (players, fee, rating limit, deadline or payment).
 */
export async function RegistrationHero({
  slug,
  teamName,
  seasonName,
  divisionName,
  status,
  logoUrl,
  players,
  rosterMin,
  rosterMax,
  maxRating,
  feeHalalas,
  deadline,
  registrationOpen,
  payment,
}: {
  slug: string;
  teamName: string;
  seasonName: string;
  divisionName: string;
  status: ManagerRegistration["status"];
  logoUrl?: string | null;
  players: number;
  rosterMin: number;
  rosterMax: number;
  maxRating: string;
  feeHalalas: number;
  deadline: string;
  registrationOpen: boolean;
  /** Once approved: what is left to pay, and the payment badge. */
  payment?: { leftHalalas: number; label: string; behind: boolean } | null;
}) {
  const [t, registration, format] = await Promise.all([
    getTranslations("TeamHome"),
    getTranslations("Registration"),
    getFormatter(),
  ]);
  const sar = (halalas: number) => formatSar(format, halalas);
  const rosterOk = players >= rosterMin && players <= rosterMax;
  const facts = [
    {
      label: t("factPlayers"),
      value: String(players),
      detail: t("factPlayersRange", { min: rosterMin, max: rosterMax }),
      warn: !rosterOk,
    },
    payment
      ? {
          label: t("factLeftToPay"),
          value: sar(payment.leftHalalas),
          detail: payment.label,
          warn: payment.behind,
        }
      : {
          label: t("factFee"),
          value: sar(feeHalalas),
          detail: t("factFeeDetail"),
          warn: false,
        },
    {
      label: t("factMaxRating"),
      value: maxRating,
      detail: t("factMaxRatingDetail"),
      warn: false,
    },
    status === "approved"
      ? null
      : {
          label: t("factDeadline"),
          value: format.dateTime(new Date(deadline), {
            day: "numeric",
            month: "short",
          }),
          detail: registrationOpen
            ? format.dateTime(new Date(deadline), {
                hour: "numeric",
                minute: "2-digit",
              })
            : t("factDeadlinePassed"),
          warn: !registrationOpen,
        },
  ].filter((fact) => fact !== null);
  return (
    <section
      aria-labelledby="registration-team"
      className="overflow-hidden rounded-2xl bg-navy text-on-dark"
    >
      <div className="h-1.5 bg-primary" />
      <div className="space-y-5 p-5 sm:p-7">
        <Link
          href={`/team/${slug}`}
          className="-ml-2 inline-flex min-h-11 items-center gap-2 rounded-xl px-2 text-sm font-semibold text-on-dark-muted hover:bg-white/10 hover:text-on-dark"
        >
          <Icon name="back" className="size-5" />
          {registration("teamHome")}
        </Link>
        <div className="flex items-center gap-4">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- signed Storage URLs of any size.
            <img
              src={logoUrl}
              alt=""
              className="size-16 shrink-0 rounded-2xl bg-white object-contain p-1 sm:size-20"
            />
          ) : (
            <Avatar
              name={teamName}
              className="size-16 rounded-2xl bg-primary text-2xl text-white sm:size-20 sm:text-3xl"
            />
          )}
          <div className="min-w-0 space-y-1">
            <p className="text-sm font-semibold text-on-dark-muted">
              {seasonName} · {divisionName}
            </p>
            <h1
              id="registration-team"
              className="font-display text-3xl leading-tight font-semibold tracking-wide break-words sm:text-4xl"
            >
              {teamName}
            </h1>
            <Badge tone={statusTone[status]}>
              {registration(`status.${status}`)}
            </Badge>
          </div>
        </div>
        <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {facts.map((fact) => (
            <div key={fact.label} className="rounded-xl bg-white/10 p-3">
              <dt className="text-xs font-semibold text-on-dark-muted">
                {fact.label}
              </dt>
              <dd
                className={`font-display text-2xl leading-tight font-semibold tabular-nums ${fact.warn ? "text-primary" : ""}`}
              >
                {fact.value}
              </dd>
              <dd className="text-xs text-on-dark-muted">{fact.detail}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
