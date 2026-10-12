import { describe, expect, it } from "vitest";
import {
  ledgerTotals,
  parsePaymentPolicy,
  paymentStatus,
  type LedgerEntry,
} from "./payments";

const SAR = 100;
const entry = (
  id: string,
  kind: LedgerEntry["kind"],
  amount: number,
  reversesId: string | null = null,
): LedgerEntry => ({ id, kind, amountHalalas: amount * SAR, reversesId });

describe("team ledger", () => {
  it("adds payments and fines, ignoring reversed entries", () => {
    const totals = ledgerTotals([
      entry("p1", "payment", 600),
      entry("p2", "payment", 300),
      entry("f1", "fine", 50),
      entry("r1", "reversal", 300, "p2"),
    ]);
    expect(totals.paidHalalas).toBe(600 * SAR);
    expect(totals.finesHalalas).toBe(50 * SAR);
    expect([...totals.reversedIds]).toEqual(["p2"]);
  });

  it("can cancel a fine too", () => {
    const totals = ledgerTotals([
      entry("f1", "fine", 50),
      entry("r1", "reversal", 50, "f1"),
    ]);
    expect(totals.finesHalalas).toBe(0);
  });
});

describe("payment status", () => {
  const season = { quotaHalalas: 1800 * SAR, gamesTotal: 12 };

  it("never marks a team behind once the fee and fines are paid in full", () => {
    const status = paymentStatus({
      ...season,
      paidHalalas: 1850 * SAR,
      finesHalalas: 50 * SAR,
      gamesCounted: 12,
    });
    expect(status).toMatchObject({
      balanceHalalas: 0,
      behind: false,
      paidInFull: true,
      perGameHalalas: 150 * SAR,
    });
  });

  it("lets a per-game team keep up one game at a time", () => {
    const beforeGameThree = paymentStatus({
      ...season,
      paidHalalas: 300 * SAR,
      finesHalalas: 0,
      gamesCounted: 3,
    });
    expect(beforeGameThree).toMatchObject({
      dueNowHalalas: 450 * SAR,
      behindByHalalas: 150 * SAR,
      behind: true,
      balanceHalalas: 1500 * SAR,
    });
    const paid = paymentStatus({
      ...season,
      paidHalalas: 450 * SAR,
      finesHalalas: 0,
      gamesCounted: 3,
    });
    expect(paid.behind).toBe(false);
  });

  it("makes fines due straight away", () => {
    const status = paymentStatus({
      ...season,
      paidHalalas: 0,
      finesHalalas: 100 * SAR,
      gamesCounted: 0,
    });
    expect(status).toMatchObject({ dueNowHalalas: 100 * SAR, behind: true });
  });

  it("rounds a fee share up to the halala and never above the fee", () => {
    const status = paymentStatus({
      quotaHalalas: 1000 * SAR,
      gamesTotal: 3,
      paidHalalas: 0,
      finesHalalas: 0,
      gamesCounted: 1,
    });
    expect(status.dueNowHalalas).toBe(33334);
    expect(
      paymentStatus({
        quotaHalalas: 1000 * SAR,
        gamesTotal: 3,
        paidHalalas: 0,
        finesHalalas: 0,
        gamesCounted: 9,
      }).dueNowHalalas,
    ).toBe(1000 * SAR);
  });

  it("asks nothing before a schedule exists, and shows overpayment as credit", () => {
    const status = paymentStatus({
      quotaHalalas: 1800 * SAR,
      gamesTotal: 0,
      paidHalalas: 2000 * SAR,
      finesHalalas: 0,
      gamesCounted: 0,
    });
    expect(status).toMatchObject({
      dueNowHalalas: 0,
      behind: false,
      balanceHalalas: -200 * SAR,
      perGameHalalas: null,
    });
  });

  it("reads the league's payment rule, defaulting to warn", () => {
    expect(parsePaymentPolicy({ paymentPolicy: "block" })).toBe("block");
    expect(parsePaymentPolicy({ paymentPolicy: "nonsense" })).toBe("warn");
    expect(parsePaymentPolicy(null)).toBe("warn");
  });
});
