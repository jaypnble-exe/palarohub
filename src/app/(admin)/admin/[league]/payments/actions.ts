"use server";

import { revalidatePath } from "next/cache";
import { getLeagueAccess } from "@/lib/league-access";
import {
  ledgerEntrySchema,
  paymentPolicySchema,
  reversalSchema,
} from "@/lib/validation/payments";
import type { ScheduleActionResult } from "@/lib/validation/schedule";

function failure(error: {
  message: string;
  code?: string;
}): ScheduleActionResult {
  for (const [marker, key] of [
    ["already_reversed", "alreadyReversed"],
    ["cannot_reverse_reversal", "alreadyReversed"],
    ["reason_required", "reasonRequired"],
    ["invalid_date", "invalidDate"],
    ["team_not_registered", "teamNotRegistered"],
    ["team_not_found", "teamNotFound"],
    ["entry_not_found", "teamNotFound"],
  ] as const)
    if (error.message.includes(marker)) return { error: key };
  if (error.code === "42501") return { error: "notAllowed" };
  if (error.code === "23514" || error.code === "22P02")
    return { error: "invalidForm" };
  return { error: "saveFailed" };
}

function refresh(slug: string) {
  revalidatePath(`/admin/${slug}`, "layout");
  revalidatePath(`/team/${slug}`, "layout");
}

/** Records a payment or a fine; both go into the same team ledger. */
export async function recordLedgerEntry(
  slug: string,
  input: unknown,
): Promise<ScheduleActionResult> {
  const parsed = ledgerEntrySchema.safeParse(input);
  if (!parsed.success) return { error: "invalidForm" };
  const { supabase, league, canView } = await getLeagueAccess(slug);
  if (!canView) return { error: "notAllowed" };
  const entry = parsed.data;
  const { error } = await supabase.rpc("record_ledger_entry", {
    p_league_id: league.id,
    p_season_team_id: entry.seasonTeamId,
    p_kind: entry.kind,
    p_amount_halalas: entry.amountHalalas,
    // Generated types mark every SQL argument non-null; the function accepts
    // null for the field that does not apply (method for fines, reason for payments).
    p_method: (entry.kind === "payment" ? entry.method : null) as string,
    p_fine_reason: (entry.kind === "fine" ? entry.fineReason : null) as string,
    p_note: entry.note,
    p_paid_on: entry.paidOn,
  });
  if (error) return failure(error);
  refresh(slug);
  return { success: true };
}

/** Cancels a mistaken entry with a matching reversal; nothing is deleted. */
export async function reverseLedgerEntry(
  slug: string,
  input: unknown,
): Promise<ScheduleActionResult> {
  const parsed = reversalSchema.safeParse(input);
  if (!parsed.success) return { error: "reasonRequired" };
  const { supabase, league, canView } = await getLeagueAccess(slug);
  if (!canView) return { error: "notAllowed" };
  const { error } = await supabase.rpc("reverse_ledger_entry", {
    p_league_id: league.id,
    p_entry_id: parsed.data.entryId,
    p_note: parsed.data.note,
  });
  if (error) return failure(error);
  refresh(slug);
  return { success: true };
}

export async function setPaymentPolicy(
  slug: string,
  input: unknown,
): Promise<ScheduleActionResult> {
  const parsed = paymentPolicySchema.safeParse(input);
  if (!parsed.success) return { error: "invalidForm" };
  const { supabase, league, canManage } = await getLeagueAccess(slug);
  if (!canManage) return { error: "notAllowed" };
  const { error } = await supabase.rpc("set_payment_policy", {
    p_league_id: league.id,
    p_policy: parsed.data,
  });
  if (error) return failure(error);
  refresh(slug);
  return { success: true };
}
