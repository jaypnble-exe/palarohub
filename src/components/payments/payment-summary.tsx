import { getFormatter, getTranslations } from "next-intl/server";
import type { PaymentStatus } from "@/lib/domain/payments";
import type { TeamPayments } from "@/lib/payments-data";
import { formatSar } from "@/lib/format";
import { Badge } from "@/components/ui/badge";

/** Plain-language status of one team's payments. */
export async function PaymentSummary({ team }: { team: TeamPayments }) {
  const t = await getTranslations("Payments");
  const format = await getFormatter();
  const sar = (halalas: number) => formatSar(format, halalas);
  const { status } = team;
  return (
    <div className="space-y-3">
      <PaymentBadge status={status} />
      <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-4">
        <div>
          <dt className="text-muted-foreground">{t("fee")}</dt>
          <dd className="font-semibold">{sar(team.quotaHalalas)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">{t("fines")}</dt>
          <dd className="font-semibold">{sar(team.finesHalalas)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">{t("paid")}</dt>
          <dd className="font-semibold">{sar(team.paidHalalas)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">{t("balance")}</dt>
          <dd className="font-semibold">
            {sar(Math.max(0, status.balanceHalalas))}
          </dd>
        </div>
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
    </div>
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
