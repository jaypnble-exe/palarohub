/** Money is always integer halalas (1 SAR = 100 halalas). */

export type LedgerKind = "payment" | "fine" | "reversal";
export type PaymentPolicy = "warn" | "block";

export interface LedgerEntry {
  id: string;
  kind: LedgerKind;
  amountHalalas: number;
  /** For a reversal: the entry it cancels. */
  reversesId: string | null;
}

/** Payments and fines that still count: reversed entries and reversals cancel out. */
export function ledgerTotals(entries: readonly LedgerEntry[]) {
  const reversed = new Set(
    entries.flatMap((entry) =>
      entry.kind === "reversal" && entry.reversesId ? [entry.reversesId] : [],
    ),
  );
  let paidHalalas = 0;
  let finesHalalas = 0;
  for (const entry of entries) {
    if (entry.kind === "reversal" || reversed.has(entry.id)) continue;
    if (entry.kind === "payment") paidHalalas += entry.amountHalalas;
    else finesHalalas += entry.amountHalalas;
  }
  return { paidHalalas, finesHalalas, reversedIds: reversed };
}

export interface PaymentInput {
  /** The team's season fee (quota). */
  quotaHalalas: number;
  paidHalalas: number;
  finesHalalas: number;
  /** Games on the team's schedule, not counting cancelled ones. */
  gamesTotal: number;
  /** Games whose share is due now: played games, plus the next one before tip-off. */
  gamesCounted: number;
}

export interface PaymentStatus {
  /** Still owed for the whole season; negative means credit. */
  balanceHalalas: number;
  /** Fines plus the fee share for the games counted so far. */
  dueNowHalalas: number;
  behindByHalalas: number;
  behind: boolean;
  paidInFull: boolean;
  /** The fee share per game, if the team has a schedule. */
  perGameHalalas: number | null;
}

/**
 * A team may pay in full or per game. It is behind when it has paid less than
 * its fines plus its share of the fee for the games counted (rounded up to
 * the halala and never more than the fee). Fines are due straight away.
 */
export function paymentStatus(input: PaymentInput): PaymentStatus {
  const quota = Math.max(0, input.quotaHalalas);
  const total = Math.max(0, input.gamesTotal);
  const counted = Math.min(Math.max(0, input.gamesCounted), total);
  const share =
    total === 0 ? 0 : Math.min(quota, Math.ceil((quota * counted) / total));
  const dueNowHalalas = input.finesHalalas + share;
  const behindByHalalas = Math.max(0, dueNowHalalas - input.paidHalalas);
  const balanceHalalas = quota + input.finesHalalas - input.paidHalalas;
  return {
    balanceHalalas,
    dueNowHalalas,
    behindByHalalas,
    behind: behindByHalalas > 0,
    paidInFull: balanceHalalas <= 0,
    perGameHalalas: total === 0 ? null : Math.ceil(quota / total),
  };
}

export function parsePaymentPolicy(settings: unknown): PaymentPolicy {
  return settings &&
    typeof settings === "object" &&
    (settings as { paymentPolicy?: unknown }).paymentPolicy === "block"
    ? "block"
    : "warn";
}
