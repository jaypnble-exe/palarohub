"use client";
import { useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { reverseLedgerEntry } from "@/app/(admin)/admin/[league]/payments/actions";
import type { LedgerRow } from "@/lib/payments-data";
import { formatSar } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { cardVariants } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Icon } from "@/components/ui/icon";
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
  const sar = (halalas: number) => formatSar(format, halalas);
  if (!entries.length)
    return <EmptyState icon="payments" title={t("noEntries")} />;
  return (
    <ul className={`${cardVariants({ padding: "none" })} divide-y`}>
      {entries.map((entry) => {
        const tone =
          entry.kind === "payment"
            ? "bg-success-soft text-success"
            : entry.kind === "fine"
              ? "bg-destructive-soft text-destructive"
              : "bg-accent text-muted-foreground";
        return (
          <li key={entry.id} className="space-y-2 p-4">
            <div className="flex items-start gap-3">
              <span
                aria-hidden="true"
                className={`grid size-10 shrink-0 place-items-center rounded-xl ${tone}`}
              >
                <Icon
                  name={
                    entry.kind === "payment"
                      ? "payments"
                      : entry.kind === "fine"
                        ? "alert"
                        : "back"
                  }
                  className="size-5"
                />
              </span>
              <div className="min-w-0 flex-1">
                <p
                  className={
                    entry.reversed
                      ? "font-semibold text-muted-foreground line-through"
                      : "font-semibold"
                  }
                >
                  {entry.kind === "payment"
                    ? t("entryPayment", {
                        method: t(`methods.${entry.method ?? "other"}`),
                      })
                    : entry.kind === "fine"
                      ? t("entryFine", {
                          reason: t(`reasons.${entry.fineReason ?? "other"}`),
                        })
                      : t("entryReversal")}
                </p>
                <p className="text-sm text-muted-foreground">
                  {format.dateTime(new Date(`${entry.paidOn}T12:00:00Z`), {
                    dateStyle: "medium",
                    timeZone: "UTC",
                  })}
                </p>
              </div>
              <p
                className={`shrink-0 text-right font-display text-xl font-semibold tabular-nums ${
                  entry.reversed
                    ? "text-muted-foreground line-through"
                    : entry.kind === "payment"
                      ? "text-success"
                      : entry.kind === "fine"
                        ? "text-destructive"
                        : "text-muted-foreground"
                }`}
              >
                {entry.kind === "reversal"
                  ? t("reversalLine", { amount: sar(entry.amountHalalas) })
                  : sar(entry.amountHalalas)}
              </p>
            </div>
            <div className="space-y-2 pl-13">
              {entry.note && <p className="text-sm">{entry.note}</p>}
              {entry.reversed && (
                <p className="text-sm text-muted-foreground">
                  {t("reversedNote")}
                </p>
              )}
              {canEdit && entry.kind !== "reversal" && !entry.reversed && (
                <ReverseEntry slug={slug} entryId={entry.id} />
              )}
            </div>
          </li>
        );
      })}
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
