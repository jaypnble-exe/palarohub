import { beforeEach, describe, expect, it, vi } from "vitest";
import { createClient as createStatelessClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { addAccount, forgetAccount, switchAccount } from "./accounts";

vi.mock("server-only", () => ({}));
const jar = new Map<string, string>();
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) =>
      jar.has(name) ? { name, value: jar.get(name) } : undefined,
    set: (name: string, value: string) => jar.set(name, value),
    delete: (name: string) => jar.delete(name),
  }),
}));
vi.mock("next/navigation", () => ({
  redirect: vi.fn((to: string) => {
    throw new Error(`redirect:${to}`);
  }),
}));
vi.mock("@/lib/supabase/env", () => ({
  hasSupabaseConfig: () => true,
  getSupabaseConfig: () => ({ url: "https://x.supabase.co", key: "k" }),
}));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@supabase/supabase-js", () => ({ createClient: vi.fn() }));

const mia = "30000000-0000-4000-8000-000000000002";
const paolo = "30000000-0000-4000-8000-000000000004";
const cookie = "palaros-accounts";
const write = (accounts: unknown[]) =>
  jar.set(cookie, Buffer.from(JSON.stringify(accounts)).toString("base64url"));
const read = () =>
  JSON.parse(Buffer.from(jar.get(cookie) ?? "", "base64url").toString()) as {
    id: string;
    refreshToken: string;
  }[];

const setSession = vi.fn();
const refreshSession = vi.fn();
function signedInAs(id: string | null, anonymous = false) {
  vi.mocked(createClient).mockResolvedValue({
    auth: {
      getUser: async () => ({
        data: {
          user: id
            ? {
                id,
                email: "mia@example.com",
                is_anonymous: anonymous,
                user_metadata: { full_name: "Mia Dela Cruz" },
              }
            : null,
        },
      }),
      getSession: async () => ({
        data: {
          session: id ? { user: { id }, refresh_token: "mia-refresh" } : null,
        },
      }),
      setSession,
    },
  } as unknown as Awaited<ReturnType<typeof createClient>>);
}

beforeEach(() => {
  jar.clear();
  vi.clearAllMocks();
  vi.mocked(createStatelessClient).mockReturnValue({
    auth: { refreshSession },
  } as unknown as ReturnType<typeof createStatelessClient>);
  setSession.mockResolvedValue({ error: null });
  write([
    {
      id: paolo,
      email: "paolo@example.com",
      name: "Paolo",
      refreshToken: "paolo-refresh",
    },
  ]);
});

describe("switching accounts", () => {
  it("resumes the saved session and keeps the current account to switch back", async () => {
    signedInAs(mia);
    refreshSession.mockResolvedValue({
      data: {
        user: { id: paolo },
        session: { access_token: "a2", refresh_token: "paolo-next" },
      },
      error: null,
    });
    await expect(switchAccount(paolo)).rejects.toThrow("redirect:/leagues");
    expect(refreshSession).toHaveBeenCalledWith({
      refresh_token: "paolo-refresh",
    });
    expect(setSession).toHaveBeenCalledWith({
      access_token: "a2",
      refresh_token: "paolo-next",
    });
    expect(read()).toEqual([
      expect.objectContaining({ id: mia, refreshToken: "mia-refresh" }),
    ]);
  });
  it("leaves the current account signed in when the saved session has ended", async () => {
    signedInAs(mia);
    refreshSession.mockResolvedValue({
      data: { user: null, session: null },
      error: { message: "Invalid Refresh Token" },
    });
    expect(await switchAccount(paolo)).toEqual({ error: "expired" });
    expect(setSession).not.toHaveBeenCalled();
    expect(read().map((account) => account.id)).toEqual([mia]);
  });
  it("only switches to accounts saved on this device", async () => {
    signedInAs(mia);
    expect(await switchAccount(mia)).toEqual({ error: "notFound" });
    expect(await switchAccount("not-an-id")).toEqual({ error: "notFound" });
    expect(refreshSession).not.toHaveBeenCalled();
  });
  it("never saves a scorer device's anonymous session", async () => {
    signedInAs(mia, true);
    await expect(addAccount()).rejects.toThrow("redirect:/login?add=1");
    expect(read().map((account) => account.id)).toEqual([paolo]);
  });
  it("saves the current account before adding another, and can forget one", async () => {
    signedInAs(mia);
    await expect(addAccount()).rejects.toThrow("redirect:/login?add=1");
    expect(read().map((account) => account.id)).toEqual([mia, paolo]);
    await forgetAccount(paolo);
    expect(read().map((account) => account.id)).toEqual([mia]);
  });
});
