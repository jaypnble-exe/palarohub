import { getFormatter, getTranslations } from "next-intl/server";
import type { PaymentStatus } from "@/lib/domain/payments";
import type { TeamPayments } from "@/lib/payments-data";
import { formatSar } from "@/lib/format";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { cardVariants } from "@/components/ui/card";
import { Progress } from "@/components/ui/stat";
import { cn } from "@/lib/utils";

/**
 * Plain-language status of one team's payments: what is left, how much of
 * the season is paid, and whether anything is due before the next game.
 */
export async function PaymentSummary({ team }: { team: TeamPayments }) {
  const t = await getTranslations("Payments");
  const format = await getFormatter();
  const sar = (halalas: number) => formatSar(format, halalas);
  const { status } = team;
  const owed = team.quotaHalalas + team.finesHalalas;
  const badge = paymentBadge(status, (key, values) => t(key, values), format);
  const facts = [
    { label: t("fee"), value: team.quotaHalalas },
    { label: t("fines"), value: team.finesHalalas },
    { label: t("paid"), value: team.paidHalalas },
  ];
  return (
    <section
      aria-label={t("teamTitle")}
      className={cn(cardVariants({ padding: "lg" }), "space-y-5")}
    >
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <p className="text-sm font-semibold text-muted-foreground">
            {t("stillToPay")}
          </p>
          <p className="font-display text-4xl leading-none font-semibold tabular-nums">
            {sar(Math.max(0, status.balanceHalalas))}
          </p>
        </div>
        {/* When behind, the callout below says it with the amount. */}
        {!status.behind && <Badge tone={badge.tone}>{badge.text}</Badge>}
      </div>
      <div className="space-y-2">
        <Progress value={team.paidHalalas} max={owed} label={t("paid")} />
        <p className="text-sm text-muted-foreground tabular-nums">
          {t("paidOf", { paid: sar(team.paidHalalas), total: sar(owed) })}
        </p>
      </div>
      {status.behind ? (
        <Alert tone="danger">
          {t("behindCallout", { amount: sar(status.behindByHalalas) })}
        </Alert>
      ) : status.paidInFull ? (
        <Alert tone="success">{t("paidInFullCallout")}</Alert>
      ) : null}
      <dl className="grid grid-cols-3 gap-3 border-t pt-4 text-sm">
        {facts.map((fact) => (
          <div key={fact.label}>
            <dt className="text-muted-foreground">{fact.label}</dt>
            <dd className="font-semibold tabular-nums">{sar(fact.value)}</dd>
          </div>
        ))}
      </dl>
      <p className="text-sm text-muted-foreground">
        {status.perGameHalalas === null
          ? t("noSchedule")
          : t("perGame", {
              amount: sar(status.perGameHalalas),
              played: team.gamesPlayed,
              total: team.gamesTotal,
              due: sar(status.dueNowHalalas),
            })}
      </p>
    </section>
  );
}

type Translate = (key: string, values?: Record<string, string>) => string;
type Formatter = Parameters<typeof formatSar>[0];

/** The colour and words for a payment status, for any badge. */
export function paymentBadge(
  status: PaymentStatus,
  t: Translate,
  format: Formatter,
): { tone: "danger" | "success" | "neutral"; text: string } {
  if (status.behind)
    return {
      tone: "danger",
      text: t("behindBy", {
        amount: formatSar(format, status.behindByHalalas),
      }),
    };
  if (status.paidInFull)
    return {
      tone: "success",
      text:
        status.balanceHalalas < 0
          ? t("credit", { amount: formatSar(format, -status.balanceHalalas) })
          : t("paidInFull"),
    };
  return { tone: "neutral", text: t("upToDate") };
}

/** "Behind by SAR 150", "Up to date", or "Paid in full", in the matching colour. */
export async function PaymentBadge({ status }: { status: PaymentStatus }) {
  const t = await getTranslations("Payments");
  const format = await getFormatter();
  const { tone, text } = paymentBadge(
    status,
    (key, values) => t(key, values),
    format,
  );
  return <Badge tone={tone}>{text}</Badge>;
}
