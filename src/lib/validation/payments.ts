import { z } from "zod";

export const paymentMethods = [
  "cash",
  "bank_transfer",
  "stc_pay",
  "other",
] as const;
export const fineReasons = ["technical", "no_show", "other"] as const;

export const ledgerEntrySchema = z
  .strictObject({
    seasonTeamId: z.uuid(),
    kind: z.enum(["payment", "fine"]),
    amountHalalas: z.number().int().min(1).max(100_000_000),
    method: z.enum(paymentMethods).nullable(),
    fineReason: z.enum(fineReasons).nullable(),
    note: z.string().trim().max(500),
    paidOn: z.iso.date(),
  })
  .refine((entry) => entry.kind !== "payment" || entry.method, {
    path: ["method"],
    message: "methodRequired",
  })
  .refine((entry) => entry.kind !== "fine" || entry.fineReason, {
    path: ["fineReason"],
    message: "reasonRequired",
  });
export type LedgerEntryInput = z.output<typeof ledgerEntrySchema>;

export const reversalSchema = z.strictObject({
  entryId: z.uuid(),
  note: z.string().trim().min(1).max(500),
});

export const paymentPolicySchema = z.enum(["warn", "block"]);
