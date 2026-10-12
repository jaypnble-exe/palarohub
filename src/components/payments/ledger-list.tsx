"use client";
import { useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { reverseLedgerEntry } from "@/app/(admin)/admin/[league]/payments/actions";
import type { LedgerRow } from "@/lib/payments-data";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ScheduleFeedback,
  useScheduleMutation,
} from "@/components/schedule/mutation";

/** The team's ledger, newest first. Staff can cancel a mistaken entry. */
export function LedgerList({
  slug,
  entries,
  canEdit,
}: {
  slug: string;
  entries: readonly LedgerRow[];
  canEdit: boolean;
}) {
  const t = useTranslations("Payments");
  const format = useFormatter();
  const sar = (halalas: number) =>
    format.number(halalas / 100, { style: "currency", currency: "SAR" });
  if (!entries.length)
    return <p className="rounded-2xl border bg-card p-5">{t("noEntries")}</p>;
  return (
    <ul className="divide-y rounded-2xl border bg-card">
      {entries.map((entry) => (
        <li key={entry.id} className="space-y-2 p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p
              className={
                entry.reversed
                  ? "font-semibold text-muted-foreground line-through"
                  : "font-semibold"
              }
            >
              {entry.kind === "payment"
                ? t("paymentLine", {
                    amount: sar(entry.amountHalalas),
                    method: t(`methods.${entry.method ?? "other"}`),
                  })
                : entry.kind === "fine"
                  ? t("fineLine", {
                      amount: sar(entry.amountHalalas),
                      reason: t(`reasons.${entry.fineReason ?? "other"}`),
                    })
                  : t("reversalLine", { amount: sar(entry.amountHalalas) })}
            </p>
            <p className="text-sm text-muted-foreground">
              {format.dateTime(new Date(`${entry.paidOn}T12:00:00Z`), {
                dateStyle: "medium",
                timeZone: "UTC",
              })}
            </p>
          </div>
          {entry.note && <p className="text-sm">{entry.note}</p>}
          {entry.reversed && (
            <p className="text-sm text-muted-foreground">{t("reversedNote")}</p>
          )}
          {canEdit && entry.kind !== "reversal" && !entry.reversed && (
            <ReverseEntry slug={slug} entryId={entry.id} />
          )}
        </li>
      ))}
    </ul>
  );
}

function ReverseEntry({ slug, entryId }: { slug: string; entryId: string }) {
  const t = useTranslations("Payments");
  const mutation = useScheduleMutation();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  if (!open)
    return (
      <Button
        type="button"
        variant="ghost"
        className="min-h-11 px-3 py-1 text-sm"
        onClick={() => setOpen(true)}
      >
        {t("reverse")}
      </Button>
    );
  return (
    <form
      className="flex flex-wrap items-end gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        if (!note.trim())
          return mutation.setResult({ error: "reasonRequired" });
        if (window.confirm(t("confirmReverse")))
          mutation.run(() => reverseLedgerEntry(slug, { entryId, note }));
      }}
    >
      <div className="min-w-0 flex-1 space-y-1">
        <label htmlFor={`reverse-${entryId}`} className="text-sm font-semibold">
          {t("reverseReason")}
        </label>
        <Input
          id={`reverse-${entryId}`}
          maxLength={500}
          value={note}
          onChange={(event) => setNote(event.target.value)}
        />
      </div>
      <Button variant="outline" disabled={mutation.pending}>
        {t("reverseConfirm")}
      </Button>
      <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
        {t("cancel")}
      </Button>
      <ScheduleFeedback result={mutation.result} message={(key) => t(key)} />
    </form>
  );
}
