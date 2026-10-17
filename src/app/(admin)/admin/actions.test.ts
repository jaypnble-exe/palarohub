import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  addLeagueMember,
  removeLeagueMember,
  replaceCommissioner,
  setLeaguePaused,
} from "./actions";
import { isPlatformAdmin, requireUser } from "@/lib/auth";
vi.mock("@/lib/auth", () => ({
  requireUser: vi.fn(),
  isPlatformAdmin: vi.fn(),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
const leagueId = "00000000-0000-4000-8000-000000000001";
const userId = "30000000-0000-4000-8000-000000000002";
const rpc = vi.fn();
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(requireUser).mockResolvedValue({
    supabase: { rpc },
  } as unknown as Awaited<ReturnType<typeof requireUser>>);
  vi.mocked(isPlatformAdmin).mockResolvedValue(true);
  rpc.mockResolvedValue({ error: null });
});

describe("platform admin actions", () => {
  it("adds staff by a cleaned-up email", async () => {
    expect(
      await addLeagueMember({
        leagueId,
        email: " Mia@Example.com ",
        role: "league_staff",
      }),
    ).toEqual({ success: true });
    expect(rpc).toHaveBeenCalledWith("admin_add_member", {
      p_league_id: leagueId,
      p_email: "mia@example.com",
      p_role: "league_staff",
    });
  });
  it("never lets anyone else use them", async () => {
    vi.mocked(isPlatformAdmin).mockResolvedValue(false);
    expect(
      await replaceCommissioner({ leagueId, email: "mia@example.com" }),
    ).toEqual({ error: "notAllowed" });
    expect(rpc).not.toHaveBeenCalled();
  });
  it("only adds commissioners and staff, not team managers", async () => {
    expect(
      await addLeagueMember({
        leagueId,
        email: "mia@example.com",
        role: "team_manager",
      }),
    ).toEqual({ error: "invalidEmail" });
    expect(rpc).not.toHaveBeenCalled();
  });
  it("explains database refusals in plain words", async () => {
    rpc.mockResolvedValue({ error: { message: "last_commissioner" } });
    expect(
      await removeLeagueMember({ leagueId, userId, role: "commissioner" }),
    ).toEqual({ error: "lastCommissioner" });
    rpc.mockResolvedValue({ error: { message: "user_not_found" } });
    expect(
      await replaceCommissioner({ leagueId, email: "new@example.com" }),
    ).toEqual({ error: "userNotFound" });
  });
  it("needs a reason to pause but not to resume", async () => {
    expect(await setLeaguePaused({ leagueId, paused: true })).toEqual({
      error: "reasonRequired",
    });
    expect(await setLeaguePaused({ leagueId, paused: false })).toEqual({
      success: true,
    });
    expect(rpc).toHaveBeenCalledWith("admin_set_league_paused", {
      p_league_id: leagueId,
      p_paused: false,
      p_reason: "",
    });
  });
});
