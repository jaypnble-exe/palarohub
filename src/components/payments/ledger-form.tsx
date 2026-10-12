"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { recordLedgerEntry } from "@/app/(admin)/admin/[league]/payments/actions";
import { sarToHalalas } from "@/lib/validation/registration";
import { fineReasons, paymentMethods } from "@/lib/validation/payments";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ScheduleFeedback,
  useScheduleMutation,
} from "@/components/schedule/mutation";

const chip =
  "min-h-11 rounded-xl border-2 bg-background px-4 font-semibold aria-pressed:border-navy aria-pressed:bg-navy aria-pressed:text-on-dark";

/** One form for both payments and fines, phone first. */
export function LedgerForm({
  slug,
  seasonTeamId,
  today,
  suggestedHalalas,
}: {
  slug: string;
  seasonTeamId: string;
  /** Today in Riyadh, YYYY-MM-DD. */
  today: string;
  /** Prefilled payment amount, e.g. what is due now. */
  suggestedHalalas: number;
}) {
  const t = useTranslations("Payments");
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
  return (
    <form
      className="space-y-5 rounded-2xl border bg-card p-5"
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
      <div role="group" aria-label={t("entryType")} className="flex gap-2">
        {(["payment", "fine"] as const).map((option) => (
          <button
            key={option}
            type="button"
            aria-pressed={kind === option}
            className={`${chip} flex-1`}
            onClick={() => setKind(option)}
          >
            {t(option === "payment" ? "recordPayment" : "addFine")}
          </button>
        ))}
      </div>
      <fieldset disabled={mutation.pending} className="space-y-5">
        <div className="space-y-2">
          <label htmlFor="ledger-amount" className="font-semibold">
            {t("amount")}
          </label>
          <Input
            id="ledger-amount"
            inputMode="decimal"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
          />
        </div>
        {kind === "payment" ? (
          <div className="space-y-2">
            <p id="ledger-method" className="font-semibold">
              {t("method")}
            </p>
            <div
              role="group"
              aria-labelledby="ledger-method"
              className="flex flex-wrap gap-2"
            >
              {paymentMethods.map((option) => (
                <button
                  key={option}
                  type="button"
                  aria-pressed={method === option}
                  className={chip}
                  onClick={() => setMethod(option)}
                >
                  {t(`methods.${option}`)}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <p id="ledger-reason" className="font-semibold">
              {t("fineReason")}
            </p>
            <div
              role="group"
              aria-labelledby="ledger-reason"
              className="flex flex-wrap gap-2"
            >
              {fineReasons.map((option) => (
                <button
                  key={option}
                  type="button"
                  aria-pressed={reason === option}
                  className={chip}
                  onClick={() => setReason(option)}
                >
                  {t(`reasons.${option}`)}
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="space-y-2">
          <label htmlFor="ledger-date" className="font-semibold">
            {t(kind === "payment" ? "paidOn" : "finedOn")}
          </label>
          <Input
            id="ledger-date"
            type="date"
            max={today}
            value={paidOn}
            onChange={(event) => setPaidOn(event.target.value)}
          />
        </div>
        <div className="space-y-2">
          <label htmlFor="ledger-note" className="font-semibold">
            {t("note")}
          </label>
          <Input
            id="ledger-note"
            maxLength={500}
            value={note}
            onChange={(event) => setNote(event.target.value)}
          />
        </div>
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
