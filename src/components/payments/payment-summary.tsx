import { getFormatter, getTranslations } from "next-intl/server";
import type { TeamPayments } from "@/lib/payments-data";

/** Plain-language status of one team's payments. */
export async function PaymentSummary({ team }: { team: TeamPayments }) {
  const t = await getTranslations("Payments");
  const format = await getFormatter();
  const sar = (halalas: number) =>
    format.number(halalas / 100, { style: "currency", currency: "SAR" });
  const { status } = team;
  const tone = status.behind
    ? "bg-destructive/10 text-destructive"
    : status.paidInFull
      ? "bg-green-700 text-white"
      : "bg-accent";
  return (
    <div className="space-y-3">
      <p
        className={`inline-block rounded-full px-3 py-1 text-sm font-semibold ${tone}`}
      >
        {status.behind
          ? t("behindBy", { amount: sar(status.behindByHalalas) })
          : status.paidInFull
            ? status.balanceHalalas < 0
              ? t("credit", { amount: sar(-status.balanceHalalas) })
              : t("paidInFull")
            : t("upToDate")}
      </p>
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
