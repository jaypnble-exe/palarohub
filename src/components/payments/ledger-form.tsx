"use client";
import { useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { formatSar } from "@/lib/format";
import { recordLedgerEntry } from "@/app/(admin)/admin/[league]/payments/actions";
import { sarToHalalas } from "@/lib/validation/registration";
import { fineReasons, paymentMethods } from "@/lib/validation/payments";
import { Button } from "@/components/ui/button";
import { cardVariants } from "@/components/ui/card";
import { ChipGroup } from "@/components/ui/chip";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  ScheduleFeedback,
  useScheduleMutation,
} from "@/components/schedule/mutation";

/** One form for both payments and fines, phone first. */
export function LedgerForm({
  slug,
  seasonTeamId,
  today,
  suggestedHalalas,
  perGameHalalas = null,
  balanceHalalas = 0,
}: {
  slug: string;
  seasonTeamId: string;
  /** Today in Riyadh, YYYY-MM-DD. */
  today: string;
  /** Prefilled payment amount, e.g. what is due now. */
  suggestedHalalas: number;
  /** One game's share of the fee, when the team has a schedule. */
  perGameHalalas?: number | null;
  /** Everything still owed for the season. */
  balanceHalalas?: number;
}) {
  const t = useTranslations("Payments");
  const format = useFormatter();
  const mutation = useScheduleMutation();
  const [kind, setKind] = useState<"payment" | "fine">("payment");
  const [amount, setAmount] = useState(
    suggestedHalalas > 0 ? (suggestedHalalas / 100).toFixed(2) : "",
  );
  const [method, setMethod] = useState<(typeof paymentMethods)[number]>("cash");
  const [reason, setReason] =
    useState<(typeof fineReasons)[number]>("technical");
  const [paidOn, setPaidOn] = useState(today);
  const [note, setNote] = useState("");
  const asSar = (halalas: number) => (halalas / 100).toFixed(2);
  // One tap fills the usual amounts; duplicates and zero amounts are left out.
  const quick = [
    { key: "quickDue", halalas: suggestedHalalas },
    { key: "quickPerGame", halalas: perGameHalalas ?? 0 },
    { key: "quickBalance", halalas: balanceHalalas },
  ].filter(
    (option, index, all) =>
      option.halalas > 0 &&
      all.findIndex((other) => other.halalas === option.halalas) === index,
  );
  return (
    <form
      className={`${cardVariants()} space-y-5`}
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        const amountHalalas = sarToHalalas(amount);
        if (!amountHalalas)
          return mutation.setResult({ error: "invalidAmount" });
        mutation.run(
          () =>
            recordLedgerEntry(slug, {
              seasonTeamId,
              kind,
              amountHalalas,
              method: kind === "payment" ? method : null,
              fineReason: kind === "fine" ? reason : null,
              note,
              paidOn,
            }),
          () => {
            setAmount("");
            setNote("");
          },
        );
      }}
    >
      <h2 className="font-display text-xl font-semibold">{t("recordTitle")}</h2>
      <ChipGroup
        label={t("entryType")}
        stretch
        value={kind}
        onChange={setKind}
        options={[
          { value: "payment", label: t("recordPayment") },
          { value: "fine", label: t("addFine") },
        ]}
      />
      <fieldset disabled={mutation.pending} className="space-y-5">
        <Field id="ledger-amount" label={t("amount")}>
          <Input
            id="ledger-amount"
            inputMode="decimal"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
          />
        </Field>
        {kind === "payment" && quick.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-semibold text-muted-foreground">
              {t("quickAmounts")}
            </p>
            <div className="flex flex-wrap gap-2">
              {quick.map((option) => (
                <button
                  key={option.key}
                  type="button"
                  aria-pressed={amount === asSar(option.halalas)}
                  onClick={() => setAmount(asSar(option.halalas))}
                  className="inline-flex min-h-11 flex-col items-start justify-center rounded-xl border-2 border-border bg-card px-3 py-1.5 text-left transition-colors hover:bg-accent aria-pressed:border-navy aria-pressed:bg-accent"
                >
                  <span className="text-xs font-semibold text-muted-foreground">
                    {t(option.key)}
                  </span>
                  <span className="text-sm font-bold tabular-nums">
                    {formatSar(format, option.halalas)}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
        {kind === "payment" ? (
          <div className="space-y-2">
            <p className="font-semibold">{t("method")}</p>
            <ChipGroup
              label={t("method")}
              value={method}
              onChange={setMethod}
              options={paymentMethods.map((option) => ({
                value: option,
                label: t(`methods.${option}`),
              }))}
            />
          </div>
        ) : (
          <div className="space-y-2">
            <p className="font-semibold">{t("fineReason")}</p>
            <ChipGroup
              label={t("fineReason")}
              value={reason}
              onChange={setReason}
              options={fineReasons.map((option) => ({
                value: option,
                label: t(`reasons.${option}`),
              }))}
            />
          </div>
        )}
        <Field
          id="ledger-date"
          label={t(kind === "payment" ? "paidOn" : "finedOn")}
        >
          <Input
            id="ledger-date"
            type="date"
            max={today}
            value={paidOn}
            onChange={(event) => setPaidOn(event.target.value)}
          />
        </Field>
        <Field id="ledger-note" label={t("note")}>
          <Input
            id="ledger-note"
            maxLength={500}
            value={note}
            onChange={(event) => setNote(event.target.value)}
          />
        </Field>
        <Button className="w-full sm:w-fit">
          {t(
            mutation.pending
              ? "saving"
              : kind === "payment"
                ? "savePayment"
                : "saveFine",
          )}
        </Button>
      </fieldset>
      <ScheduleFeedback result={mutation.result} message={(key) => t(key)} />
    </form>
  );
}
